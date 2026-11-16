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
    readonly mcpAuth: Pick<McpAuthContext, 'clientId' | 'clientName'>;
    /** MCP tool name. */
    readonly tool: string;
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
 * Records one MCP tool call in the audit log: actor, OAuth client id and name,
 * tool, target and outcome.
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
 *   target: { type: 'conversation', id: conversationId },
 *   outcome: 'success',
 *   contentLength: text.length
 * });
 * ```
 */
export function recordMcpToolCall(input: RecordMcpToolCallInput): void {
    const { actor, mcpAuth, tool, target, outcome, errorCode, contentLength, details } = input;
    try {
        auditLog({
            auditEvent: AuditEventType.MCP_TOOL_CALL,
            actorId: actor.id,
            clientId: mcpAuth.clientId,
            clientName: mcpAuth.clientName,
            tool,
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
