/**
 * @file elicitation-confirmation.ts
 * @description Out-of-band confirmation for token-confirmed write tools
 * (HOS-2247, spec §5.7, owner decisions D-17 and D-18). Transport-agnostic:
 * imports nothing from `lib/mcp/` (HOS-2185 reuse).
 *
 * A covered tool asks {@link planConfirmation} what this call is:
 *
 * | client | call carries | plan |
 * |---|---|---|
 * | no capability, or the tool is relaxed | no token | token preview (unchanged) |
 * | no capability, or the tool is relaxed | a token | token commit (unchanged) |
 * | capable, tool strict | nothing | elicitation preview: bind a state, ask the client |
 * | capable, tool strict | a token | refused, nothing written (D-17) |
 * | capable, tool strict | an answer, `confirm` | elicitation commit |
 * | capable, tool strict | an answer, anything else | declined, nothing written |
 *
 * **The state.** {@link issueConfirmationState} stores the call's binding
 * `(userId, clientId, tool, subjectId, sha256(canonicalJson(payload)))` (plus an
 * optional stash) in the SAME store as the confirmation tokens
 * (`confirmation-token-store.ts`), under its own prefix `mcp:elicit:<tool>:`.
 * The id the client receives is the store's random 256-bit key and nothing
 * else: there is nothing to sign, and integrity is the store's (TTL 600 s,
 * single-use `GETDEL`, burnt on mismatch, fail closed without Redis).
 *
 * **The retry is attacker-controlled.** The echoed state id and the answer
 * come from the client. {@link settleConfirmationAnswer} consumes the record
 * with the binding recomputed from the RETRIED arguments, so a forged,
 * replayed, expired, foreign or altered retry finds nothing, is refused with
 * the same answer every time, and burns whatever it touched. A decline or a
 * cancel burns the record too, and writes nothing.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { CanonicalJsonValue } from './canonical-json';
import {
    type ConfirmationBinding,
    type ConfirmationStoreDeps,
    consumeConfirmationToken,
    discardConfirmationToken,
    issueConfirmationToken
} from './confirmation-token-store';
import {
    ELICITATION_STRICT,
    ELICITATION_TOOL_NAMES,
    type ElicitationToolName
} from './elicitation-policy';
import type {
    ToolAuditDetails,
    ToolConfirmationContext,
    ToolContext,
    ToolErrorPayload,
    ToolHandlerResult,
    ToolNeedsConfirmation
} from './tool-definition';

/** Reason of the refusal of a state that cannot be used (any cause, one answer). */
export const ELICITATION_STATE_INVALID_REASON = 'ELICITATION_STATE_INVALID';

/** Reason of the refusal of a token sent by a client that must confirm through its form. */
export const CONFIRMATION_TOKEN_REFUSED_REASON = 'CONFIRMATION_TOKEN_REFUSED';

/** Spanish messages of the two reasons above. Covered tools spread them into their own. */
export const ELICITATION_REASON_MESSAGES: Readonly<Record<string, string>> = {
    [ELICITATION_STATE_INVALID_REASON]:
        'La confirmación no es válida: venció, ya se usó o algún dato cambió. No se hizo ningún cambio. Volvé a llamar a la herramienta con los datos que el usuario quiere, para que su aplicación le pida confirmarlos de nuevo.',
    [CONFIRMATION_TOKEN_REFUSED_REASON]:
        'La aplicación del usuario confirma estas acciones con su propio formulario, así que no se acepta confirmationToken. No se hizo ningún cambio. Volvé a llamar a la herramienta SIN confirmationToken: la aplicación le va a mostrar al usuario lo que se va a hacer para que lo confirme él.'
};

/** What a call of a covered tool is (see the table in the file header). */
export type ConfirmationPlan =
    | { readonly mode: 'token'; readonly step: 'preview' }
    | { readonly mode: 'token'; readonly step: 'commit'; readonly token: string }
    | { readonly mode: 'elicitation'; readonly step: 'preview' }
    | { readonly mode: 'elicitation'; readonly step: 'commit'; readonly stateId: string }
    | {
          readonly mode: 'elicitation';
          readonly step: 'declined';
          readonly stateId: string;
          readonly decision: 'decline' | 'cancel';
      }
    | { readonly mode: 'elicitation'; readonly step: 'token_refused' };

/** Arguments shared by {@link planConfirmation} and {@link confirmationAuditDetails}. */
export interface PlanConfirmationArgs {
    /** The covered tool. */
    readonly tool: ElicitationToolName;
    /** The `confirmationToken` of the call, when it carries one. */
    readonly confirmationToken: string | undefined;
    /** The call's context. */
    readonly context: ToolContext | undefined;
}

/**
 * Whether this call confirms through the client's form: the client declared
 * the capability on this request AND the tool is strict (D-17). A relaxed tool
 * runs the token flow for every client.
 *
 * @param args - Tool and context
 * @returns `true` for the elicitation flow
 */
export function usesElicitation({
    tool,
    context
}: Pick<PlanConfirmationArgs, 'tool' | 'context'>): boolean {
    return context?.confirmation?.elicitationSupported === true && ELICITATION_STRICT[tool];
}

/**
 * Decides what a call of a covered tool is. Pure.
 *
 * @param args - Tool, the call's token and its context
 * @returns The plan (see the table in the file header)
 *
 * @example
 * ```typescript
 * const plan = planConfirmation({ tool: 'reply_inquiry', confirmationToken, context });
 * if (plan.step === 'token_refused') return confirmationTokenRefused();
 * ```
 */
export function planConfirmation({
    tool,
    confirmationToken,
    context
}: PlanConfirmationArgs): ConfirmationPlan {
    if (!usesElicitation({ tool, context })) {
        return confirmationToken === undefined
            ? { mode: 'token', step: 'preview' }
            : { mode: 'token', step: 'commit', token: confirmationToken };
    }
    if (confirmationToken !== undefined) {
        return { mode: 'elicitation', step: 'token_refused' };
    }
    const answer = context?.confirmation?.answer;
    if (answer === undefined) {
        return { mode: 'elicitation', step: 'preview' };
    }
    return answer.decision === 'confirm'
        ? { mode: 'elicitation', step: 'commit', stateId: answer.stateId }
        : {
              mode: 'elicitation',
              step: 'declined',
              stateId: answer.stateId,
              decision: answer.decision
          };
}

/**
 * The audit facts of a covered call (spec §5.7, C-3): `confirmation` and
 * `step` (`preview | commit | declined`). Calls from a client WITHOUT the
 * capability answer `undefined`, so their audit rows stay byte for byte what
 * they were before HOS-2247 (AC-C62): a row without `confirmation` is a token
 * call from such a client.
 *
 * @param args - Tool, the call's token and its context
 * @returns The facts to merge over the tool's own, or `undefined`
 */
export function confirmationAuditDetails(args: PlanConfirmationArgs): ToolAuditDetails | undefined {
    if (args.context?.confirmation?.elicitationSupported !== true) {
        return undefined;
    }
    const plan = planConfirmation(args);
    if (plan.mode === 'token') {
        return { confirmation: 'token', step: plan.step };
    }
    if (plan.step === 'token_refused') {
        return { confirmation: 'token', step: 'commit' };
    }
    return { confirmation: 'elicitation', step: plan.step };
}

/** The Redis key prefix of a covered tool's confirmation states. */
export function elicitationKeyPrefix(tool: ElicitationToolName): string {
    return `mcp:elicit:${tool}:`;
}

/** A covered tool's binding: the store's, with the tool narrowed to the covered set. */
export interface ElicitationBinding extends Omit<ConfirmationBinding, 'tool'> {
    readonly tool: ElicitationToolName;
}

/** Arguments for {@link issueConfirmationState}. */
export interface IssueConfirmationStateArgs {
    /** What the human is asked to confirm, bound exactly like a token. */
    readonly binding: ElicitationBinding;
    /** A server-side value the commit needs (`create_listing`: the resolved point). */
    readonly stash?: CanonicalJsonValue;
    /** Store injection (tests). */
    readonly deps?: ConfirmationStoreDeps;
}

/** Result of {@link issueConfirmationState}. */
export type IssueConfirmationStateResult =
    | { readonly ok: true; readonly stateId: string }
    | { readonly ok: false; readonly reason: 'UNAVAILABLE' };

/**
 * Stores the binding of an elicitation preview and returns its opaque id.
 *
 * @param args - Binding, optional stash and deps
 * @returns The state id, or `UNAVAILABLE` (fail closed: no form without a record)
 */
export async function issueConfirmationState({
    binding,
    stash,
    deps
}: IssueConfirmationStateArgs): Promise<IssueConfirmationStateResult> {
    const issued = await issueConfirmationToken({
        ...binding,
        ...(stash === undefined ? {} : { stash }),
        keyPrefix: elicitationKeyPrefix(binding.tool),
        ...(deps?.getRedis ? { getRedis: deps.getRedis } : {})
    });
    return issued.ok ? { ok: true, stateId: issued.token } : issued;
}

/** Arguments for {@link settleConfirmationAnswer}. */
export interface SettleConfirmationAnswerArgs {
    /** The binding recomputed from the RETRIED call's arguments. */
    readonly binding: ElicitationBinding;
    /** The plan of the retry: an elicitation commit or a decline. */
    readonly plan: Extract<
        ConfirmationPlan,
        { readonly mode: 'elicitation'; readonly step: 'commit' | 'declined' }
    >;
    /** Store injection (tests). */
    readonly deps?: ConfirmationStoreDeps;
}

/** Result of {@link settleConfirmationAnswer}. */
export type SettleConfirmationAnswerResult =
    /** The human confirmed this exact call: the write may proceed, once. */
    | { readonly kind: 'confirmed'; readonly stash?: CanonicalJsonValue }
    /** Nothing may be written; answer with `error`. */
    | { readonly kind: 'refused'; readonly error: ToolErrorPayload }
    /** The store failed: fail closed, nothing may be written. */
    | { readonly kind: 'unavailable' };

/** The one refusal of a state that cannot be used. */
function stateInvalid(): ToolErrorPayload {
    return {
        code: ServiceErrorCode.VALIDATION_ERROR,
        message: 'Confirmation state unknown, expired, used or mismatched',
        reason: ELICITATION_STATE_INVALID_REASON
    };
}

/**
 * Settles the answer of a retried call. The record is consumed (atomic
 * `GETDEL`) in EVERY case, so it can never be answered twice, and a decline
 * leaves nothing behind. The state is checked before the decision: a forged
 * state is refused as invalid whatever the "answer" says.
 *
 * @param args - The retried binding, the plan and deps
 * @returns Confirmed (with the stash), refused, or unavailable
 */
export async function settleConfirmationAnswer({
    binding,
    plan,
    deps
}: SettleConfirmationAnswerArgs): Promise<SettleConfirmationAnswerResult> {
    const consumed = await consumeConfirmationToken({
        ...binding,
        token: plan.stateId,
        keyPrefix: elicitationKeyPrefix(binding.tool),
        ...(deps?.getRedis ? { getRedis: deps.getRedis } : {})
    });
    if (!consumed.ok) {
        return consumed.reason === 'UNAVAILABLE'
            ? { kind: 'unavailable' }
            : { kind: 'refused', error: stateInvalid() };
    }
    if (plan.step === 'declined') {
        const declined = plan.decision === 'decline';
        return {
            kind: 'refused',
            error: {
                code: declined ? 'USER_DECLINED' : 'USER_CANCELLED',
                message: declined
                    ? 'The user declined the confirmation'
                    : 'The confirmation was cancelled or left unanswered'
            }
        };
    }
    return consumed.stash === undefined
        ? { kind: 'confirmed' }
        : { kind: 'confirmed', stash: consumed.stash };
}

/**
 * The refusal of a state that cannot be used, as a tool result. For a check a
 * tool makes after {@link settleConfirmationAnswer} (a stash that does not
 * parse): same answer as every other unusable state.
 *
 * @returns The tool error; nothing was written
 */
export function elicitationStateInvalid(): ToolHandlerResult<never> {
    return { error: stateInvalid() };
}

/**
 * The refusal of a token on a client that must confirm through its form (D-17).
 *
 * @returns The tool error; nothing was written
 */
export function confirmationTokenRefused(): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Confirmation token refused: this client confirms out of band',
            reason: CONFIRMATION_TOKEN_REFUSED_REASON
        }
    };
}

/**
 * The answer of an elicitation preview.
 *
 * @param args - The Spanish preview and the state id
 * @returns The neutral confirmation request
 */
export function needsConfirmation({
    message,
    stateId
}: {
    readonly message: string;
    readonly stateId: string;
}): ToolNeedsConfirmation {
    return { needsConfirmation: { message, stateId } };
}

/** Arguments for {@link discardUnsettledConfirmation}. */
export interface DiscardUnsettledConfirmationArgs {
    /** The tool called. */
    readonly tool: string;
    /** The call's confirmation context. */
    readonly confirmation: ToolConfirmationContext | undefined;
    /** Store injection (tests). */
    readonly deps?: ConfirmationStoreDeps;
}

/**
 * Burns the state a refused retry carried (HOS-2247 L2). A retry can be refused
 * before its tool settles the answer (not found, no permission, no longer
 * pending, malformed input); the state must still never be usable again. A
 * state the tool already settled is gone, so this second `GETDEL` is a no-op.
 *
 * @param args - Tool, the call's confirmation context and deps
 */
export async function discardUnsettledConfirmation({
    tool,
    confirmation,
    deps
}: DiscardUnsettledConfirmationArgs): Promise<void> {
    const stateId = confirmation?.answer?.stateId;
    if (stateId === undefined || !isElicitationToolName(tool)) {
        return;
    }
    await discardConfirmationToken({
        token: stateId,
        tool,
        keyPrefix: elicitationKeyPrefix(tool),
        ...(deps?.getRedis ? { getRedis: deps.getRedis } : {})
    });
}

/** Whether `name` is a tool covered by out-of-band confirmation. */
function isElicitationToolName(name: string): name is ElicitationToolName {
    return (ELICITATION_TOOL_NAMES as readonly string[]).includes(name);
}
