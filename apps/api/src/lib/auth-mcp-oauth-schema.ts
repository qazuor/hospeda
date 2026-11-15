/**
 * @file auth-mcp-oauth-schema.ts
 * @description Drizzle adapter schema entries for the MCP OAuth authorization
 * server's tables (HOS-2184 T-005).
 *
 * The `jwt()` and `oauthProvider()` plugins registered by
 * `buildMcpOAuthConfig` declare eight models. Better Auth's Drizzle adapter
 * finds a model's table by the key it is passed under, so each key here is the
 * plugin's model name exactly. `auth.ts` spreads this map into the adapter
 * schema only when `HOSPEDA_MCP_ENABLED` is on, so with the flag off the
 * adapter receives exactly the four core tables it received before.
 *
 * Kept apart from `auth-mcp-oauth.ts` so that file stays free of `@repo/db`.
 *
 * The map is built by a function, not a module-level constant, so the
 * `@repo/db` bindings are read when `getAuth()` builds the adapter — the same
 * moment `auth.ts` reads `users`, `sessions`, `accounts` and `verifications`.
 * A module-level object would dereference all eight tables the instant
 * `lib/auth` is imported, which nothing else in that file does.
 */

import {
    jwks,
    oauthAccessTokens,
    oauthClientAssertions,
    oauthClientResources,
    oauthClients,
    oauthConsents,
    oauthRefreshTokens,
    oauthResources
} from '@repo/db';

/**
 * Plugin model name → Drizzle table, for the Better Auth Drizzle adapter.
 *
 * `jwks` comes from `jwt()`; the `oauth*` models from `oauthProvider()`.
 *
 * @returns The adapter schema entries for the eight MCP OAuth models.
 */
export function getMcpOAuthAdapterSchema() {
    return {
        jwks,
        oauthClient: oauthClients,
        oauthAccessToken: oauthAccessTokens,
        oauthRefreshToken: oauthRefreshTokens,
        oauthConsent: oauthConsents,
        oauthClientAssertion: oauthClientAssertions,
        oauthResource: oauthResources,
        oauthClientResource: oauthClientResources
    } as const;
}
