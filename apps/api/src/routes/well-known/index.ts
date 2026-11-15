/**
 * OAuth discovery routes for the MCP server (HOS-2184 T-006).
 *
 * Mounted at the API ROOT (not under `/api/v1`) because OAuth clients derive
 * these URLs from the resource and issuer, per RFC 9728 / RFC 8414 / OIDC
 * Discovery:
 *
 * - `GET /.well-known/oauth-protected-resource` and its `/mcp` alias
 * - `GET /.well-known/oauth-authorization-server`
 * - `GET /.well-known/openid-configuration`
 * - path-inserted aliases for the issuer path (`/api/auth`) of the last two, and
 *   `GET /api/auth/.well-known/openid-configuration`
 *
 * Every route answers the normal 404 while `HOSPEDA_MCP_ENABLED` is not
 * `true` (an unset flag counts as off). The flag is read per request.
 */

import type { Context } from 'hono';
import { getAuth } from '../../lib/auth';
import {
    buildAuthServerMetadataHandler,
    buildOpenIdConfigHandler,
    MCP_AUTH_SERVER_METADATA_ISSUER_PATH,
    MCP_AUTH_SERVER_METADATA_PATH,
    MCP_OPENID_CONFIGURATION_ISSUER_PATH,
    MCP_OPENID_CONFIGURATION_PATH,
    MCP_OPENID_CONFIGURATION_UNDER_ISSUER_PATH,
    MCP_PROTECTED_RESOURCE_ALIAS_PATH,
    MCP_PROTECTED_RESOURCE_PATH,
    protectedResourceMetadataResponse
} from '../../lib/mcp-well-known';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';

/**
 * Whether the MCP server is on. Anything but `true` (including `undefined`) is off.
 */
const isMcpEnabled = (): boolean => env.HOSPEDA_MCP_ENABLED === true;

/**
 * GET handler of the protected-resource document, shared by both paths.
 */
const protectedResourceHandler = async (ctx: Context): Promise<Response> => {
    const resourceUrl = env.HOSPEDA_MCP_RESOURCE_URL;
    if (!isMcpEnabled() || !resourceUrl) {
        return ctx.notFound();
    }
    const { baseURL } = await getAuth().$context;
    return protectedResourceMetadataResponse({ resourceUrl, issuer: baseURL });
};

const wellKnownRoutes = createRouter();

wellKnownRoutes.get(MCP_PROTECTED_RESOURCE_PATH, protectedResourceHandler);
wellKnownRoutes.get(MCP_PROTECTED_RESOURCE_ALIAS_PATH, protectedResourceHandler);

const authServerMetadataHandler = async (ctx: Context): Promise<Response> => {
    if (!isMcpEnabled()) {
        return ctx.notFound();
    }
    return buildAuthServerMetadataHandler({ api: getAuth().api })(ctx.req.raw);
};

const openIdConfigHandler = async (ctx: Context): Promise<Response> => {
    if (!isMcpEnabled()) {
        return ctx.notFound();
    }
    return buildOpenIdConfigHandler({ api: getAuth().api })(ctx.req.raw);
};

wellKnownRoutes.get(MCP_AUTH_SERVER_METADATA_PATH, authServerMetadataHandler);
wellKnownRoutes.get(MCP_AUTH_SERVER_METADATA_ISSUER_PATH, authServerMetadataHandler);
wellKnownRoutes.get(MCP_OPENID_CONFIGURATION_PATH, openIdConfigHandler);
wellKnownRoutes.get(MCP_OPENID_CONFIGURATION_ISSUER_PATH, openIdConfigHandler);
// Registered before the Better Auth catch-all at /api/auth, which would 404 it.
wellKnownRoutes.get(MCP_OPENID_CONFIGURATION_UNDER_ISSUER_PATH, openIdConfigHandler);

export { wellKnownRoutes };
