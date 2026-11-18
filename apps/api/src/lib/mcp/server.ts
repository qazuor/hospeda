/**
 * @file server.ts
 * @description The Hospeda MCP server instance factory (HOS-2184 T-010).
 *
 * The `/mcp` endpoint is stateless: `createMcpHandler` calls
 * {@link createHospedaMcpServer} once per HTTP request and discards the
 * instance afterwards. Tools are registered here (T-012+); nothing that must
 * outlive a request (pools, caches) may be created inside the factory.
 */

import { Server } from '@modelcontextprotocol/server';
import { MCP_TOOL_DEFINITIONS } from '../../mcp/tools/registry';
import type { ToolDefinition } from '../../mcp/tools/tool-definition';
import { buildBrandIcons } from '../brand-icon/brand-icon';
import { registerMcpToolHandlers } from './tool-handlers';

/**
 * `serverInfo` the MCP server reports in the `initialize` result.
 *
 * `title` matches `resource_name` in the protected-resource metadata
 * (`lib/mcp-well-known.ts`). `version` is the version of the tool surface
 * (spec §6.5 "Tools (v1)"), not of the API package.
 */
export const MCP_SERVER_INFO = {
    name: 'hospeda',
    title: 'Hospeda MCP',
    version: '1.0.0'
} as const;

/** Arguments for {@link createHospedaMcpServer}. RO-RO. */
export interface CreateHospedaMcpServerArgs {
    /** Tools to register. Defaults to the registry (`mcp/tools/registry.ts`). */
    readonly tools?: readonly ToolDefinition[];
    /**
     * Public base URL of the API (`HOSPEDA_API_URL`). When set, the server
     * declares the Hospeda icon in its `serverInfo` (`icons`, MCP spec
     * 2025-11-25) so clients can show it next to the connector.
     */
    readonly apiUrl?: string;
}

/**
 * Builds a fresh MCP server for one request, answering `tools/list` and
 * `tools/call` from the tool definitions (`tool-handlers.ts`).
 *
 * It is the low-level `Server`, not `McpServer`: `McpServer` validates tool
 * arguments itself, in English and before the audit (see
 * `tool-handlers.ts`).
 *
 * The `tools` capability is declared even with no tools, and `tools/list`
 * then answers an empty list, so a client sees a valid, empty server instead
 * of a `Method not found`.
 *
 * @param args - Optional tool list (tests) and the API public URL (icon)
 * @returns A new, unconnected server instance
 *
 * @example
 * ```typescript
 * const handler = createMcpHandler(() => createHospedaMcpServer());
 * ```
 */
export function createHospedaMcpServer({
    tools = MCP_TOOL_DEFINITIONS,
    apiUrl
}: CreateHospedaMcpServerArgs = {}): Server {
    const server = new Server(
        {
            ...MCP_SERVER_INFO,
            ...(apiUrl ? { icons: buildBrandIcons({ apiUrl }) } : {})
        },
        {
            capabilities: { tools: { listChanged: false } },
            // HOS-2247, owner decision D-18: only the 2026-07-28 round trip.
            // With the shim on, an `input_required` answered to a 2025-era
            // request would become a server-to-client elicitation push; off,
            // it fails loudly instead. No tool asks a 2025-era client anyway
            // (`lib/mcp/elicitation.ts` treats those clients as unsupported).
            inputRequired: { legacyShim: false }
        }
    );
    registerMcpToolHandlers({ server, tools });
    return server;
}
