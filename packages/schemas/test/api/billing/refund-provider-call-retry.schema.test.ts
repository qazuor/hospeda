import { describe, expect, it } from 'vitest';
import {
    RefundProviderCallRetryParamsSchema,
    RefundProviderCallRetryRequestSchema,
    RefundProviderCallRetryResponseSchema
} from '../../../src/api/billing/refund-provider-call-retry.schema';

const refundId = '00000000-0000-4000-8000-000000000001';
const call = { idempotencyKey: `refund:${refundId}:1`, outcome: 'SENT' };

describe('refund provider call retry schemas (HOS-2516)', () => {
    it('requires a UUID refund id', () => {
        expect(RefundProviderCallRetryParamsSchema.safeParse({ refundId }).success).toBe(true);
        expect(RefundProviderCallRetryParamsSchema.safeParse({ refundId: 'x' }).success).toBe(
            false
        );
    });

    it('requires explicit confirmation and nothing else', () => {
        expect(RefundProviderCallRetryRequestSchema.safeParse({ confirmed: true }).success).toBe(
            true
        );
        expect(RefundProviderCallRetryRequestSchema.safeParse({ confirmed: false }).success).toBe(
            false
        );
        expect(RefundProviderCallRetryRequestSchema.safeParse({}).success).toBe(false);
        expect(
            RefundProviderCallRetryRequestSchema.safeParse({ confirmed: true, amount: 1 }).success
        ).toBe(false);
    });

    it.each([
        'SENT',
        'AWAITING_PROVIDER_ANSWER',
        'PROVIDER_KEY_CONFLICT',
        'PROVIDER_REJECTED_FAILED'
    ])('accepts the %s call outcome', (outcome) => {
        expect(
            RefundProviderCallRetryResponseSchema.safeParse({
                refundId,
                status: 'CONFIRMED',
                calls: [{ ...call, outcome }],
                execution: null
            }).success
        ).toBe(true);
    });

    it('accepts an RF3 outcome or null, and refuses an unknown one', () => {
        const base = { refundId, status: 'EXECUTED', calls: [call] };
        expect(
            RefundProviderCallRetryResponseSchema.safeParse({ ...base, execution: 'EXECUTED' })
                .success
        ).toBe(true);
        expect(
            RefundProviderCallRetryResponseSchema.safeParse({ ...base, execution: 'DONE' }).success
        ).toBe(false);
        expect(
            RefundProviderCallRetryResponseSchema.safeParse({
                ...base,
                status: 'REQUESTED',
                execution: null
            }).success
        ).toBe(false);
    });
});
