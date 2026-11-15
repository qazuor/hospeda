/**
 * @file bind-tool.ts
 * @description Exposes a transport-agnostic tool definition
 * (`mcp/tools/tool-definition.ts`) on an `McpServer` (HOS-2184 T-012).
 *
 * The binding is deliberately thin. Per call it:
 * 1. lets the SDK validate the arguments against `inputSchema` (an invalid
 *    call never reaches the handler);
 * 2. takes the caller from the request with `getMcpCaller` (never from a
 *    cookie session);
 * 3. runs the tool with `executeTool` (person-state check, handler, Spanish
 *    error mapping);
 * 4. audits write tools with `recordMcpToolCall` (success, denied or error);
 * 5. renders the outcome as an MCP result: text content on success,
 *    `isError: true` with the Spanish message on failure, plus
 *    `_meta['mcp/www_authenticate']` when the user must reconnect (spec
 *    §6.3; ChatGPT shows its linking UI on it).
 *
 * The callback never throws. The SDK turns a thrown error into an `isError`
 * result carrying `error.message`, which would leak internals; everything is
 * caught here and answered with the generic message instead.
 */

import type { CallToolResult, McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { executeTool, type ToolRunOutcome } from '../../mcp/tools/run-tool';
import type { ToolDefinition, ToolTarget } from '../../mcp/tools/tool-definition';
import { TOOL_UNEXPECTED_ERROR_MESSAGE } from '../../mcp/tools/tool-errors';
import { buildMcpWwwAuthenticate } from '../../middlewares/mcp-auth';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { getMcpCaller, type McpCallerSource } from './caller';
import { recordMcpToolCall } from './record-tool-call';

/** `_meta` key ChatGPT reads to start the OAuth linking UI. */
export const MCP_WWW_AUTHENTICATE_META_KEY = 'mcp/www_authenticate';

/**
 * `error_description` of the re-authentication challenge. ASCII only
 * (RFC 6750 §3); the user-facing Spanish text is in the result content.
 */
const REAUTH_ERROR_DESCRIPTION = 'Reconnect your Hospeda account to continue';

/**
 * Builds the challenge carried in `_meta['mcp/www_authenticate']`. It is the
 * same challenge the `/mcp` endpoint sends on a 401, plus the
 * `error_description` ChatGPT requires.
 *
 * @param args - `HOSPEDA_API_URL`
 * @returns The challenges, as the array form ChatGPT accepts
 */
export function buildToolReauthChallenge({ apiUrl }: { readonly apiUrl: string }): string[] {
    const challenge = buildMcpWwwAuthenticate({ apiUrl, invalidToken: true });
    return [`${challenge}, error_description="${REAUTH_ERROR_DESCRIPTION}"`];
}

/**
 * Translates a definition's kind and hints into MCP annotations.
 * `readOnlyHint` always mirrors `isWrite`; write-only hints are dropped on
 * read tools, where the MCP spec gives them no meaning.
 *
 * @param args - The definition
 * @returns The MCP tool annotations
 */
export function buildToolAnnotations({
    definition
}: {
    readonly definition: Pick<ToolDefinition, 'title' | 'isWrite' | 'hints'>;
}): ToolAnnotations {
    const { title, isWrite, hints } = definition;
    return {
        title,
        readOnlyHint: !isWrite,
        openWorldHint: hints?.openWorldHint ?? false,
        ...(isWrite && hints?.destructiveHint !== undefined
            ? { destructiveHint: hints.destructiveHint }
            : {}),
        ...(isWrite && hints?.idempotentHint !== undefined
            ? { idempotentHint: hints.idempotentHint }
            : {})
    };
}

/** Renders a successful payload: strings as is, anything else as JSON. */
function renderSuccess(data: unknown): CallToolResult {
    const text = typeof data === 'string' ? data : JSON.stringify(data ?? null);
    return { content: [{ type: 'text', text }] };
}

/** Renders a run outcome as an MCP tool result. */
function renderOutcome<TData>(outcome: ToolRunOutcome<TData>): CallToolResult {
    if (outcome.ok) {
        return renderSuccess(outcome.data);
    }
    const { failure } = outcome;
    return {
        content: [{ type: 'text', text: failure.message }],
        isError: true,
        ...(failure.requiresReauthentication
            ? {
                  _meta: {
                      [MCP_WWW_AUTHENTICATE_META_KEY]: buildToolReauthChallenge({
                          apiUrl: env.HOSPEDA_API_URL
                      })
                  }
              }
            : {})
    };
}

/** The generic failure result, for errors outside `executeTool`. */
function unexpectedResult(): CallToolResult {
    return { content: [{ type: 'text', text: TOOL_UNEXPECTED_ERROR_MESSAGE }], isError: true };
}

/** Reads an optional audit field; a throwing reader yields `undefined`. */
function readAuditField<T>(read: () => T | undefined): T | undefined {
    try {
        return read();
    } catch {
        return undefined;
    }
}

/** Arguments for {@link handleMcpToolCall}. RO-RO. */
export interface HandleMcpToolCallArgs<TSchema extends z.ZodObject, TData> {
    /** The tool. */
    readonly definition: ToolDefinition<TSchema, TData>;
    /** Arguments the SDK validated against `definition.inputSchema`. */
    readonly input: z.output<TSchema>;
    /** The SDK's tool context (carries the verified caller). */
    readonly ctx: McpCallerSource;
}

/**
 * Serves one MCP call of a tool. Exported for tests; production code uses
 * {@link bindMcpTool}. Never throws.
 *
 * @param args - Definition, validated input and SDK context
 * @returns The MCP tool result
 */
export async function handleMcpToolCall<TSchema extends z.ZodObject, TData>({
    definition,
    input,
    ctx
}: HandleMcpToolCallArgs<TSchema, TData>): Promise<CallToolResult> {
    try {
        const { actor, mcpAuth } = getMcpCaller({ ctx });
        const outcome = await executeTool({
            definition,
            actor,
            input,
            context: { channel: 'mcp' }
        });

        if (definition.isWrite) {
            const target: ToolTarget | undefined = readAuditField(() =>
                definition.auditTarget?.({ input })
            );
            const contentLength = readAuditField(() => definition.auditContentLength?.({ input }));
            recordMcpToolCall({
                actor,
                mcpAuth,
                tool: definition.name,
                outcome: outcome.ok ? 'success' : outcome.failure.kind,
                ...(target ? { target } : {}),
                ...(outcome.ok ? {} : { errorCode: String(outcome.failure.code) }),
                ...(contentLength === undefined ? {} : { contentLength })
            });
        }

        return renderOutcome(outcome);
    } catch (error) {
        try {
            apiLogger.error(
                {
                    tool: definition.name,
                    error: error instanceof Error ? error.message : String(error)
                },
                'MCP tool binding failed'
            );
        } catch {
            // Logging must not break the tool call.
        }
        return unexpectedResult();
    }
}

/** Arguments for {@link bindMcpTool}. RO-RO. */
export interface BindMcpToolArgs<TSchema extends z.ZodObject, TData> {
    /** The server to register on. */
    readonly server: McpServer;
    /** The tool. */
    readonly definition: ToolDefinition<TSchema, TData>;
}

/**
 * Registers a tool definition on an MCP server.
 *
 * @param args - Server and definition
 *
 * @example
 * ```typescript
 * for (const definition of MCP_TOOL_DEFINITIONS) bindMcpTool({ server, definition });
 * ```
 */
export function bindMcpTool<TSchema extends z.ZodObject, TData>({
    server,
    definition
}: BindMcpToolArgs<TSchema, TData>): void {
    // TYPE-WORKAROUND: the SDK picks its callback signature with a conditional
    // type over the schema, which TypeScript cannot resolve for a generic
    // TSchema. Registering the schema as the concrete `z.ZodObject` resolves
    // it; `input` is then cast back, which is sound because the SDK has just
    // parsed it with this very schema.
    const inputSchema: z.ZodObject = definition.inputSchema;
    server.registerTool(
        definition.name,
        {
            title: definition.title,
            description: definition.description,
            inputSchema,
            annotations: buildToolAnnotations({ definition })
        },
        (input, ctx) => handleMcpToolCall({ definition, input: input as z.output<TSchema>, ctx })
    );
}
