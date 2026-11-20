import { describe, expect, it } from 'vitest';
import {
    RefundRemainderSettlementParamsSchema,
    RefundRemainderSettlementRequestSchema,
    RefundRemainderSettlementResponseSchema
} from '../../../src/api/billing/refund-remainder-settlement.schema.js';

const refundId = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

describe('Refund remainder settlement schemas (HOS-2406)', () => {
    it('accepts a remainder with a trimmed panel reference and an optional note', () => {
        // Arrange
        const body = { amount: 2000, reference: '  mp-123  ', note: ' done by hand ' };

        // Act
        const parsed = RefundRemainderSettlementRequestSchema.parse(body);

        // Assert
        expect(parsed).toEqual({ amount: 2000, reference: 'mp-123', note: 'done by hand' });
        expect(RefundRemainderSettlementParamsSchema.parse({ refundId })).toEqual({ refundId });
    });

    it('rejects a non-positive or fractional amount, an empty or long reference, a bad id', () => {
        // Arrange
        const invalid = [
            { amount: 0, reference: 'mp' },
            { amount: -1, reference: 'mp' },
            { amount: 10.5, reference: 'mp' },
            { amount: 100, reference: '   ' },
            { amount: 100, reference: 'x'.repeat(256) },
            { reference: 'mp' }
        ];

        // Act
        const results = invalid.map(
            (body) => RefundRemainderSettlementRequestSchema.safeParse(body).success
        );

        // Assert
        expect(results).toEqual(invalid.map(() => false));
        expect(RefundRemainderSettlementParamsSchema.safeParse({ refundId: 'x' }).success).toBe(
            false
        );
    });

    it('describes an EXECUTED refund with its accepted part and remainder', () => {
        // Arrange
        const response = {
            refundId,
            status: 'EXECUTED',
            acceptedAmount: 4000,
            remainderAmount: 2000,
            paymentOutcome: 'P4',
            coverageReleased: false
        };

        // Act
        const parsed = RefundRemainderSettlementResponseSchema.safeParse(response);
        const confirmed = RefundRemainderSettlementResponseSchema.safeParse({
            ...response,
            status: 'CONFIRMED'
        });

        // Assert
        expect(parsed.success).toBe(true);
        expect(confirmed.success).toBe(false);
    });
});
