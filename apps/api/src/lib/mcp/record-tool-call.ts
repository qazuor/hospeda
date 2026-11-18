/**
 * @file record-tool-call.ts
 * @description Audit record for MCP tool calls (HOS-2184 T-011, AC-12, OQ-4).
 *
 * Reuses the existing `auditLog()` pipeline, which persists to
 * `audit_log_entries`. No new table.
 */

import type { Actor } from '@repo/service-core';
import type { McpAuthContext } from '../../types';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { apiLogger } from '../../utils/logger';

/** Outcome of an MCP tool call. */
export type McpToolCallOutcome = 'success' | 'denied' | 'error';

/** Input of {@link recordMcpToolCall}. */
export interface RecordMcpToolCallInput {
    /** Actor the call ran as. */
    readonly actor: Pick<Actor, 'id'>;
    /** OAuth grant of the request (`c.get('mcpAuth')`). */
    readonly mcpAuth: Pick<McpAuthContext, 'clientId'>;
    /** MCP tool name. */
    readonly tool: string;
    /**
     * Whether the tool writes (`definition.isWrite`). Reads are recorded too
     * since D-12 of HOS-2335; a row without the field predates it and was a
     * write, because only writes were recorded then.
     */
    readonly isWrite: boolean;
    /** Entity the call targeted. Omit for calls with no single target (lists). */
    readonly target?: { readonly type: string; readonly id: string };
    /** Result of the call. */
    readonly outcome: McpToolCallOutcome;
    /** Error code, for `denied` and `error` outcomes. */
    readonly errorCode?: string;
    /** Length of user content carried (e.g. a reply). Never pass the content. */
    readonly contentLength?: number;
    /** Scalar extras the tool contributed (e.g. `{ step: 'preview' }`). Never user content. */
    readonly details?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Records one MCP tool call in the audit log: actor, OAuth client id, tool,
 * target and outcome. The client name is not recorded: the client declares it itself, so
 * it is untrusted text (the revoke audit leaves it out for the same reason).
 *
 * Failure policy: auditing must never change what the tool returns. This
 * function is synchronous, never throws, and never returns a value the caller
 * could branch on. If building or writing the record fails, the failure is
 * logged through `apiLogger` (ids only, no token and no content) and swallowed.
 *
 * Call it exactly once per tool call, after the outcome is known, without
 * awaiting anything on its account.
 *
 * @param input - See {@link RecordMcpToolCallInput}.
 *
 * @example
 * ```ts
 * recordMcpToolCall({
 *   actor,
 *   mcpAuth,
 *   tool: 'reply_to_conversation',
 *   isWrite: true,
 *   target: { type: 'conversation', id: conversationId },
 *   outcome: 'success',
 *   contentLength: text.length
 * });
 * ```
 */
export function recordMcpToolCall(input: RecordMcpToolCallInput): void {
    const { actor, mcpAuth, tool, isWrite, target, outcome, errorCode, contentLength, details } =
        input;
    try {
        auditLog({
            auditEvent: AuditEventType.MCP_TOOL_CALL,
            actorId: actor.id,
            clientId: mcpAuth.clientId,
            tool,
            isWrite,
            ...(target ? { resourceType: target.type, resourceId: target.id } : {}),
            outcome,
            ...(errorCode === undefined ? {} : { errorCode }),
            ...(contentLength === undefined ? {} : { contentLength }),
            ...(details ? { details } : {})
        });
    } catch (error) {
        try {
            apiLogger.error(
                {
                    tool,
                    clientId: mcpAuth.clientId,
                    outcome,
                    error: error instanceof Error ? error.message : String(error)
                },
                'MCP audit record failed; tool result unchanged'
            );
        } catch {
            // Logging must not break the tool call either.
        }
    }
}
