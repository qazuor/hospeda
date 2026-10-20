import { describe, expect, it } from 'vitest';
import { SubscriptionOpenRefundsResponseSchema } from '../../../src/api/billing/subscription-open-refunds.schema.js';

const item = {
    refundId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
    refundAmount: 1200,
    reason: 'REVOCATION',
    requestedAt: '2026-10-19T12:00:00.000Z',
    payment: { source: 'PAYMENT', id: '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0' }
} as const;

describe('TEST:1711:8 AC:1711:10 SubscriptionOpenRefundsResponseSchema', () => {
    it('TEST:1711:8 AC:1711:10 accepts payment and manual payment requests and an empty list', () => {
        expect(
            SubscriptionOpenRefundsResponseSchema.safeParse({
                items: [item, { ...item, payment: { ...item.payment, source: 'MANUAL_PAYMENT' } }]
            }).success
        ).toBe(true);
        expect(SubscriptionOpenRefundsResponseSchema.safeParse({ items: [] }).success).toBe(true);
    });

    it('TEST:1711:8 AC:1711:10 rejects invalid amount, source, requested time, and refund id', () => {
        for (const invalid of [
            { ...item, refundAmount: 0 },
            { ...item, payment: { ...item.payment, source: 'ADDON' } },
            { ...item, requestedAt: 'not-a-date' },
            { ...item, refundId: 'not-a-uuid' }
        ]) {
            expect(
                SubscriptionOpenRefundsResponseSchema.safeParse({ items: [invalid] }).success
            ).toBe(false);
        }
    });
});
