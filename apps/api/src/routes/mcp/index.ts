/**
 * The MCP Streamable HTTP endpoint (HOS-2184 T-010, spec §6.4).
 *
 * Mounted at the API ROOT (`/mcp`), not under `/api/v1`: the URL a user pastes
 * into Claude or ChatGPT is the resource itself, and it must equal
 * `HOSPEDA_MCP_RESOURCE_URL` byte for byte (AC-4).
 *
 * Composition (OQ-3): the SDK's `createMcpHandler` is a web-standard
 * `fetch(request, { authInfo })` face, so it composes with the Hono app as a
 * plain handler over `c.req.raw`. `createMcpHonoApp` from
 * `@modelcontextprotocol/hono` is NOT used: it builds a separate Hono app with
 * its own JSON body parser and a localhost-only Host/Origin check meant for
 * local servers, while this endpoint lives inside the API's middleware stack.
 *
 * - **Auth + flag.** `mcpAuthMiddleware` runs first, on each method's own
 *   registration: flag off → the normal 404; no or bad token → 401 with
 *   `WWW-Authenticate`. Its result is handed to the SDK as `authInfo`
 *   (`lib/mcp/caller.ts`), which tools read back with `getMcpCaller`.
 * - **Stateless.** One server instance per request (`lib/mcp/server.ts`).
 *   2025-era clients are served by the SDK's stateless legacy fallback, which
 *   answers GET and DELETE (session operations) with `405`. All three methods
 *   are routed here so that answer comes from the SDK and not from the app's
 *   404.
 * - **Origin (DNS rebinding).** POST and DELETE carrying a foreign `Origin`
 *   are refused with 403 by the global `originVerificationMiddleware` before
 *   reaching this route. Requests without `Origin` (every server-side MCP
 *   client) pass, as the MCP spec allows.
 * - **Headers.** The global validation middleware skips `/mcp`
 *   (`exactPublicPaths`); the SDK validates `Accept` (406) and `Content-Type`
 *   (415) itself, per the transport spec.
 */

import { createMcpHandler } from '@modelcontextprotocol/server';
import type { Context } from 'hono';
import { readBearerToken } from '../../lib/mcp/bearer-token';
import { buildMcpAuthInfo } from '../../lib/mcp/caller';
import { createHospedaMcpServer } from '../../lib/mcp/server';
import { MCP_ENDPOINT_PATH } from '../../lib/mcp-well-known';
import { createMcpAuthMiddleware } from '../../middlewares/mcp-auth';
import type { AppBindings } from '../../types';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';

/** HTTP methods of the Streamable HTTP transport. */
const MCP_METHODS = ['GET', 'POST', 'DELETE'] as const;

/** The SDK handler. Holds no per-caller state; instances are per request. */
const mcpHandler = createMcpHandler(() => createHospedaMcpServer({ apiUrl: env.HOSPEDA_API_URL }), {
    onerror: (error) => {
        apiLogger.warn(`MCP handler error: [${error.name}] ${error.message}`);
    }
});

/**
 * Serves one authenticated MCP request. Only reached after
 * `mcpAuthMiddleware` accepted the token, so `actor`, `mcpAuth`, the bearer
 * token and the resource URL are all present.
 */
const mcpRequestHandler = async (c: Context<AppBindings>): Promise<Response> => {
    const token = readBearerToken({ authorization: c.req.header('Authorization') });
    const mcpAuth = c.get('mcpAuth');
    const resourceUrl = env.HOSPEDA_MCP_RESOURCE_URL;
    if (!token || !mcpAuth || !resourceUrl) {
        throw new Error('MCP route reached without a verified MCP request');
    }
    const authInfo = buildMcpAuthInfo({ token, actor: c.get('actor'), mcpAuth, resourceUrl });
    return mcpHandler.fetch(c.req.raw, { authInfo });
};

const mcpRoutes = createRouter();

mcpRoutes.on([...MCP_METHODS], MCP_ENDPOINT_PATH, createMcpAuthMiddleware(), mcpRequestHandler);

export { mcpRoutes };
