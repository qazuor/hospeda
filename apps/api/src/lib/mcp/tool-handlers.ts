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
import { isToolVisibleTo } from '../../mcp/tools/tool-visibility';
import { buildToolListEntry, handleMcpToolCall } from './bind-tool';
import { getMcpCaller, type McpCallerSource } from './caller';

/**
 * Whether the caller of a `tools/call` may see the tool. A request with no
 * caller is let through: `handleMcpToolCall` answers it with the generic
 * error, as before visibility existed.
 */
function isVisibleToCaller({
    definition,
    ctx
}: {
    readonly definition: ToolDefinition;
    readonly ctx: McpCallerSource;
}): boolean {
    let caller: ReturnType<typeof getMcpCaller>;
    try {
        caller = getMcpCaller({ ctx });
    } catch {
        return true;
    }
    return isToolVisibleTo({ definition, actor: caller.actor });
}

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
 * - `tools/list` publishes the definitions the caller may see (name, title,
 *   description, input JSON Schema, annotations): those whose
 *   `requiredPermissions` the actor satisfies (HOS-2184 T-042,
 *   `tool-visibility.ts`).
 * - `tools/call` for an unknown name, or for a tool the caller may not see,
 *   answers the JSON-RPC `-32602` error the MCP spec prescribes for an unknown
 *   tool (and `McpServer` used to send): a hidden tool is indistinguishable
 *   from a missing one. Every other call goes through `handleMcpToolCall`,
 *   which never throws.
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
    server.setRequestHandler('tools/list', (_request, ctx) => {
        // No caller means `/mcp` was wired without its auth middleware: fail
        // the request (getMcpCaller throws) rather than publish every tool.
        const { actor } = getMcpCaller({ ctx });
        return {
            tools: tools
                .filter((definition) => isToolVisibleTo({ definition, actor }))
                .map((definition) => buildToolListEntry({ definition }))
        };
    });

    server.setRequestHandler('tools/call', async (request, ctx) => {
        const definition = byName.get(request.params.name);
        if (!definition || !isVisibleToCaller({ definition, ctx })) {
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
