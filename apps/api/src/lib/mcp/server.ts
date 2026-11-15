/**
 * @file server.ts
 * @description The Hospeda MCP server instance factory (HOS-2184 T-010).
 *
 * The `/mcp` endpoint is stateless: `createMcpHandler` calls
 * {@link createHospedaMcpServer} once per HTTP request and discards the
 * instance afterwards. Tools are registered here (T-012+); nothing that must
 * outlive a request (pools, caches) may be created inside the factory.
 */

import { McpServer } from '@modelcontextprotocol/server';
import { MCP_TOOL_DEFINITIONS } from '../../mcp/tools/registry';
import type { ToolDefinition } from '../../mcp/tools/tool-definition';
import { bindMcpTool } from './bind-tool';

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
}

/**
 * Builds a fresh MCP server for one request, with every tool bound through
 * `bindMcpTool`.
 *
 * The `tools` capability is declared even with no tools, and `tools/list`
 * then answers an empty list, so a client sees a valid, empty server instead
 * of a `Method not found`.
 *
 * @param args - Optional tool list (tests)
 * @returns A new, unconnected server instance
 *
 * @example
 * ```typescript
 * const handler = createMcpHandler(() => createHospedaMcpServer());
 * ```
 */
export function createHospedaMcpServer({
    tools = MCP_TOOL_DEFINITIONS
}: CreateHospedaMcpServerArgs = {}): McpServer {
    const server = new McpServer(
        { ...MCP_SERVER_INFO },
        { capabilities: { tools: { listChanged: false } } }
    );
    for (const definition of tools) {
        bindMcpTool({ server, definition });
    }
    return server;
}
