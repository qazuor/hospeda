import { describe, expect, it } from 'vitest';
import { LateManualPaymentPreviewResponseSchema } from '../../../src/api/billing/manual-payment.schema';

const base = {
    subscriptionId: '11111111-1111-4111-8111-111111111111',
    manualPaymentId: '22222222-2222-4222-8222-222222222222',
    periodStart: '2026-08-03T12:00:00.000Z',
    reimputedPeriodStart: null,
    nextChargeAt: '2026-09-03T12:00:00.000Z',
    vertical: 'accommodation'
};

describe('HOS-1640 LateManualPaymentPreviewResponseSchema', () => {
    it('accepts an S7 confirmation with listings and the three effects', () => {
        // Arrange
        const value = {
            ...base,
            effect: 'S7',
            periodCase: 'WITHIN_PERIOD',
            nextChargeOverdue: false,
            presence: {
                kind: 'LISTINGS',
                vertical: 'accommodation',
                limit: 2,
                listings: [
                    {
                        id: '33333333-3333-4333-8333-333333333333',
                        name: 'Casa',
                        publicationStatus: 'ARCHIVED',
                        outcome: 'ARCHIVED_DRAFT'
                    }
                ]
            },
            s7Effects: {
                complements: { resumed: [], skipped: [] },
                touristVip: { cancels: false, subscriptionIds: [] },
                scheduledChange: { effectiveAt: '2026-09-01T00:00:00.000Z' }
            }
        };

        // Act
        const result = LateManualPaymentPreviewResponseSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts an S19 confirmation with no presence and no effects', () => {
        // Arrange
        const value = {
            ...base,
            effect: 'S19',
            periodCase: 'WITHIN_PERIOD',
            nextChargeOverdue: true,
            presence: null,
            s7Effects: null
        };

        // Act
        const result = LateManualPaymentPreviewResponseSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects an unknown period case', () => {
        // Arrange
        const value = {
            ...base,
            effect: 'S7',
            periodCase: 'SOMETHING_ELSE',
            nextChargeOverdue: false,
            presence: null,
            s7Effects: null
        };

        // Act
        const result = LateManualPaymentPreviewResponseSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(false);
    });
});
