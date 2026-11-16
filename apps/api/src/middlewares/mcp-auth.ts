/**
 * @file mcp-auth.ts
 * @description Bearer-token authentication for the `/mcp` endpoint
 * (HOS-2184 T-008). The API is the OAuth resource server; Better Auth's
 * oauth-provider plugin (`lib/auth-mcp-oauth.ts`) is the authorization server.
 *
 * Every request goes through four checks, in this order, and any failure is a
 * `401` carrying `WWW-Authenticate: Bearer resource_metadata="…"` (AC-4):
 *
 * 1. **Credentials present.** An `Authorization: Bearer <token>` header.
 * 2. **Token valid.** Signature against the local JWKS, issuer = the Better
 *    Auth base URL, audience = `HOSPEDA_MCP_RESOURCE_URL`, `typ` = `at+jwt`,
 *    not expired. Done by `verifyAccessTokenRequest` through the provider's
 *    resource client, which reads the signing keys IN PROCESS (see
 *    {@link createDefaultMcpAccessTokenVerifier}).
 * 3. **Grant still live.** This is the revocation check. The provider issues
 *    RFC 9068 JWT access tokens whenever a `resource` is requested (always,
 *    for MCP), and a JWT access token is never stored: the provider's own
 *    `/oauth2/revoke` answers `unsupported_token_type` for one. A signature
 *    check alone would therefore keep a revoked connection working for up to
 *    an hour. So after the signature, the middleware requires that the client
 *    row exists and is not `disabled`, and that the user's `oauthConsent` for
 *    that client still exists. Revoking a connection (AC-11) deletes the
 *    consent, so the very next call answers 401.
 * 4. **User usable.** The token subject is a live account: present, not
 *    soft-deleted (H-163) and not banned.
 * 5. **Account state (403).** A bearer request never reaches
 *    `mustChangePasswordGate`, so its predicate and body are applied here:
 *    `mustChangePassword` → `403 PASSWORD_CHANGE_REQUIRED`. Email verification
 *    depends on the operation (`resolvePersonStateStep`), so it is not a
 *    request gate; it rides on `actor.emailVerified` for per-tool checks.
 *
 * Then the actor is built with the same function the session middleware uses
 * (`buildActorForUser`), and the grant (client id/name, scopes) is set on the
 * context as `mcpAuth`.
 *
 * The middleware is also the flag gate of the `/mcp` route
 * (`routes/mcp/index.ts`): with `HOSPEDA_MCP_ENABLED` off (or no
 * `HOSPEDA_MCP_RESOURCE_URL`) it answers the app's normal 404 body, read per
 * request like the discovery routes. The OAuth plugins are not per request:
 * toggling the flag needs an API redeploy (see `auth-mcp-oauth.ts`).
 *
 * The raw token is never logged.
 */

import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { eq, getDb, users } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { getAuth } from '../lib/auth';
import { readBearerToken } from '../lib/mcp/bearer-token';
import { MCP_PROTECTED_RESOURCE_ALIAS_PATH } from '../lib/mcp-well-known';
import { setRequestContextActor } from '../lib/request-context';
import type { AppBindings, McpAuthContext } from '../types';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { type ActorSourceUser, buildActorForUser } from './actor';
import {
    isPasswordChangeRequired,
    PASSWORD_CHANGE_REQUIRED_RESPONSE
} from './must-change-password';

/** JOSE `typ` header of an RFC 9068 access token, as the provider signs it. */
const ACCESS_TOKEN_TYPE = 'at+jwt';

/** Same literal UUID shape `middlewares/ownership.ts` uses. */
const UUID_PATTERN =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Claims the middleware reads from a verified access token. `client_id` is
 * filled from `azp` by the verifier.
 */
const McpAccessTokenClaimsSchema = z.object({
    sub: z.string().regex(UUID_PATTERN),
    client_id: z.string().min(1),
    scope: z.string().optional()
});

/**
 * Why a request was refused. Logged, never returned to the client.
 */
export type McpAuthRejection =
    | 'missing_token'
    | 'invalid_token'
    | 'malformed_claims'
    | 'grant_revoked'
    | 'user_unavailable';

/**
 * Outcome of verifying an access token. `valid: false` means the token itself
 * was rejected (bad signature, wrong audience/issuer, expired, malformed).
 * Infrastructure failures (keys unreadable, database down) are thrown instead,
 * so they surface as a 5xx rather than as a misleading 401.
 */
export type McpTokenVerification =
    | { readonly valid: true; readonly claims: Readonly<Record<string, unknown>> }
    | { readonly valid: false };

/**
 * A grant still in force: the client exists, is enabled, and the user's
 * consent for it has not been revoked.
 */
export interface McpActiveGrant {
    /** Registered client name, or `null` when the client has none. */
    readonly clientName: string | null;
}

/**
 * The seams of the middleware. Defaults talk to Better Auth and the database;
 * tests replace them.
 */
export interface McpAuthDeps {
    /** Verifies the request's access token against issuer and audience. */
    readonly verifyAccessToken: (input: {
        readonly request: Request;
        readonly audience: string;
    }) => Promise<McpTokenVerification>;
    /** Returns the live grant for the pair, or `null` when it was revoked. */
    readonly findActiveGrant: (input: {
        readonly clientId: string;
        readonly userId: string;
    }) => Promise<McpActiveGrant | null>;
    /** Returns the usable user, or `null` when missing, deleted or banned. */
    readonly findUser: (input: { readonly userId: string }) => Promise<ActorSourceUser | null>;
    /** Builds the actor for the user (`buildActorForUser`). */
    readonly buildActor: (input: { readonly user: ActorSourceUser }) => Promise<Actor>;
}

/**
 * Runtime configuration for this middleware, read per request.
 *
 * Only the `/mcp` gate and the discovery routes follow the flag live. The Better
 * Auth OAuth plugins are built once in `getAuth()`, so toggling
 * `HOSPEDA_MCP_ENABLED` needs an API redeploy to take full effect.
 */
export interface McpAuthConfig {
    /** `HOSPEDA_MCP_ENABLED`. Anything but `true` is off. */
    readonly enabled: boolean;
    /** `HOSPEDA_MCP_RESOURCE_URL`, the required token audience. */
    readonly resourceUrl: string | undefined;
    /** `HOSPEDA_API_URL`, origin of the protected-resource metadata document. */
    readonly apiUrl: string;
}

/**
 * Arguments for {@link buildMcpWwwAuthenticate}. RO-RO.
 */
export interface BuildMcpWwwAuthenticateArgs {
    /** `HOSPEDA_API_URL`. A trailing slash is ignored. */
    readonly apiUrl: string;
    /** `true` when a token was presented and rejected (RFC 6750 §3.1). */
    readonly invalidToken: boolean;
}

/**
 * Builds the `WWW-Authenticate` challenge of a refused MCP request.
 *
 * `resource_metadata` (RFC 9728 §5.1) points to the path-inserted
 * protected-resource document for `/mcp`; it is what tells Claude and ChatGPT
 * where to start the OAuth flow. `error="invalid_token"` is added only when a
 * token was presented: RFC 6750 §3.1 says a request without credentials gets no
 * error code.
 *
 * @param args - API origin and whether a token was presented
 * @returns The header value
 *
 * @example
 * ```typescript
 * buildMcpWwwAuthenticate({ apiUrl: 'https://api.hospeda.com.ar', invalidToken: false });
 * // 'Bearer resource_metadata="https://api.hospeda.com.ar/.well-known/oauth-protected-resource/mcp"'
 * ```
 */
export function buildMcpWwwAuthenticate({
    apiUrl,
    invalidToken
}: BuildMcpWwwAuthenticateArgs): string {
    const metadataUrl = `${apiUrl.replace(/\/+$/, '')}${MCP_PROTECTED_RESOURCE_ALIAS_PATH}`;
    const params = [
        ...(invalidToken ? ['error="invalid_token"'] : []),
        `resource_metadata="${metadataUrl}"`
    ];
    return `Bearer ${params.join(', ')}`;
}

/**
 * Whether an error is Better Auth's `APIError` with a 401 status, which is how
 * the resource client reports a rejected token. Structural on purpose: Better
 * Auth ships two `APIError` classes (`better-call` and `@better-auth/core`), and
 * its own `isAPIError` also matches by name.
 */
function isUnauthorizedApiError(error: unknown): boolean {
    if (!(error instanceof Error) || error.name !== 'APIError') {
        return false;
    }
    const { status, statusCode } = error as Error & {
        readonly status?: unknown;
        readonly statusCode?: unknown;
    };
    return status === 'UNAUTHORIZED' || statusCode === 401;
}

/**
 * A `verifyAccessTokenRequest`-shaped function: throws a 401 `APIError` for a
 * rejected token and resolves to the verified claims otherwise.
 */
export type VerifyAccessTokenRequestFn = (
    request: Request,
    opts: {
        readonly verifyOptions: {
            readonly issuer: string;
            readonly audience: string;
            readonly typ: string;
        };
    }
) => Promise<Readonly<Record<string, unknown>>>;

/**
 * Arguments for {@link createMcpAccessTokenVerifier}. RO-RO.
 */
export interface CreateMcpAccessTokenVerifierArgs {
    /** The underlying request verifier. */
    readonly verifyRequest: VerifyAccessTokenRequestFn;
    /** Resolves the expected issuer (the Better Auth base URL). */
    readonly getIssuer: () => Promise<string>;
}

/**
 * Wraps a `verifyAccessTokenRequest` function into a
 * {@link McpAuthDeps.verifyAccessToken}: fixes issuer, audience and
 * `typ: at+jwt`, maps a 401 `APIError` to `{ valid: false }` and rethrows
 * anything else (an infrastructure failure must not look like a bad token).
 *
 * @param args - The underlying verifier and the issuer source
 * @returns A verifier for {@link McpAuthDeps.verifyAccessToken}
 */
export function createMcpAccessTokenVerifier({
    verifyRequest,
    getIssuer
}: CreateMcpAccessTokenVerifierArgs): McpAuthDeps['verifyAccessToken'] {
    return async ({ request, audience }) => {
        const issuer = await getIssuer();
        try {
            const claims = await verifyRequest(request, {
                verifyOptions: { issuer, audience, typ: ACCESS_TOKEN_TYPE }
            });
            return { valid: true, claims };
        } catch (error) {
            if (isUnauthorizedApiError(error)) {
                return { valid: false };
            }
            throw error;
        }
    };
}

/** Lazily created resource client actions, bound to the Better Auth instance. */
let resourceActions: ReturnType<
    ReturnType<typeof oauthProviderResourceClient<ReturnType<typeof getAuth>>>['getActions']
> | null = null;

/**
 * Default token verifier: `verifyAccessTokenRequest` from the provider's
 * resource client (`@better-auth/oauth-provider/resource-client`), bound to the
 * Better Auth instance.
 *
 * Why the resource client and not `better-auth/oauth2`'s function directly:
 * bound to the instance and given no `jwksUrl`, it reads the signing keys in
 * process (the jwt plugin's `getJwks`, cached per adapter) instead of fetching
 * this server's own `/api/auth/jwks` over HTTP. Same keys, no self-request,
 * no network failure mode. Passing `jwksUrl` would turn HTTP fetching back on.
 *
 * The issuer is the instance's `baseURL` (`HOSPEDA_API_URL` + `/api/auth`),
 * the same value the tokens' `iss` and the protected-resource metadata use.
 *
 * @returns A verifier for {@link McpAuthDeps.verifyAccessToken}
 */
export function createDefaultMcpAccessTokenVerifier(): McpAuthDeps['verifyAccessToken'] {
    return createMcpAccessTokenVerifier({
        verifyRequest: (request, opts) => {
            if (!resourceActions) {
                resourceActions = oauthProviderResourceClient(getAuth()).getActions();
            }
            return resourceActions.verifyAccessTokenRequest(request, opts);
        },
        getIssuer: async () => (await getAuth().$context).baseURL
    });
}

/** Client row fields read for the grant check. */
interface OAuthClientRow {
    readonly name?: string | null;
    readonly disabled?: boolean | null;
}

/**
 * Default grant check, through the Better Auth adapter (the OAuth tables are
 * mapped there, not in `@repo/db` models).
 *
 * A grant is live when the client row exists and is not `disabled`, and an
 * `oauthConsent` row exists for `(clientId, userId)`. Every MCP client goes
 * through the consent screen (CIMD and DCR clients cannot set `skip_consent`),
 * so a missing consent means it was revoked.
 */
export const findActiveMcpGrant: McpAuthDeps['findActiveGrant'] = async ({ clientId, userId }) => {
    const { adapter } = await getAuth().$context;
    const client = await adapter.findOne<OAuthClientRow>({
        model: 'oauthClient',
        where: [{ field: 'clientId', value: clientId }]
    });
    if (!client || client.disabled === true) {
        return null;
    }
    const consent = await adapter.findOne<{ readonly id: string }>({
        model: 'oauthConsent',
        where: [
            { field: 'clientId', value: clientId },
            { field: 'userId', value: userId }
        ]
    });
    if (!consent) {
        return null;
    }
    return { clientName: typeof client.name === 'string' ? client.name : null };
};

/**
 * Default user lookup. One primary-key read of the columns the actor needs plus
 * the account-state columns. Refuses a missing, soft-deleted (H-163) or banned
 * account: a bearer token never creates a session, so neither the deletion gate
 * nor the admin plugin's ban gate on session creation would run for it.
 */
export const findMcpUser: McpAuthDeps['findUser'] = async ({ userId }) => {
    const rows = await getDb()
        .select({
            id: users.id,
            name: users.displayName,
            email: users.email,
            image: users.image,
            emailVerified: users.emailVerified,
            mustChangePassword: users.mustChangePassword,
            deletedAt: users.deletedAt,
            banned: users.banned,
            banExpires: users.banExpires
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    const row = rows[0];
    if (!row || row.deletedAt) {
        return null;
    }
    const banActive = row.banned === true && (!row.banExpires || row.banExpires > new Date());
    if (banActive) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        image: row.image,
        emailVerified: row.emailVerified,
        mustChangePassword: row.mustChangePassword
    };
};

/** Production dependencies. */
const DEFAULT_DEPS: McpAuthDeps = {
    verifyAccessToken: createDefaultMcpAccessTokenVerifier(),
    findActiveGrant: findActiveMcpGrant,
    findUser: findMcpUser,
    buildActor: ({ user }) => buildActorForUser({ user })
};

/** Reads the configuration from the validated env. */
const readConfigFromEnv = (): McpAuthConfig => ({
    enabled: env.HOSPEDA_MCP_ENABLED === true,
    resourceUrl: env.HOSPEDA_MCP_RESOURCE_URL,
    apiUrl: env.HOSPEDA_API_URL
});

/**
 * Answers a refused MCP request: 401, `UNAUTHORIZED`, with the challenge.
 */
function unauthorized(input: {
    readonly c: Context<AppBindings>;
    readonly apiUrl: string;
    readonly reason: McpAuthRejection;
}): Response {
    const { c, apiUrl, reason } = input;
    apiLogger.debug(`MCP request refused: ${reason}`);
    c.header(
        'WWW-Authenticate',
        buildMcpWwwAuthenticate({ apiUrl, invalidToken: reason !== 'missing_token' })
    );
    return c.json(
        {
            success: false,
            error: {
                code: ServiceErrorCode.UNAUTHORIZED,
                message: 'A valid access token is required'
            }
        },
        401
    );
}

/**
 * Arguments for {@link createMcpAuthMiddleware}. RO-RO.
 */
export interface CreateMcpAuthMiddlewareArgs {
    /** Replaces some or all production dependencies (tests). */
    readonly deps?: Partial<McpAuthDeps>;
    /** Replaces the env-backed configuration (tests). */
    readonly getConfig?: () => McpAuthConfig;
}

/**
 * Creates the `/mcp` bearer-token middleware. See the module docblock for the
 * checks and their order.
 *
 * On success the context carries `actor` (built like the session actor) and
 * `mcpAuth` ({@link McpAuthContext}), and the request log context carries the
 * user id and roles.
 *
 * @param args - Optional dependency and configuration overrides
 * @returns The Hono middleware
 *
 * @example
 * ```typescript
 * routes.on(['GET', 'POST', 'DELETE'], '/mcp', createMcpAuthMiddleware(), handler);
 * ```
 */
export function createMcpAuthMiddleware({
    deps,
    getConfig = readConfigFromEnv
}: CreateMcpAuthMiddlewareArgs = {}): MiddlewareHandler<AppBindings> {
    const resolved: McpAuthDeps = { ...DEFAULT_DEPS, ...deps };

    return async (c, next) => {
        const config = getConfig();
        if (!config.enabled || !config.resourceUrl) {
            return c.json(
                {
                    success: false,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Route not found' }
                },
                404
            );
        }
        const { apiUrl, resourceUrl } = config;

        if (!readBearerToken({ authorization: c.req.header('Authorization') })) {
            return unauthorized({ c, apiUrl, reason: 'missing_token' });
        }

        const verification = await resolved.verifyAccessToken({
            request: c.req.raw,
            audience: resourceUrl
        });
        if (!verification.valid) {
            return unauthorized({ c, apiUrl, reason: 'invalid_token' });
        }

        const parsed = McpAccessTokenClaimsSchema.safeParse(verification.claims);
        if (!parsed.success) {
            return unauthorized({ c, apiUrl, reason: 'malformed_claims' });
        }
        const { sub: userId, client_id: clientId, scope } = parsed.data;

        const [grant, user] = await Promise.all([
            resolved.findActiveGrant({ clientId, userId }),
            resolved.findUser({ userId })
        ]);
        if (!grant) {
            return unauthorized({ c, apiUrl, reason: 'grant_revoked' });
        }
        if (!user) {
            return unauthorized({ c, apiUrl, reason: 'user_unavailable' });
        }
        if (isPasswordChangeRequired({ user })) {
            apiLogger.debug('MCP request refused: password_change_required');
            return c.json(PASSWORD_CHANGE_REQUIRED_RESPONSE, 403);
        }

        const actor = await resolved.buildActor({ user });
        const mcpAuth: McpAuthContext = {
            userId,
            clientId,
            clientName: grant.clientName,
            scopes: scope ? scope.split(' ').filter((s) => s.length > 0) : []
        };

        c.set('actor', actor);
        c.set('mcpAuth', mcpAuth);
        setRequestContextActor({ userId: actor.id, roles: actor.roles });

        await next();
    };
}
