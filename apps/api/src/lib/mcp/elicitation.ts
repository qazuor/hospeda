/**
 * @file elicitation.ts
 * @description The MCP face of out-of-band confirmation (HOS-2247, spec §5.7).
 * The only module that knows the SDK's multi-round-trip shapes; tools see the
 * neutral `ToolConfirmationContext` / `ToolConfirmationRequest`
 * (`mcp/tools/tool-definition.ts`).
 *
 * Protocol revision 2026-07-28 only (owner decision D-18):
 * - **Support** is read from THIS request's `_meta` envelope
 *   (`ctx.mcpReq.envelope`), which a 2026-07-28 request must carry: its
 *   protocol version must be 2026-07-28 or later, and its
 *   `clientCapabilities.elicitation` must cover form mode (`{}` counts as form,
 *   the pre-mode rule; `{ url }` alone does not). A 2025-era request carries no
 *   envelope and is treated as unsupported: its capabilities live in an
 *   `initialize` this stateless server never keeps.
 * - **The ask** is an `input_required` result with ONE form elicitation
 *   (`inputRequired.elicit`) whose schema asks a single boolean, `confirm`, and
 *   whose `requestState` is the opaque id of the bound record. The 2025 push
 *   (`ctx.mcpReq.elicitInput`) is never used, and the SDK's legacy shim, which
 *   would turn an `input_required` into such a push on a 2025-era request, is
 *   disabled in `server.ts`.
 * - **The answer** of the retry (`ctx.mcpReq.inputResponses` and
 *   `ctx.mcpReq.requestState()`) is reduced to `confirm | decline | cancel`.
 *   Both come from the client and are untrusted: only the store lookup in
 *   `elicitation-confirmation.ts` gives the state id any meaning.
 */

import {
    acceptedContent,
    CLIENT_CAPABILITIES_META_KEY,
    type InputRequiredResult,
    inputRequired,
    inputResponse,
    PROTOCOL_VERSION_META_KEY
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import type {
    ToolConfirmationAnswer,
    ToolConfirmationContext,
    ToolConfirmationDecision,
    ToolConfirmationRequest
} from '../../mcp/tools/tool-definition';

/** Key of the one input request the server asks (`inputRequests.confirm`). */
export const ELICITATION_INPUT_KEY = 'confirm';

/** First protocol revision whose requests carry capabilities and support `input_required`. */
export const ELICITATION_MIN_PROTOCOL_VERSION = '2026-07-28';

/**
 * Upper bound of an echoed state id. Ours are 43 characters (32 bytes,
 * base64url); anything longer is not ours and is refused without hashing it.
 */
const MAX_STATE_ID_LENGTH = 128;

/** The part of the SDK's request context this module reads. Structural, so tests can pass a literal. */
export interface McpElicitationSource {
    readonly mcpReq?: {
        /** The per-request `_meta` envelope (2026-07-28). */
        readonly envelope?: unknown;
        /** The retry's input responses, keyed like the `inputRequests` sent. */
        readonly inputResponses?: Readonly<Record<string, unknown>>;
        /** The retry's `requestState` (raw: no verify hook is configured). */
        readonly requestState?: () => unknown;
    };
}

/** The envelope fields read here; everything else is ignored. */
const EnvelopeSchema = z.object({
    [PROTOCOL_VERSION_META_KEY]: z.string(),
    [CLIENT_CAPABILITIES_META_KEY]: z.looseObject({
        elicitation: z
            .looseObject({ form: z.unknown().optional(), url: z.unknown().optional() })
            .optional()
    })
});

/** What a form answer must look like to count as `confirm`. */
const ConfirmAnswerSchema = z.object({ confirm: z.boolean() });

/** A protocol version string of the 2026-07-28 era or later (`YYYY-MM-DD`, compared as text). */
function isModernProtocolVersion(version: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(version) && version >= ELICITATION_MIN_PROTOCOL_VERSION;
}

/**
 * Whether the request declares form elicitation on the 2026-07-28 era.
 *
 * @param args - The request's envelope (untyped, as the SDK lifts it)
 * @returns `true` only for a modern request whose capabilities cover form mode
 */
export function declaresFormElicitation({ envelope }: { readonly envelope: unknown }): boolean {
    const parsed = EnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
        return false;
    }
    if (!isModernProtocolVersion(parsed.data[PROTOCOL_VERSION_META_KEY])) {
        return false;
    }
    const elicitation = parsed.data[CLIENT_CAPABILITIES_META_KEY].elicitation;
    if (elicitation === undefined) {
        return false;
    }
    return elicitation.form !== undefined || elicitation.url === undefined;
}

/** Reduces the retry's input response to the human's decision. No answer is a cancel. */
function readDecision(
    responses: Readonly<Record<string, unknown>> | undefined
): ToolConfirmationDecision {
    const view = inputResponse(responses, ELICITATION_INPUT_KEY);
    if (view.kind !== 'elicit' || view.action === 'cancel') {
        return 'cancel';
    }
    if (view.action === 'decline') {
        return 'decline';
    }
    const content = acceptedContent(responses, ELICITATION_INPUT_KEY, ConfirmAnswerSchema);
    return content?.confirm === true ? 'confirm' : 'decline';
}

/** The retry's answer, when the request echoes a state. */
function readAnswer(source: McpElicitationSource): ToolConfirmationAnswer | undefined {
    const raw = source.mcpReq?.requestState?.();
    if (raw === undefined) {
        return undefined;
    }
    // A malformed state keeps the call on the retry path with an id nothing
    // matches, so it gets the same refusal as any other unusable state.
    const stateId = typeof raw === 'string' && raw.length <= MAX_STATE_ID_LENGTH ? raw : '';
    return { stateId, decision: readDecision(source.mcpReq?.inputResponses) };
}

/**
 * The out-of-band confirmation facts of a `tools/call`.
 *
 * @param args - The SDK request context
 * @returns The facts for a capable client; `undefined` otherwise, so the
 *   tool context of every other client stays exactly what it was
 *
 * @example
 * ```typescript
 * const confirmation = readElicitationContext({ ctx });
 * const context = { channel: 'mcp', clientId, ...(confirmation ? { confirmation } : {}) };
 * ```
 */
export function readElicitationContext({
    ctx
}: {
    readonly ctx: McpElicitationSource;
}): ToolConfirmationContext | undefined {
    if (!declaresFormElicitation({ envelope: ctx.mcpReq?.envelope })) {
        return undefined;
    }
    const answer = readAnswer(ctx);
    return answer === undefined
        ? { elicitationSupported: true }
        : { elicitationSupported: true, answer };
}

/**
 * Renders a tool's confirmation request as the MCP `input_required` result:
 * one form elicitation asking `confirm`, and the state id as `requestState`.
 * The client shows the form to the human; the model sees neither the form
 * nor the answer.
 *
 * @param args - The neutral request
 * @returns The `input_required` result
 */
export function renderConfirmationRequest({
    request
}: {
    readonly request: ToolConfirmationRequest;
}): InputRequiredResult {
    return inputRequired({
        inputRequests: {
            [ELICITATION_INPUT_KEY]: inputRequired.elicit({
                mode: 'form',
                message: request.message,
                requestedSchema: {
                    type: 'object',
                    properties: {
                        confirm: {
                            type: 'boolean',
                            title: 'Confirmo',
                            description:
                                'Marcá esta casilla para confirmar. Si no la marcás, no se hace ningún cambio.'
                        }
                    },
                    required: ['confirm']
                }
            })
        },
        requestState: request.stateId
    });
}
