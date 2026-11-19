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
 * 5. audits every call that reached step 3, read or write, with
 *    `recordMcpToolCall` (success, denied or error), malformed calls included
 *    (AC-12; D-12 of HOS-2335 added reads and the `isWrite` flag). A
 *    rate-limited call and a crash inside this binder leave no record (R-16);
 * 6. renders the outcome as an MCP result: text content on success,
 *    `isError: true` with the Spanish message on failure (and, when the
 *    refusal has a portal page, its URL on a last line of the text and in
 *    `structuredContent.action`, HOS-2326), plus
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
import { resolveRecipientLocale } from '../../services/notification-recipient-locale';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { getMcpCaller, type McpCaller, type McpCallerSource } from './caller';
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

/**
 * Line that introduces the portal link in a refusal's text. The text is
 * authoritative: some clients ignore `structuredContent` when a tool has no
 * `outputSchema`, so the URL must be readable from `content` alone.
 */
export const REFUSAL_ACTION_LINE_PREFIX = 'Podés hacerlo acá:';

/** The text of a failure: its message, plus the portal link on its own last line. */
function renderFailureText(failure: ToolFailure): string {
    return failure.action
        ? `${failure.message}\n${REFUSAL_ACTION_LINE_PREFIX} ${failure.action.url}`
        : failure.message;
}

/** The machine-readable twin of the failure's link and help topic, when it has either. */
function renderFailureStructuredContent(failure: ToolFailure): CallToolResult['structuredContent'] {
    if (failure.action === undefined && failure.helpTopicId === undefined) {
        return undefined;
    }
    return {
        ...(failure.action === undefined ? {} : { action: failure.action }),
        ...(failure.helpTopicId === undefined ? {} : { helpTopicId: failure.helpTopicId })
    };
}

/** Renders a run outcome as an MCP tool result. */
function renderOutcome<TData>(outcome: ToolRunOutcome<TData>): CallToolResult {
    if (outcome.ok) {
        return renderSuccess(outcome.data);
    }
    const { failure } = outcome;
    const structuredContent = renderFailureStructuredContent(failure);
    return {
        content: [{ type: 'text', text: renderFailureText(failure) }],
        isError: true,
        ...(structuredContent === undefined ? {} : { structuredContent }),
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

/** Arguments for {@link recordToolCall}. RO-RO. */
interface RecordToolCallArgs<TSchema extends z.ZodObject, TData> extends McpCaller {
    /** The tool. */
    readonly definition: ToolDefinition<TSchema, TData>;
    /** What `parseToolInput` answered. */
    readonly parsed:
        | { readonly ok: true; readonly input: z.output<TSchema> }
        | { readonly ok: false };
    /** How the call ended. */
    readonly outcome: ToolRunOutcome<TData>;
}

/**
 * Audits one call that reached `parseToolInput`, read or write (D-12,
 * HOS-2348). A write carries its target (the created entity first), its
 * content length and its details; a read carries its `auditTarget` only, so a
 * read row never holds a length or a detail. `isWrite` is recorded so the
 * history can tell the two apart.
 *
 * `recordMcpToolCall` is synchronous and fire-and-forget: the extra insert a
 * read now costs never delays or fails the tool result.
 *
 * @param args - Definition, caller, parse result and run outcome
 */
function recordToolCall<TSchema extends z.ZodObject, TData>({
    definition,
    actor,
    mcpAuth,
    parsed,
    outcome
}: RecordToolCallArgs<TSchema, TData>): void {
    const { isWrite } = definition;
    // The audit readers are typed on VALIDATED input; on a malformed call
    // there is none, so the record carries no target, length or details.
    const resultTarget: ToolTarget | undefined =
        isWrite && parsed.ok && outcome.ok
            ? readAuditField(() =>
                  definition.auditResultTarget?.({ input: parsed.input, data: outcome.data })
              )
            : undefined;
    const target: ToolTarget | undefined =
        resultTarget ??
        (parsed.ok
            ? readAuditField(() => definition.auditTarget?.({ input: parsed.input }))
            : undefined);
    const contentLength =
        isWrite && parsed.ok
            ? readAuditField(() => definition.auditContentLength?.({ input: parsed.input }))
            : undefined;
    const details =
        isWrite && parsed.ok
            ? readAuditField(() => definition.auditDetails?.({ input: parsed.input }))
            : undefined;
    recordMcpToolCall({
        actor,
        mcpAuth,
        tool: definition.name,
        isWrite,
        outcome: outcome.ok ? 'success' : outcome.failure.kind,
        ...(target ? { target } : {}),
        ...(outcome.ok
            ? {}
            : { errorCode: outcome.failure.auditCode ?? String(outcome.failure.code) }),
        ...(contentLength === undefined ? {} : { contentLength }),
        ...(details ? { details } : {})
    });
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

        // Once per call: every portal link of the answer carries the user's web
        // language. Falls back to `es`, never throws.
        const locale = await resolveRecipientLocale({ userId: actor.id });

        const parsed = parseToolInput({ definition, input: rawInput, locale });
        const outcome: ToolRunOutcome<TData> = parsed.ok
            ? await executeTool({
                  definition,
                  actor,
                  input: parsed.input,
                  context: { channel: 'mcp', clientId: mcpAuth.clientId, locale }
              })
            : parsed;

        recordToolCall({ definition, actor, mcpAuth, parsed, outcome });

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
