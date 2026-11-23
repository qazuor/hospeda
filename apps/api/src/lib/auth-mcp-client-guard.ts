/**
 * @file auth-mcp-client-guard.ts
 * @description The OAuth half of «AI assistants are only for real clients»
 * (HOS-2562, owner decision of 22/11). A real client is a person with at least
 * one business vertical (`isRealClient` in `@repo/schemas`, the same rule the
 * web uses); a pure tourist cannot connect an assistant.
 *
 * Three refusal points, all server-side, from earliest to hardest:
 *
 * 1. `/oauth2/authorize` with a session: refused before the provider redirects
 *    to the consent page or, for a client with a stored consent, straight back
 *    with a code. Without a session the request passes untouched, so the
 *    provider still sends the visitor to sign in.
 * 2. `/oauth2/consent` with `accept: true`: refused. Covers the path the first
 *    point cannot see: after sign-in the provider resumes the authorization
 *    INTERNALLY (its own `after` hook calls the authorize handler directly), so
 *    no `/oauth2/authorize` request reaches a `before` hook. A denial
 *    (`accept: false`) passes, so the assistant gets its `access_denied`.
 * 3. Token issuance: `customAccessTokenClaims` throws for a non-client
 *    ({@link assertMcpRealClientForToken}). The provider calls it only when it
 *    mints a JWT, i.e. when the authorization or the token request named the
 *    MCP `resource`. Proven for the code exchange and the refresh, with and
 *    without `resource` on the token request, as long as the authorization
 *    bound it (`mcp-oauth-real-client.test.ts`). When NO step names a resource
 *    the provider mints an opaque token and never calls the hook: a code or
 *    refresh token obtained while a client still yields a token after the
 *    account stops being one. That token carries no MCP audience, so `/mcp`
 *    answers 401 to it (pinned by the same test).
 *
 * The answer is OAuth's own: `403` with `error: "access_denied"`. The
 * AUTHORITATIVE gate is the per-request check in `mcpAuthMiddleware`
 * (`middlewares/mcp-auth.ts`, «real client» step, HOS-2562 step 6): every
 * `/mcp` request needs an MCP-audience JWT AND a user who is a real client at
 * that moment. The three points above refuse earlier and more politely; none
 * of them is what makes the rule hold. The device-code grant is not offered
 * (no `oauthDeviceAuthorization()` plugin; the token endpoint answers
 * `unsupported_grant_type`).
 */

import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import type { ActorSourceUser } from '../middlewares/actor';

/** Answers whether a signed-in user is a real client. */
export type IsRealClientForUser = (input: { readonly user: ActorSourceUser }) => Promise<boolean>;

/** Path of the authorization endpoint. */
const AUTHORIZE_PATH = '/oauth2/authorize';

/** Path of the consent endpoint. */
const CONSENT_PATH = '/oauth2/consent';

/** `error_description` of every refusal. */
export const MCP_NOT_A_CLIENT_DESCRIPTION =
    'AI assistants are only available to Hospeda business accounts';

/** The refusal: OAuth `access_denied`, HTTP 403. */
function notAClient(): APIError {
    return new APIError('FORBIDDEN', {
        error: 'access_denied',
        error_description: MCP_NOT_A_CLIENT_DESCRIPTION
    });
}

/**
 * Arguments for {@link createMcpRealClientGuard}. RO-RO.
 */
export interface CreateMcpRealClientGuardArgs {
    /** The «real client» check (production: `isUserRealClient`). */
    readonly isRealClientForUser: IsRealClientForUser;
}

/**
 * Builds the Better Auth plugin that refuses the authorize step (with a
 * session) and the consent acceptance to anybody who is not a real client.
 *
 * @param args - The «real client» check
 * @returns The plugin
 */
export function createMcpRealClientGuard({
    isRealClientForUser
}: CreateMcpRealClientGuardArgs): BetterAuthPlugin {
    return {
        id: 'hospeda-mcp-real-client-guard',
        hooks: {
            before: [
                {
                    matcher: (context) => context.path === AUTHORIZE_PATH,
                    handler: createAuthMiddleware(async (ctx) => {
                        const session = await getSessionFromCtx(ctx);
                        if (!session?.user) {
                            return; // the provider sends the visitor to sign in
                        }
                        if (!(await isRealClientForUser({ user: session.user }))) {
                            throw notAClient();
                        }
                    })
                },
                {
                    matcher: (context) => context.path === CONSENT_PATH,
                    handler: createAuthMiddleware(async (ctx) => {
                        const body = ctx.body as { accept?: unknown } | undefined;
                        if (body?.accept !== true) {
                            return; // a denial or a malformed body: the provider answers
                        }
                        const session = await getSessionFromCtx(ctx);
                        if (!session?.user) {
                            return; // the provider answers its own 401
                        }
                        if (!(await isRealClientForUser({ user: session.user }))) {
                            throw notAClient();
                        }
                    })
                }
            ]
        }
    };
}

/**
 * Arguments for {@link assertMcpRealClientForToken}. RO-RO.
 */
export interface AssertMcpRealClientForTokenArgs {
    /** The user the token would act for; absent for a machine grant. */
    readonly user: ActorSourceUser | null | undefined;
    /** The «real client» check. */
    readonly isRealClientForUser: IsRealClientForUser;
}

/**
 * The token-issuance gate, run from `customAccessTokenClaims`: throws for a
 * token that would act for anybody but a real client. The provider calls it
 * only for JWT access tokens (a `resource` was named); opaque tokens skip it
 * and are refused by `/mcp` instead (see the file header). Every MCP token acts for
 * a user (`client_credentials` is not offered), so a missing user is refused.
 *
 * @param args - The user and the check
 * @throws APIError 403 `access_denied` for a non-client
 */
export async function assertMcpRealClientForToken({
    user,
    isRealClientForUser
}: AssertMcpRealClientForTokenArgs): Promise<void> {
    if (!user?.id || !(await isRealClientForUser({ user }))) {
        throw notAClient();
    }
}
