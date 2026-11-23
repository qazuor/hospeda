import { describe, expect, it } from 'vitest';
import {
    StuckRefundListQuerySchema,
    StuckRefundListResponseSchema,
    StuckRefundSchema
} from '../../../src/api/billing/stuck-refunds.schema';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const valid = {
    refundId: ID,
    amountMinor: 12500,
    currency: 'ARS',
    createdAt: '2026-11-18T12:00:00.000Z',
    payment: { source: 'PAYMENT', id: ID },
    providerCallCount: 2,
    unansweredCallCount: 1,
    oldestUnansweredAt: '2026-11-18T12:05:00.000Z',
    acceptedAmountMinor: 5000,
    suggestedAction: 'RETRY'
};

describe('StuckRefundListQuerySchema', () => {
    it('defaults to the first page of 50', () => {
        expect(StuckRefundListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    });

    it('coerces query strings and enforces the page and size limits', () => {
        expect(StuckRefundListQuerySchema.parse({ page: '2', pageSize: '100' })).toEqual({
            page: 2,
            pageSize: 100
        });
        expect(StuckRefundListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
        expect(StuckRefundListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    });
});

describe('StuckRefundSchema', () => {
    it('accepts each suggested action and none', () => {
        expect(StuckRefundSchema.safeParse(valid).success).toBe(true);
        expect(
            StuckRefundSchema.safeParse({ ...valid, suggestedAction: 'SETTLE_REMAINDER' }).success
        ).toBe(true);
        expect(StuckRefundSchema.safeParse({ ...valid, suggestedAction: null }).success).toBe(true);
    });

    it('accepts a refund with every call answered and a manual payment with no currency', () => {
        expect(
            StuckRefundSchema.safeParse({
                ...valid,
                unansweredCallCount: 0,
                oldestUnansweredAt: null,
                currency: null,
                payment: { source: 'MANUAL_PAYMENT', id: ID }
            }).success
        ).toBe(true);
    });

    it('rejects an unknown action, a non-positive amount and a negative count', () => {
        expect(StuckRefundSchema.safeParse({ ...valid, suggestedAction: 'DECLINE' }).success).toBe(
            false
        );
        expect(StuckRefundSchema.safeParse({ ...valid, amountMinor: 0 }).success).toBe(false);
        expect(StuckRefundSchema.safeParse({ ...valid, unansweredCallCount: -1 }).success).toBe(
            false
        );
    });

    it('requires the suggested action field', () => {
        const { suggestedAction: _action, ...withoutAction } = valid;
        expect(StuckRefundSchema.safeParse(withoutAction).success).toBe(false);
    });
});

describe('StuckRefundListResponseSchema', () => {
    it('wraps items with pagination', () => {
        const parsed = StuckRefundListResponseSchema.safeParse({
            items: [valid],
            pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 }
        });
        expect(parsed.success).toBe(true);
    });
});
