import { describe, expect, it } from 'vitest';
import {
    ProposedRefundListQuerySchema,
    ProposedRefundListResponseSchema,
    ProposedRefundSchema
} from '../../../src/api/billing/refund-proposals.schema';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const valid = {
    refundId: ID,
    status: 'REQUESTED',
    amountMinor: 12500,
    currency: 'ARS',
    requestedAt: '2026-11-18T12:00:00.000Z',
    payment: { source: 'PAYMENT', id: ID },
    providerCallCount: 0,
    closesHeldCharge: true,
    marks: [
        {
            markId: ID,
            reason: 'COBRO_DUPLICADO',
            reasonNumber: 20,
            openedAt: '2026-11-17T12:00:00.000Z',
            liftedAt: null,
            subject: { kind: 'ADDON_INSTANCE', id: ID }
        }
    ]
};

describe('ProposedRefundListQuerySchema', () => {
    it('defaults to the first page of 50', () => {
        expect(ProposedRefundListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    });

    it('coerces query strings and enforces the page and size limits', () => {
        expect(ProposedRefundListQuerySchema.parse({ page: '2', pageSize: '100' })).toEqual({
            page: 2,
            pageSize: 100
        });
        expect(ProposedRefundListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
        expect(ProposedRefundListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    });
});

describe('ProposedRefundSchema', () => {
    it('accepts a REQUESTED refund and a CONFIRMED one, and a manual payment with no currency', () => {
        expect(ProposedRefundSchema.safeParse(valid).success).toBe(true);
        expect(ProposedRefundSchema.safeParse({ ...valid, status: 'CONFIRMED' }).success).toBe(
            true
        );
        expect(
            ProposedRefundSchema.safeParse({
                ...valid,
                currency: null,
                payment: { source: 'MANUAL_PAYMENT', id: ID }
            }).success
        ).toBe(true);
    });

    it('rejects a closed status and a non-positive amount', () => {
        expect(ProposedRefundSchema.safeParse({ ...valid, status: 'FAILED' }).success).toBe(false);
        expect(ProposedRefundSchema.safeParse({ ...valid, status: 'EXECUTED' }).success).toBe(
            false
        );
        expect(ProposedRefundSchema.safeParse({ ...valid, amountMinor: 0 }).success).toBe(false);
    });

    it('requires the closesHeldCharge flag the screen locks decline on', () => {
        const { closesHeldCharge: _flag, ...withoutFlag } = valid;
        expect(ProposedRefundSchema.safeParse(withoutFlag).success).toBe(false);
    });
});

describe('ProposedRefundListResponseSchema', () => {
    it('wraps items with pagination', () => {
        const parsed = ProposedRefundListResponseSchema.safeParse({
            items: [valid],
            pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 }
        });
        expect(parsed.success).toBe(true);
    });
});
