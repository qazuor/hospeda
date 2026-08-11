/**
 * Rules governing when the audit screen may offer to suspend (HOS-376 T-056).
 *
 * These live in a pure module and not in the JSX for the reason established
 * across this spec: an assertion about what rendered cannot tell "the rule
 * forbade it" from "that branch was never reached". A button that is missing
 * because the row had no data looks exactly like a button the rule suppressed.
 */
import { describe, expect, it } from 'vitest';
import {
    isSuspensionReasonAcceptable,
    resolveSuspendAvailability
} from '../usage-suspension-rules';

const ROW = { hostTradeId: 'ht-1', providerName: 'Plomero Centro' };

describe('resolveSuspendAvailability', () => {
    it('offers the action for a resolved provider that is not suspended', () => {
        const result = resolveSuspendAvailability({
            row: ROW,
            suspendedProviderIds: new Set(['ht-other'])
        });

        expect(result).toEqual({ allowed: true, providerName: 'Plomero Centro' });
    });

    it('withholds the action when the provider did not resolve', () => {
        const result = resolveSuspendAvailability({
            row: { hostTradeId: 'ht-1', providerName: null },
            suspendedProviderIds: new Set()
        });

        expect(result).toEqual({ allowed: false, reason: 'unresolved-provider' });
    });

    it('withholds the action for a provider already known to be suspended', () => {
        const result = resolveSuspendAvailability({
            row: ROW,
            suspendedProviderIds: new Set(['ht-1'])
        });

        expect(result).toEqual({ allowed: false, reason: 'already-suspended' });
    });

    /**
     * The suspension list is a SEPARATE read on the same screen and is allowed
     * to be incomplete — in flight, failed, or truncated to one page. An empty
     * set therefore suppresses too few actions rather than too many, which is
     * the safe direction: a screen that hid its only write whenever a sibling
     * request failed would leave the admin nothing to do about what he sees.
     */
    it('offers the action when the suspension list is empty, including when it never answered', () => {
        const result = resolveSuspendAvailability({
            row: ROW,
            suspendedProviderIds: new Set()
        });

        expect(result).toEqual({ allowed: true, providerName: 'Plomero Centro' });
    });

    it('withholds the action on an unresolved provider before checking suspensions at all', () => {
        const result = resolveSuspendAvailability({
            row: { hostTradeId: 'ht-1', providerName: null },
            suspendedProviderIds: new Set(['ht-1'])
        });

        expect(result).toEqual({ allowed: false, reason: 'unresolved-provider' });
    });
});

describe('isSuspensionReasonAcceptable', () => {
    it('accepts a reason with content', () => {
        expect(isSuspensionReasonAcceptable('Usos fabricados')).toBe(true);
    });

    it('rejects an empty reason', () => {
        expect(isSuspensionReasonAcceptable('')).toBe(false);
    });

    /**
     * Whitespace passes a naive non-empty check and then reads, to the
     * provider who asks why, as a reason that was given and lost.
     */
    it('rejects a reason of nothing but whitespace', () => {
        expect(isSuspensionReasonAcceptable('   \n\t ')).toBe(false);
    });
});
