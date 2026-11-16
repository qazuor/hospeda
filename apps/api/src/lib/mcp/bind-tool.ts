/**
 * @file bind-tool.ts
 * @description Exposes a transport-agnostic tool definition
 * (`mcp/tools/tool-definition.ts`) over MCP (HOS-2184 T-012): its
 * `tools/list` entry ({@link buildToolListEntry}) and one `tools/call`
 * ({@link handleMcpToolCall}). `tool-handlers.ts` wires both onto the server.
 *
 * Per call, {@link handleMcpToolCall}:
 * 1. takes the caller from the request with `getMcpCaller` (never from a
 *    cookie session);
 * 2. rate limits the call per client and user (`tool-rate-limit.ts`); a call
 *    over the limit is answered with a `RATE_LIMIT_EXCEEDED` tool error, is
 *    not run and is not audited (a flood must not flood the audit log);
 * 3. validates the raw arguments with `parseToolInput`, so a malformed call
 *    is answered with the same Spanish `VALIDATION_ERROR` message (naming the
 *    fields) every other channel gets. The SDK does NOT validate first: the
 *    server answers `tools/call` itself instead of through
 *    `McpServer.registerTool`, whose built-in English validation error
 *    bypassed both this message and the audit;
 * 4. runs the tool with `executeTool` (person-state check, handler, Spanish
 *    error mapping);
 * 5. audits write tools with `recordMcpToolCall` (success, denied or error),
 *    malformed calls included (AC-12: every write call leaves a record);
 * 6. renders the outcome as an MCP result: text content on success,
 *    `isError: true` with the Spanish message on failure, plus
 *    `_meta['mcp/www_authenticate']` when the user must reconnect (spec
 *    §6.3; ChatGPT shows its linking UI on it).
 *
 * It never throws. A thrown error would reach the client as a protocol error
 * carrying internals; everything is caught here and answered with the
 * generic message instead.
 */

import type { CallToolResult, Tool, ToolAnnotations } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { executeTool, parseToolInput, type ToolRunOutcome } from '../../mcp/tools/run-tool';
import type { ToolDefinition, ToolTarget } from '../../mcp/tools/tool-definition';
import {
    TOOL_UNEXPECTED_ERROR_MESSAGE,
    type ToolFailure,
    toToolFailure
} from '../../mcp/tools/tool-errors';
import { buildMcpWwwAuthenticate } from '../../middlewares/mcp-auth';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { getMcpCaller, type McpCallerSource } from './caller';
import { recordMcpToolCall } from './record-tool-call';
import { consumeMcpToolCall } from './tool-rate-limit';

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

/**
 * Shape of a tool `inputSchema` on the wire. Zod types `z.toJSONSchema`
 * output as its own `JSONSchema` interface, which the SDK's JSON-value typing
 * does not accept; parsing it through this schema yields the wire type
 * without a cast (and fails loudly if a converter ever emits non-JSON).
 */
const ToolInputJsonSchema = z
    .object({
        type: z.literal('object'),
        properties: z.record(z.string(), z.json()).optional(),
        required: z.array(z.string()).optional()
    })
    .catchall(z.json());

/**
 * The `inputSchema` a client sees for a definition: the input JSON Schema
 * (draft 2020-12) of its Zod schema. This is the conversion
 * `McpServer.registerTool` published before the server answered `tools/list`
 * itself; `test/lib/mcp/tool-handlers.test.ts` pins the equality.
 *
 * @param args - The definition
 * @returns The JSON Schema of the tool's arguments
 */
export function buildToolInputJsonSchema({
    definition
}: {
    readonly definition: Pick<ToolDefinition, 'inputSchema'>;
}): Tool['inputSchema'] {
    const json = z.toJSONSchema(definition.inputSchema, {
        io: 'input',
        target: 'draft-2020-12'
    });
    return ToolInputJsonSchema.parse({ ...json, type: 'object' });
}

/**
 * The `tools/list` entry of a definition.
 *
 * @param args - The definition
 * @returns Name, title, description, JSON Schema and annotations
 */
export function buildToolListEntry({ definition }: { readonly definition: ToolDefinition }): Tool {
    return {
        name: definition.name,
        title: definition.title,
        description: definition.description,
        inputSchema: buildToolInputJsonSchema({ definition }),
        annotations: buildToolAnnotations({ definition })
    };
}

/** Renders a successful payload: strings as is, anything else as JSON. */
function renderSuccess(data: unknown): CallToolResult {
    const text = typeof data === 'string' ? data : JSON.stringify(data ?? null);
    return { content: [{ type: 'text', text }] };
}

/** The failure of a call refused by the MCP rate limiter. */
function buildRateLimitFailure(): ToolFailure {
    return toToolFailure({
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'MCP rate limit exceeded' }
    });
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
    /** The raw `tools/call` arguments, NOT yet validated. */
    readonly input: unknown;
    /** The SDK's request context (carries the verified caller). */
    readonly ctx: McpCallerSource;
}

/**
 * Serves one MCP call of a tool. Never throws.
 *
 * @param args - Definition, raw arguments and SDK context
 * @returns The MCP tool result
 */
export async function handleMcpToolCall<TSchema extends z.ZodObject, TData>({
    definition,
    input: rawInput,
    ctx
}: HandleMcpToolCallArgs<TSchema, TData>): Promise<CallToolResult> {
    try {
        const { actor, mcpAuth } = getMcpCaller({ ctx });

        const admitted = await consumeMcpToolCall({
            clientId: mcpAuth.clientId,
            userId: actor.id
        });
        if (!admitted) {
            return renderOutcome({ ok: false, failure: buildRateLimitFailure() });
        }

        const parsed = parseToolInput({ definition, input: rawInput });
        const outcome: ToolRunOutcome<TData> = parsed.ok
            ? await executeTool({
                  definition,
                  actor,
                  input: parsed.input,
                  context: { channel: 'mcp', clientId: mcpAuth.clientId }
              })
            : parsed;

        if (definition.isWrite) {
            // The audit readers are typed on VALIDATED input; on a malformed
            // call there is none, so the record carries no target or length.
            const target: ToolTarget | undefined = parsed.ok
                ? readAuditField(() => definition.auditTarget?.({ input: parsed.input }))
                : undefined;
            const contentLength = parsed.ok
                ? readAuditField(() => definition.auditContentLength?.({ input: parsed.input }))
                : undefined;
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
