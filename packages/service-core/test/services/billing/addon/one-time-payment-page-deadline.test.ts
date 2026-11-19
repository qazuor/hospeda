import { describe, expect, it } from 'vitest';
import { paymentPageKey } from '../../../../src/services/billing/addon/one-time-payment-page';
import {
    type BillingDeadlinesRow,
    optionalPaymentPageTiming,
    paymentPageExpiry,
    paymentPageTiming
} from '../../../../src/services/billing/addon/one-time-payment-page-deadline';

function deadlinesWith(values: Record<string, unknown>): BillingDeadlinesRow {
    // Only `values` is read; the rest of the row is irrelevant to the timing.
    return { values } as unknown as BillingDeadlinesRow;
}

describe('HOS-2179 PLAZO:21 payment page timing', () => {
    it('converts the catalog minutes to milliseconds', () => {
        const deadlines = deadlinesWith({ '21': { pageMinutes: 60, windowMarginMinutes: 30 } });
        expect(paymentPageTiming(deadlines)).toEqual({
            pageMs: 3_600_000,
            windowMarginMs: 1_800_000
        });
        expect(optionalPaymentPageTiming(deadlines)).toEqual({
            pageMs: 3_600_000,
            windowMarginMs: 1_800_000
        });
    });

    it('refuses with a configuration error when PLAZO:21 is absent', () => {
        const deadlines = deadlinesWith({});
        expect(optionalPaymentPageTiming(deadlines)).toBeNull();
        expect(() => paymentPageTiming(deadlines)).toThrow(
            expect.objectContaining({
                code: 'CONFIGURATION_ERROR',
                reason: 'PAYMENT_PAGE_DEADLINE_MISSING'
            })
        );
    });

    it('derives the page expiry from the purchase creation, never from the call', () => {
        const createdAt = new Date('2026-10-13T12:00:00.000Z');
        expect(
            paymentPageExpiry({ createdAt, timing: { pageMs: 3_600_000, windowMarginMs: 1 } })
        ).toEqual(new Date('2026-10-13T13:00:00.000Z'));
    });

    it('keys the page creation by the purchase identifier', () => {
        expect(paymentPageKey('req-1')).toBe('page:req-1');
    });
});
