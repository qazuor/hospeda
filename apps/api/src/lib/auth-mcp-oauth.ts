/**
 * @file auth-mcp-oauth.ts
 * @description Better Auth plugins that turn the API into the OAuth 2.1
 * authorization server for the Hospeda MCP server (HOS-2184 T-004).
 *
 * Four plugins, registered together or not at all:
 *
 * - `jwt({ disableSettingJwtHeader: true })` signs RFC 9068 access tokens and
 *   serves `/api/auth/jwks`. The header flag stops it from adding a
 *   `set-auth-jwt` header to every session response, and its own `/token`
 *   endpoint is disabled (see {@link McpOAuthConfig.disabledPaths}) because the
 *   OAuth token endpoint is `/oauth2/token`.
 * - `oauthProvider(...)` from `@better-auth/oauth-provider` — the OAuth 2.1 /
 *   OIDC provider. Not `mcp()`: the Hono API is the resource server and uses
 *   the provider's resource-server helpers directly (spec §6.3).
 * - `cimd(...)` from `@better-auth/cimd` — Client ID Metadata Documents, the
 *   registration path the MCP 2026-07-28 revision recommends (Claude and
 *   ChatGPT send a metadata-document URL as their `client_id`).
 *
 * - `mcpRegistrationRedirectGuard` — the redirect allowlist at DCR.
 *
 * Everything is gated by `HOSPEDA_MCP_ENABLED`. The plugin list is built once
 * when `getAuth()` first runs, so flipping the flag needs an API redeploy. With the flag off
 * {@link buildMcpOAuthConfig} constructs nothing and returns empty lists, so
 * `auth.ts` passes Better Auth exactly the options it passed before HOS-2184.
 *
 * What the provider does by default and is therefore NOT configured here:
 * - PKCE: always required for public clients and for any request carrying
 *   `offline_access`; `plain` is not supported, so the method is S256.
 * - RFC 9207 `iss` on every authorization response (success and error),
 *   which ChatGPT requires.
 * - Refresh-token rotation: a refresh token is single-use
 *   (`refreshTokenReuseInterval` defaults to 0).
 *
 * Runtime prerequisite: the plugins declare tables (`oauthClient`,
 * `oauthAccessToken`, `oauthRefreshToken`, `oauthConsent`,
 * `oauthClientAssertion`, `oauthResource`, `oauthClientResource`, `jwks`)
 * that the Drizzle adapter must map. Better Auth validates the schema at
 * runtime, so enabling the flag before those tables exist fails every auth
 * request. The tables are migration `0227_hos2184_oauth_provider_tables`
 * (HOS-2184 T-005); `auth-mcp-oauth-schema.ts` maps them for the adapter.
 */

import { cimd } from '@better-auth/cimd';
import {
    type GrantType,
    type OAuthOptions,
    oauthProvider,
    type Scope
} from '@better-auth/oauth-provider';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { mcpCimdFetch } from './auth-mcp-cimd-fetch';

/**
 * Scopes the provider accepts. `offline_access` is what makes the provider
 * issue a (rotating) refresh token, so connected clients stay linked past the
 * one-hour access-token lifetime.
 */
export const MCP_OAUTH_SCOPES: readonly Scope[] = ['openid', 'profile', 'email', 'offline_access'];

/**
 * Grants the token endpoint serves. `client_credentials` (the provider's
 * default third grant) is left out on purpose: every MCP token acts for a
 * user, never for a machine.
 */
export const MCP_OAUTH_GRANT_TYPES: readonly GrantType[] = ['authorization_code', 'refresh_token'];

/**
 * Exact redirect URIs of the hosted AI clients.
 *
 * - Claude custom connectors: `claude.ai` and `claude.com` (spec §6.3).
 * - ChatGPT apps: the stable callback, used when the authorization server
 *   meets ChatGPT's issuer-identification requirements (RFC 9207 `iss`),
 *   which the provider does (developers.openai.com/plugins/build/auth).
 */
export const MCP_ALLOWED_REDIRECT_URIS = [
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect'
] as const;

/**
 * ChatGPT's callback-ID-specific redirect (`/connector/oauth/{callback_id}`).
 * ChatGPT only falls back to it for servers that miss its issuer requirements;
 * it is accepted so a connection is not lost if ChatGPT classifies us that way.
 */
const CHATGPT_CALLBACK_ID_REDIRECT = /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]+$/;

/**
 * Hosts whose CIMD metadata documents are fetched: the hosts of the hosted-client
 * redirect URIs ({@link MCP_ALLOWED_REDIRECT_URIS}). Exact match, no subdomains.
 */
export const MCP_ALLOWED_CIMD_HOSTS: ReadonlySet<string> = new Set(
    MCP_ALLOWED_REDIRECT_URIS.map((uri) => new URL(uri).hostname)
);

/**
 * Whether a CIMD `client_id` URL may be fetched at all. A CIMD client id is an
 * attacker-chosen URL, so anything but `https` on an allowlisted host (no
 * credentials, default port) is refused before any network call.
 *
 * @param clientIdUrl - The `client_id` URL
 * @returns `true` when the metadata document may be fetched
 */
export function isMcpCimdUrlAllowed(clientIdUrl: string | URL): boolean {
    let url: URL;
    try {
        url = new URL(String(clientIdUrl));
    } catch {
        return false;
    }
    return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.port === '' &&
        MCP_ALLOWED_CIMD_HOSTS.has(url.hostname)
    );
}

/** Loopback hosts accepted for CLI clients (Claude Code and similar). */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

/** Path of the web sign-in page the provider sends unauthenticated users to. */
export const MCP_OAUTH_LOGIN_PATH = '/es/auth/signin/';

/**
 * Path of the web consent page (`/es/auth/consent/`). The provider redirects
 * here when a client has no stored consent; the page shows the account and the
 * capabilities the connection grants.
 */
export const MCP_OAUTH_CONSENT_PATH = '/es/auth/consent/';

/**
 * Arguments for {@link isAllowedMcpRedirectUri}. RO-RO.
 */
export interface IsAllowedMcpRedirectUriArgs {
    /** The `redirect_uri` of an authorization request. */
    readonly redirectUri: string;
}

/**
 * Whether a redirect URI belongs to a client the MCP server is meant for.
 *
 * Accepts the exact hosted-client callbacks in
 * {@link MCP_ALLOWED_REDIRECT_URIS}, ChatGPT's callback-ID form, and plain
 * `http` loopback (`localhost` / `127.0.0.1`) on any port and path. Anything
 * with credentials or a fragment is rejected.
 *
 * @param args - The redirect URI to check
 * @returns `true` when the URI is on the allowlist
 *
 * @example
 * ```typescript
 * isAllowedMcpRedirectUri({ redirectUri: 'http://127.0.0.1:53682/callback' }); // true
 * isAllowedMcpRedirectUri({ redirectUri: 'https://evil.example/cb' }); // false
 * ```
 */
export function isAllowedMcpRedirectUri({ redirectUri }: IsAllowedMcpRedirectUriArgs): boolean {
    if ((MCP_ALLOWED_REDIRECT_URIS as readonly string[]).includes(redirectUri)) {
        return true;
    }
    if (CHATGPT_CALLBACK_ID_REDIRECT.test(redirectUri)) {
        return true;
    }

    let url: URL;
    try {
        url = new URL(redirectUri);
    } catch {
        return false;
    }
    return (
        url.protocol === 'http:' &&
        LOOPBACK_HOSTS.has(url.hostname) &&
        url.username === '' &&
        url.password === '' &&
        url.hash === '' &&
        !redirectUri.includes('#')
    );
}

/**
 * Better Auth paths disabled while the MCP authorization server is on.
 *
 * - `/token`: the `jwt()` plugin's own endpoint; the OAuth token endpoint is
 *   `/oauth2/token`.
 * - `/oauth2/create-client`, `/oauth2/update-client`, `/oauth2/delete-client`,
 *   `/oauth2/client/rotate-secret`, `/oauth2/client/rotate-keys`: the provider's
 *   client management for signed-in users. Any user could mint a confidential
 *   client (with a secret) bypassing the registration policy. Clients come in
 *   only through DCR (`/oauth2/register`) and CIMD; the account panel manages
 *   consents, not clients.
 *
 * Kept on purpose: `/oauth2/register`, `/oauth2/public-client` (consent page),
 * `/oauth2/get-client(s)` (read only), and the consent endpoints the consent
 * page and the connections panel use. The provider's `/admin/oauth2/*`
 * endpoints are server-only and not served over HTTP.
 */
export const MCP_DISABLED_AUTH_PATHS: readonly string[] = [
    '/token',
    '/oauth2/create-client',
    '/oauth2/update-client',
    '/oauth2/delete-client',
    '/oauth2/client/rotate-secret',
    '/oauth2/client/rotate-keys'
];

/** Path of Dynamic Client Registration. */
const REGISTER_PATH = '/oauth2/register';

/**
 * Better Auth plugin that applies the MCP redirect allowlist at Dynamic Client
 * Registration, which `oauthProvider`'s `validateRedirectUri` does not cover
 * ("Client registration is unchanged"). A request naming any redirect URI off
 * the allowlist ({@link isAllowedMcpRedirectUri}) is refused with the RFC 7591
 * error `invalid_redirect_uri` before anything is stored.
 *
 * CIMD has no equivalent pre-persist hook; its redirect URIs are checked at
 * `/oauth2/authorize` by `validateRedirectUri`.
 */
export const mcpRegistrationRedirectGuard: BetterAuthPlugin = {
    id: 'hospeda-mcp-registration-redirect-guard',
    hooks: {
        before: [
            {
                matcher: (context) => context.path === REGISTER_PATH,
                handler: createAuthMiddleware(async (ctx) => {
                    const body = ctx.body as { redirect_uris?: unknown } | undefined;
                    const uris = body?.redirect_uris;
                    if (!Array.isArray(uris)) {
                        return; // the provider answers its own validation error
                    }
                    const refused = uris.find(
                        (uri) =>
                            typeof uri !== 'string' ||
                            !isAllowedMcpRedirectUri({ redirectUri: uri })
                    );
                    if (refused !== undefined) {
                        throw new APIError('BAD_REQUEST', {
                            error: 'invalid_redirect_uri',
                            error_description:
                                'redirect_uris must be on the Hospeda MCP allowlist (Claude, ChatGPT or loopback)'
                        });
                    }
                })
            }
        ]
    }
};

/**
 * Arguments for {@link buildMcpOAuthProviderOptions}. RO-RO.
 */
export interface BuildMcpOAuthProviderOptionsArgs {
    /** Canonical public MCP URL (`HOSPEDA_MCP_RESOURCE_URL`), the token audience. */
    readonly resourceUrl: string;
    /** Public web origin (`HOSPEDA_SITE_URL`), where login and consent live. */
    readonly siteUrl: string;
}

/**
 * Builds the `oauthProvider()` options for the MCP authorization server.
 *
 * - `resources` holds only the MCP URL, so every access token is bound to it
 *   (`aud`). In Better Auth 1.7 `resources` replaces `validAudiences`.
 * - Dynamic Client Registration is the fallback to CIMD and is open
 *   (unauthenticated), because Claude registers before the user logs in.
 *   Dynamic clients are linked to no resource, hence
 *   `enforcePerClientResources: false` (otherwise `/oauth2/token` answers
 *   `invalid_target`).
 * - `clientRegistrationDefaultApplicationType: 'infer'` lets CLI clients that
 *   omit `application_type` register a loopback callback.
 * - `validateRedirectUri` narrows the provider's own matching: a URI must
 *   match the client's registration AND be on the MCP allowlist.
 *
 * @param args - Resource URL and web origin
 * @returns Options to pass to `oauthProvider()`
 */
export function buildMcpOAuthProviderOptions({
    resourceUrl,
    siteUrl
}: BuildMcpOAuthProviderOptionsArgs): OAuthOptions<Scope[]> {
    const siteOrigin = siteUrl.replace(/\/+$/, '');

    return {
        loginPage: `${siteOrigin}${MCP_OAUTH_LOGIN_PATH}`,
        consentPage: `${siteOrigin}${MCP_OAUTH_CONSENT_PATH}`,
        scopes: [...MCP_OAUTH_SCOPES],
        grantTypes: [...MCP_OAUTH_GRANT_TYPES],
        resources: [resourceUrl],
        enforcePerClientResources: false,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationRequirePKCE: true,
        clientRegistrationDefaultApplicationType: 'infer',
        validateRedirectUri: (redirectUri, _registeredUris, defaultResult) =>
            defaultResult && isAllowedMcpRedirectUri({ redirectUri })
    };
}

/**
 * Arguments for {@link buildMcpOAuthConfig}. RO-RO.
 */
export interface BuildMcpOAuthConfigArgs {
    /** `HOSPEDA_MCP_ENABLED`. Anything but `true` means off. */
    readonly enabled: boolean | undefined;
    /** `HOSPEDA_MCP_RESOURCE_URL`. Required when `enabled` is `true`. */
    readonly resourceUrl: string | undefined;
    /** `HOSPEDA_SITE_URL`. */
    readonly siteUrl: string;
}

/**
 * What `auth.ts` merges into its Better Auth options.
 */
export interface McpOAuthConfig {
    /** Whether the MCP authorization server is on. */
    readonly enabled: boolean;
    /** Plugins to append after the existing ones. Empty when off. */
    readonly plugins: readonly BetterAuthPlugin[];
    /** Better Auth paths to disable. Empty when off. */
    readonly disabledPaths: readonly string[];
    /** The `oauthProvider()` options in use, or `null` when off. */
    readonly oauthProviderOptions: OAuthOptions<Scope[]> | null;
}

/**
 * Builds the Better Auth additions for the MCP authorization server.
 *
 * With the flag off nothing is constructed: no plugin, no disabled path.
 * With it on, returns `jwt`, `oauthProvider` and `cimd` (in that order; `cimd`
 * extends the provider from its `init` hook) and disables the JWT plugin's
 * `/token` endpoint, as the provider docs require.
 *
 * @param args - Flag, resource URL and web origin
 * @returns Plugins and disabled paths to merge into the Better Auth options
 * @throws Error if the flag is on and `resourceUrl` is missing (the env
 *   schema already refuses that combination; this keeps the builder safe on
 *   its own)
 *
 * @example
 * ```typescript
 * const mcpOAuth = buildMcpOAuthConfig({
 *     enabled: env.HOSPEDA_MCP_ENABLED,
 *     resourceUrl: env.HOSPEDA_MCP_RESOURCE_URL,
 *     siteUrl: env.HOSPEDA_SITE_URL
 * });
 * ```
 */
export function buildMcpOAuthConfig({
    enabled,
    resourceUrl,
    siteUrl
}: BuildMcpOAuthConfigArgs): McpOAuthConfig {
    if (enabled !== true) {
        return { enabled: false, plugins: [], disabledPaths: [], oauthProviderOptions: null };
    }
    if (!resourceUrl) {
        throw new Error('HOSPEDA_MCP_RESOURCE_URL is required when HOSPEDA_MCP_ENABLED is true');
    }

    const oauthProviderOptions = buildMcpOAuthProviderOptions({ resourceUrl, siteUrl });

    return {
        enabled: true,
        plugins: [
            jwt({ disableSettingJwtHeader: true }),
            oauthProvider(oauthProviderOptions),
            cimd({
                fetchClientMetadataResource: mcpCimdFetch,
                isMetadataDocumentUrlAllowed: (clientIdUrl) => isMcpCimdUrlAllowed(clientIdUrl),
                metadataProfile: 'mcp-2026-07-28'
            }),
            mcpRegistrationRedirectGuard
        ],
        disabledPaths: [...MCP_DISABLED_AUTH_PATHS],
        oauthProviderOptions
    };
}
