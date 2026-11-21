/**
 * HOS-2247 — the MCP face of out-of-band confirmation (spec §5.7, D-18): which
 * requests count as able to show a confirmation form, how the retry's answer is
 * reduced, and the exact `input_required` result the server answers.
 *
 * @module test/lib/mcp/elicitation
 */

import {
    CLIENT_CAPABILITIES_META_KEY,
    isInputRequiredResult,
    PROTOCOL_VERSION_META_KEY
} from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import {
    declaresFormElicitation,
    ELICITATION_INPUT_KEY,
    readElicitationContext,
    renderConfirmationRequest
} from '../../../src/lib/mcp/elicitation';

/** A 2026-07-28 envelope declaring `elicitation` as given. */
const envelope = (elicitation: unknown, version = '2026-07-28') => ({
    [PROTOCOL_VERSION_META_KEY]: version,
    [CLIENT_CAPABILITIES_META_KEY]: elicitation === undefined ? {} : { elicitation }
});

describe('declaresFormElicitation (support, read per request)', () => {
    it.each([
        ['`elicitation: {}` (form, the pre-mode rule)', envelope({}), true],
        ['`elicitation: { form: {} }`', envelope({ form: {} }), true],
        ['`elicitation: { form: {}, url: {} }`', envelope({ form: {}, url: {} }), true],
        ['`elicitation: { url: {} }` only (no form)', envelope({ url: {} }), false],
        ['no `elicitation` capability', envelope(undefined), false],
        ['a later modern revision', envelope({}, '2027-01-15'), true],
        ['a 2025-era version in the envelope', envelope({}, '2025-11-25'), false],
        ['a malformed version', envelope({}, 'latest'), false],
        ['no envelope (a 2025-era request)', undefined, false],
        [
            'capabilities without a version',
            { [CLIENT_CAPABILITIES_META_KEY]: { elicitation: {} } },
            false
        ]
    ])('%s → %s', (_label, value, expected) => {
        // Act + Assert
        expect(declaresFormElicitation({ envelope: value })).toBe(expected);
    });
});

describe('readElicitationContext', () => {
    const capable = (mcpReq: Record<string, unknown> = {}) => ({
        mcpReq: { envelope: envelope({}), ...mcpReq }
    });
    const retry = (state: unknown, responses: Record<string, unknown> | undefined) =>
        capable({ requestState: () => state, inputResponses: responses });

    it('is undefined for a client without the capability, so its tool context is unchanged', () => {
        // Act + Assert
        expect(readElicitationContext({ ctx: {} })).toBeUndefined();
        expect(
            readElicitationContext({ ctx: { mcpReq: { envelope: envelope({ url: {} }) } } })
        ).toBeUndefined();
    });

    it('ignores a 2025-era request even if it echoes a state and an answer (D-18)', () => {
        // Act
        const context = readElicitationContext({
            ctx: {
                mcpReq: {
                    requestState: () => 'state',
                    inputResponses: { confirm: { action: 'accept', content: { confirm: true } } }
                }
            }
        });

        // Assert
        expect(context).toBeUndefined();
    });

    it('a capable first call carries no answer', () => {
        // Act + Assert
        expect(readElicitationContext({ ctx: capable() })).toEqual({ elicitationSupported: true });
    });

    it.each([
        ['accept + confirm: true', { action: 'accept', content: { confirm: true } }, 'confirm'],
        ['accept + confirm: false', { action: 'accept', content: { confirm: false } }, 'decline'],
        [
            'accept + confirm: "yes" (not a boolean)',
            { action: 'accept', content: { confirm: 'yes' } },
            'decline'
        ],
        ['accept with no content', { action: 'accept' }, 'decline'],
        ['decline', { action: 'decline' }, 'decline'],
        ['cancel', { action: 'cancel' }, 'cancel'],
        ['an answer of another kind', { roots: [] }, 'cancel']
    ])('%s → %s', (_label, response, decision) => {
        // Act
        const context = readElicitationContext({
            ctx: retry('state-1', { [ELICITATION_INPUT_KEY]: response })
        });

        // Assert
        expect(context).toEqual({
            elicitationSupported: true,
            answer: { stateId: 'state-1', decision }
        });
    });

    it('a state with no answer at all is a cancel', () => {
        // Act + Assert
        expect(readElicitationContext({ ctx: retry('state-1', undefined) })?.answer).toEqual({
            stateId: 'state-1',
            decision: 'cancel'
        });
    });

    it('an answer under another key is not an answer', () => {
        // Act
        const context = readElicitationContext({
            ctx: retry('state-1', { other: { action: 'accept', content: { confirm: true } } })
        });

        // Assert
        expect(context?.answer?.decision).toBe('cancel');
    });

    it.each([
        ['a non-string state', 42],
        ['an oversized state', 'x'.repeat(129)]
    ])('%s keeps the retry path with an id nothing matches', (_label, state) => {
        // Act
        const context = readElicitationContext({
            ctx: retry(state, { confirm: { action: 'accept', content: { confirm: true } } })
        });

        // Assert
        expect(context?.answer).toEqual({ stateId: '', decision: 'confirm' });
    });
});

describe('renderConfirmationRequest (2026-07-28 round trip only)', () => {
    it('answers one form elicitation asking only `confirm`, with the state as requestState', () => {
        // Act
        const result = renderConfirmationRequest({
            request: { message: 'Vas a responder…\n¿Confirmás el envío?', stateId: 'state-1' }
        });

        // Assert
        expect(isInputRequiredResult(result)).toBe(true);
        expect(result).toEqual({
            resultType: 'input_required',
            requestState: 'state-1',
            inputRequests: {
                confirm: {
                    method: 'elicitation/create',
                    params: {
                        mode: 'form',
                        message: 'Vas a responder…\n¿Confirmás el envío?',
                        requestedSchema: {
                            type: 'object',
                            properties: {
                                confirm: expect.objectContaining({ type: 'boolean' })
                            },
                            required: ['confirm']
                        }
                    }
                }
            }
        });
    });
});
