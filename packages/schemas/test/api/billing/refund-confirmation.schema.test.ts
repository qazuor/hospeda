import { describe, expect, it } from 'vitest';
import {
    RefundConfirmationRequestSchema,
    RefundConfirmationResponseSchema
} from '../../../src/api/billing/refund-confirmation.schema';

const refundId = '00000000-0000-4000-8000-000000000001';

describe('refund confirmation schemas', () => {
    it('requires explicit confirmation', () => {
        expect(RefundConfirmationRequestSchema.safeParse({ confirmed: true }).success).toBe(true);
        expect(RefundConfirmationRequestSchema.safeParse({ confirmed: false }).success).toBe(false);
        expect(RefundConfirmationRequestSchema.safeParse({}).success).toBe(false);
    });

    it.each([
        'SENT',
        'NOT_ACCEPTED_KEPT_CONFIRMED',
        'PROVIDER_REJECTED_KEPT_CONFIRMED',
        'AWAITING_PROVIDER_ANSWER',
        'CHARGED_BACK'
    ] as const)('accepts the %s service outcome', (outcome) => {
        const status = outcome === 'CHARGED_BACK' ? 'FAILED' : 'CONFIRMED';
        expect(
            RefundConfirmationResponseSchema.safeParse({ refundId, status, outcome, calls: [] })
                .success
        ).toBe(true);
    });
});
