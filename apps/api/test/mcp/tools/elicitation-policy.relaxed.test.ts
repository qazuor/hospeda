/**
 * HOS-2247, owner decision D-17 — the per-tool relax switch. Strict is the
 * default for every covered tool; flipping `ELICITATION_STRICT[tool]` to
 * `false` lets a capable client complete the token path for that tool (and only
 * that tool), so the token is no longer refused there.
 *
 * @module test/mcp/tools/elicitation-policy.relaxed
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/mcp/tools/elicitation-policy', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/mcp/tools/elicitation-policy')>();
    return {
        ...actual,
        ELICITATION_STRICT: { ...actual.ELICITATION_STRICT, reply_inquiry: false }
    };
});

import {
    confirmationAuditDetails,
    planConfirmation,
    usesElicitation
} from '../../../src/mcp/tools/elicitation-confirmation';
import type { ToolContext } from '../../../src/mcp/tools/tool-definition';

const CAPABLE: ToolContext = { channel: 'mcp', confirmation: { elicitationSupported: true } };

describe('ELICITATION_STRICT relaxed for one tool', () => {
    it('the relaxed tool runs the token flow on a capable client', () => {
        // Act + Assert
        expect(usesElicitation({ tool: 'reply_inquiry', context: CAPABLE })).toBe(false);
        expect(
            planConfirmation({
                tool: 'reply_inquiry',
                confirmationToken: undefined,
                context: CAPABLE
            })
        ).toEqual({
            mode: 'token',
            step: 'preview'
        });
        expect(
            planConfirmation({ tool: 'reply_inquiry', confirmationToken: 't', context: CAPABLE })
        ).toEqual({ mode: 'token', step: 'commit', token: 't' });
    });

    it('the audit still marks the call as a capable client confirming by token', () => {
        // Act + Assert
        expect(
            confirmationAuditDetails({
                tool: 'reply_inquiry',
                confirmationToken: 't',
                context: CAPABLE
            })
        ).toEqual({ confirmation: 'token', step: 'commit' });
    });

    it('every other covered tool stays strict', () => {
        // Act + Assert
        expect(
            planConfirmation({ tool: 'create_listing', confirmationToken: 't', context: CAPABLE })
        ).toEqual({ mode: 'elicitation', step: 'token_refused' });
        expect(
            planConfirmation({
                tool: 'set_listing_publication',
                confirmationToken: undefined,
                context: CAPABLE
            })
        ).toEqual({
            mode: 'elicitation',
            step: 'preview'
        });
    });
});
