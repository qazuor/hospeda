import { describe, expect, it } from 'vitest';
import {
    OUR_CANCELLATION_NOTICE_KINDS,
    ourCancellationServiceEnd
} from '../../../../src/services/billing/notice/mirror-our-cancellation-on-active.js';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '../../../../src/services/billing/subscription/before-cancel-notice-kinds.js';
import { billingPeriodEnd } from '../../../../src/services/billing/subscription/billing-period-end.js';

describe('ourCancellationServiceEnd', () => {
    it('ends at the end of the newest paid period, with calendar month clamping', () => {
        const periodStart = new Date('2025-01-31T12:00:00.000Z');
        const result = ourCancellationServiceEnd({
            lastPaidPeriodStart: periodStart,
            everyMonths: 1,
            firstChargeAt: null,
            readAt: new Date('2025-02-01T00:00:00.000Z')
        });
        expect(result).toEqual(billingPeriodEnd({ periodStart, everyMonths: 1 }).periodEnd);
        expect(result.toISOString()).toBe('2025-02-28T12:00:00.000Z');
    });

    it('uses future first-charge credit when no period was paid', () => {
        const firstChargeAt = new Date('2025-02-03T00:00:00.000Z');
        expect(
            ourCancellationServiceEnd({
                lastPaidPeriodStart: null,
                everyMonths: 1,
                firstChargeAt,
                readAt: new Date('2025-02-01T00:00:00.000Z')
            })
        ).toEqual(firstChargeAt);
    });

    it.each([
        '2025-01-31T00:00:00.000Z',
        '2025-02-01T00:00:00.000Z'
    ])('uses readAt when first-charge credit is not future (%s)', (firstCharge) => {
        const readAt = new Date('2025-02-01T00:00:00.000Z');
        expect(
            ourCancellationServiceEnd({
                lastPaidPeriodStart: null,
                everyMonths: 1,
                firstChargeAt: new Date(firstCharge),
                readAt
            })
        ).toEqual(readAt);
    });

    it('uses readAt when there is no payment or credit', () => {
        const readAt = new Date('2025-02-01T00:00:00.000Z');
        expect(
            ourCancellationServiceEnd({
                lastPaidPeriodStart: null,
                everyMonths: 1,
                firstChargeAt: null,
                readAt
            })
        ).toEqual(readAt);
    });

    it('maps the two our-cancellation kinds through the canonical template map', () => {
        expect(
            OUR_CANCELLATION_NOTICE_KINDS.map((kind) => BEFORE_CANCEL_TEMPLATE_BY_KIND[kind])
        ).toEqual(['billing.arrears-suspension', 'billing.before-cancel']);
    });
});
