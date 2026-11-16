/**
 * @file tool-handlers.ts
 * @description Answers `tools/list` and `tools/call` on the low-level MCP
 * `Server` from the tool definitions (HOS-2184 T-012).
 *
 * Why not `McpServer.registerTool`: it validates the arguments against the
 * input schema BEFORE the tool callback runs and answers a mismatch with its
 * own English `isError` text. That skipped the Spanish `VALIDATION_ERROR`
 * message (spec) and the audit of malformed write calls (AC-12). Owning both
 * methods on the low-level `Server` (the SDK's documented low-level path, see
 * `docs/advanced/low-level-server.md` of `@modelcontextprotocol/server`)
 * routes every call, malformed or not, through `handleMcpToolCall`.
 *
 * `createMcpHandler` accepts a `Server` from the factory as well as an
 * `McpServer`, and hands `authInfo` to request handlers as
 * `ctx.http.authInfo` the same way.
 */

import { ProtocolError, ProtocolErrorCode, type Server } from '@modelcontextprotocol/server';
import type { ToolDefinition } from '../../mcp/tools/tool-definition';
import { buildToolListEntry, handleMcpToolCall } from './bind-tool';

/** Arguments for {@link registerMcpToolHandlers}. RO-RO. */
export interface RegisterMcpToolHandlersArgs {
    /** A server constructed with the `tools` capability (required by the SDK). */
    readonly server: Server;
    /** The tools to serve. Names must be unique. */
    readonly tools: readonly ToolDefinition[];
}

/**
 * Registers the `tools/list` and `tools/call` handlers.
 *
 * - `tools/list` publishes every definition (name, title, description, input
 *   JSON Schema, annotations).
 * - `tools/call` for an unknown name answers the JSON-RPC `-32602` error the
 *   MCP spec prescribes for an unknown tool (and `McpServer` used to send).
 *   Every other call goes through `handleMcpToolCall`, which never throws.
 *
 * @param args - Server and tools
 * @throws Error when two definitions share a name (a wiring bug)
 *
 * @example
 * ```typescript
 * const server = new Server(info, { capabilities: { tools: { listChanged: false } } });
 * registerMcpToolHandlers({ server, tools: MCP_TOOL_DEFINITIONS });
 * ```
 */
export function registerMcpToolHandlers({ server, tools }: RegisterMcpToolHandlersArgs): void {
    const byName = new Map<string, ToolDefinition>();
    for (const definition of tools) {
        if (byName.has(definition.name)) {
            throw new Error(`Duplicate MCP tool name: ${definition.name}`);
        }
        byName.set(definition.name, definition);
    }
    // Built on demand: a server instance lives for one request, and most
    // requests are `tools/call`, which never needs the JSON Schemas.
    server.setRequestHandler('tools/list', () => ({
        tools: tools.map((definition) => buildToolListEntry({ definition }))
    }));

    server.setRequestHandler('tools/call', async (request, ctx) => {
        const definition = byName.get(request.params.name);
        if (!definition) {
            throw new ProtocolError(
                ProtocolErrorCode.InvalidParams,
                `Tool ${request.params.name} not found`
            );
        }
        const result = await handleMcpToolCall({
            definition,
            input: request.params.arguments,
            ctx
        });
        // The SDK asks low-level `tools/call` authors to project the result
        // through the negotiated wire codec themselves. No tool declares an
        // output schema.
        return server.projectCallToolResult(result, undefined);
    });
}
