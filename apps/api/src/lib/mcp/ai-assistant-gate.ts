/**
 * @file ai-assistant-gate.ts
 * @description The `ai_assistant_access` plan gate of every MCP tool call
 * (HOS-2184 phase B, T-040, spec §6.4, AC-14).
 *
 * `handleMcpToolCall` runs it after input parsing, on a well-formed call only,
 * so a malformed call answers `VALIDATION_ERROR` first (the order of
 * `docs/error-contract.md`: input shape before business rules). It answers `undefined` when the call may go on, or the failure to return
 * instead; the handler then never runs. The decision itself is
 * `resolveAiAssistantAccess` (`mcp/access/ai-assistant-access.ts`); this file
 * only turns a "no" into the tool failure the user reads:
 * - refused → `ENTITLEMENT_REQUIRED` with reason
 *   {@link AI_ASSISTANT_NOT_IN_PLAN_REASON}, a Spanish message and a link to the
 *   plans page of the vertical the owner has a plan in (there is no add-on);
 * - undecidable → `SERVICE_UNAVAILABLE`, never a refusal: an outage is not an
 *   upsell.
 *
 * Tools flagged `aiAccessExempt` (`get_help`, `get_my_plan`) skip it, so a
 * refused owner can still read why and see their plan.
 *
 * MCP channel only, on purpose. It lives in the MCP binder, not in
 * `executeTool`, because each assistant channel is gated by its own
 * entitlement key: the WhatsApp channel (HOS-2185) will be gated by its own
 * key at its own entry point, and must not inherit this one. Do not move it
 * into `executeTool`.
 */

import type { PortalLocale } from '@repo/portal-routes';
import { ServiceErrorCode } from '@repo/schemas';
import { resolveAiAssistantAccess } from '../../mcp/access/ai-assistant-access';
import { attachRefusalAction } from '../../mcp/tools/refusal-action';
import type { ToolDefinition, ToolErrorPayload } from '../../mcp/tools/tool-definition';
import { type ToolFailure, toToolFailure } from '../../mcp/tools/tool-errors';

/** `reason` of the refusal when the owner's plans do not include the assistant. */
export const AI_ASSISTANT_NOT_IN_PLAN_REASON = 'AI_ASSISTANT_NOT_IN_PLAN';

/** The Spanish message of {@link AI_ASSISTANT_NOT_IN_PLAN_REASON}. */
export const AI_ASSISTANT_NOT_IN_PLAN_MESSAGE =
    'Tu cuenta de Hospeda no tiene un plan que incluya el asistente de IA. Elegí un plan para seguir usándolo desde tu asistente.';

/** Arguments for {@link checkAiAssistantGate}. RO-RO. */
export interface CheckAiAssistantGateArgs {
    /** The tool being called. */
    readonly definition: Pick<ToolDefinition, 'name' | 'aiAccessExempt'>;
    /** The caller's user id. */
    readonly userId: string;
    /** Locale of the plans link. */
    readonly locale: PortalLocale;
}

/**
 * Runs the plan gate for one call.
 *
 * @param args - The tool, the caller and the link locale
 * @returns `undefined` to go on, or the failure to answer with
 *
 * @example
 * ```typescript
 * const refused = await checkAiAssistantGate({ definition, userId: actor.id, locale });
 * if (refused) return renderOutcome({ ok: false, failure: refused });
 * ```
 */
export async function checkAiAssistantGate({
    definition,
    userId,
    locale
}: CheckAiAssistantGateArgs): Promise<ToolFailure | undefined> {
    if (definition.aiAccessExempt === true) {
        return undefined;
    }
    const access = await resolveAiAssistantAccess({ userId });
    if (access.hasAccess) {
        return undefined;
    }
    if (access.kind === 'UNAVAILABLE') {
        const error: ToolErrorPayload = {
            code: ServiceErrorCode.SERVICE_UNAVAILABLE,
            message: 'AI assistant access could not be decided'
        };
        return toToolFailure({ error });
    }
    const error: ToolErrorPayload = {
        code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
        message: 'AI assistant not in plan',
        reason: AI_ASSISTANT_NOT_IN_PLAN_REASON,
        kind: 'denied',
        link: { destination: { kind: 'plans', vertical: access.vertical } }
    };
    return attachRefusalAction({
        failure: toToolFailure({
            error,
            reasonMessages: { [AI_ASSISTANT_NOT_IN_PLAN_REASON]: AI_ASSISTANT_NOT_IN_PLAN_MESSAGE }
        }),
        error,
        input: undefined,
        definition: { name: definition.name },
        locale
    });
}
