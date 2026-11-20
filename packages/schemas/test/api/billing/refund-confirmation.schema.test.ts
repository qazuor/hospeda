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
        'PROVIDER_REJECTED_FAILED',
        'AWAITING_PROVIDER_ANSWER',
        'CHARGED_BACK'
    ] as const)('accepts the %s service outcome', (outcome) => {
        const status =
            outcome === 'CHARGED_BACK' || outcome === 'PROVIDER_REJECTED_FAILED'
                ? 'FAILED'
                : 'CONFIRMED';
        expect(
            RefundConfirmationResponseSchema.safeParse({ refundId, status, outcome, calls: [] })
                .success
        ).toBe(true);
    });

    it.each([
        'ORDER_REFUND_HELD',
        'PROVIDER_KEY_CONFLICT',
        'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
    ])('rejects the %s outcome of the retired order refund channel (HOS-2179 T-7)', (outcome) => {
        // Arrange
        const response = { refundId, status: 'CONFIRMED', outcome, calls: [] };

        // Act
        const parsed = RefundConfirmationResponseSchema.safeParse(response);

        // Assert
        expect(parsed.success).toBe(false);
    });
});
