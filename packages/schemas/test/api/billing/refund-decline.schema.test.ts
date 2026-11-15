import { describe, expect, it } from 'vitest';
import {
    RefundDeclineParamsSchema,
    RefundDeclineRequestSchema,
    RefundDeclineResponseSchema
} from '../../../src/api/billing/refund-decline.schema.js';

const refundId = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

describe('Refund decline schemas', () => {
    it('accepts the explicit RF5 request and response', () => {
        expect(RefundDeclineParamsSchema.parse({ refundId })).toEqual({ refundId });
        expect(RefundDeclineRequestSchema.parse({ declined: true })).toEqual({ declined: true });
        expect(RefundDeclineResponseSchema.parse({ refundId, status: 'FAILED' })).toEqual({
            refundId,
            status: 'FAILED'
        });
    });

    it('rejects malformed ids, false or extra decision fields, and non-FAILED responses', () => {
        for (const input of [{}, { declined: false }, { declined: true, extra: true }]) {
            expect(RefundDeclineRequestSchema.safeParse(input).success).toBe(false);
        }
        expect(RefundDeclineParamsSchema.safeParse({ refundId: 'invalid' }).success).toBe(false);
        expect(
            RefundDeclineResponseSchema.safeParse({ refundId, status: 'CONFIRMED' }).success
        ).toBe(false);
    });
});
