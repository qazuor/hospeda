/**
 * @file mcp-well-known.ts
 * @description Discovery metadata for the Hospeda MCP server (HOS-2184 T-006).
 *
 * The OAuth 2.1 authorization server is Better Auth (`./auth-mcp-oauth.ts`).
 * This module only adapts its metadata to the API root, where MCP clients look
 * for it (`/.well-known/*`), because Better Auth's own `basePath` is
 * `/api/auth`.
 *
 * - Authorization-server and OpenID metadata come from the package helpers
 *   `oauthProviderAuthServerMetadata` / `oauthProviderOpenIdConfigMetadata`.
 * - RFC 9728 protected-resource metadata has no server-side helper in
 *   `@better-auth/oauth-provider` (only a client one), so it is built here.
 *   `resource` is `HOSPEDA_MCP_RESOURCE_URL` verbatim and
 *   `authorization_servers` is the Better Auth issuer.
 *
 * None of these documents reads the database. They only need the plugins to be
 * registered, which `HOSPEDA_MCP_ENABLED` controls.
 */

import {
    metadataResponse,
    oauthProviderAuthServerMetadata,
    oauthProviderOpenIdConfigMetadata,
    type ResourceServerMetadata
} from '@better-auth/oauth-provider';

/** Path of the RFC 9728 protected-resource metadata document. */
export const MCP_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

/** Path-inserted alias of the protected-resource document for the `/mcp` resource. */
export const MCP_PROTECTED_RESOURCE_ALIAS_PATH = `${MCP_PROTECTED_RESOURCE_PATH}/mcp`;

/** Path of the RFC 8414 authorization-server metadata document. */
export const MCP_AUTH_SERVER_METADATA_PATH = '/.well-known/oauth-authorization-server';

/** Path of the OpenID Connect discovery document. */
export const MCP_OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';

/**
 * Arguments for {@link buildProtectedResourceMetadata}. RO-RO.
 */
export interface BuildProtectedResourceMetadataArgs {
    /** `HOSPEDA_MCP_RESOURCE_URL`, emitted byte for byte as `resource`. */
    readonly resourceUrl: string;
    /** Better Auth issuer (base URL including its `/api/auth` base path). */
    readonly issuer: string;
}

/**
 * Builds the RFC 9728 protected-resource metadata of the MCP server.
 *
 * @param args - Resource URL and authorization-server issuer
 * @returns The metadata document
 *
 * @example
 * ```typescript
 * buildProtectedResourceMetadata({
 *     resourceUrl: 'https://api.hospeda.com.ar/mcp',
 *     issuer: 'https://api.hospeda.com.ar/api/auth'
 * });
 * ```
 */
export function buildProtectedResourceMetadata({
    resourceUrl,
    issuer
}: BuildProtectedResourceMetadataArgs): ResourceServerMetadata {
    return {
        resource: resourceUrl,
        authorization_servers: [issuer],
        bearer_methods_supported: ['header'],
        resource_name: 'Hospeda MCP'
    };
}

/**
 * Builds the JSON response for the protected-resource document.
 *
 * @param args - Resource URL and authorization-server issuer
 * @returns A 200 JSON response with the metadata cache headers of the package
 */
export function protectedResourceMetadataResponse(
    args: BuildProtectedResourceMetadataArgs
): Response {
    return metadataResponse(buildProtectedResourceMetadata(args));
}

/**
 * The two server-only endpoints the oauth-provider plugin adds to `auth.api`.
 * They are not typed on the Better Auth instance because the plugins are
 * registered conditionally.
 */
interface OAuthProviderApi {
    readonly getOAuthServerConfig: (...args: never[]) => unknown;
    readonly getOpenIdConfig: (...args: never[]) => unknown;
}

/**
 * Arguments shared by the request-handler builders. RO-RO.
 */
export interface BuildMetadataHandlerArgs {
    /** The Better Auth `api` object (from `getAuth().api`). */
    readonly api: object;
}

/**
 * Narrows `auth.api` to the oauth-provider endpoints.
 *
 * @throws Error if the oauth-provider plugin is not registered (the flag is
 *   off), which a caller must have ruled out before asking for metadata
 */
function requireOAuthProviderApi({ api }: BuildMetadataHandlerArgs): OAuthProviderApi {
    const candidate = api as Partial<OAuthProviderApi>;
    if (
        typeof candidate.getOAuthServerConfig !== 'function' ||
        typeof candidate.getOpenIdConfig !== 'function'
    ) {
        throw new Error('oauth-provider plugin is not registered on the Better Auth instance');
    }
    return candidate as OAuthProviderApi;
}

/**
 * Builds the handler for `/.well-known/oauth-authorization-server`.
 *
 * @param args - The Better Auth `api` object
 * @returns A fetch-style handler returning the metadata response
 */
export function buildAuthServerMetadataHandler(
    args: BuildMetadataHandlerArgs
): (request: Request) => Promise<Response> {
    const api = requireOAuthProviderApi(args);
    return oauthProviderAuthServerMetadata({ api });
}

/**
 * Builds the handler for `/.well-known/openid-configuration`.
 *
 * @param args - The Better Auth `api` object
 * @returns A fetch-style handler returning the metadata response
 */
export function buildOpenIdConfigHandler(
    args: BuildMetadataHandlerArgs
): (request: Request) => Promise<Response> {
    const api = requireOAuthProviderApi(args);
    return oauthProviderOpenIdConfigMetadata({ api });
}
