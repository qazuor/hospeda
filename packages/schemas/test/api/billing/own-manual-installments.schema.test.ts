import { describe, expect, it } from 'vitest';
import { OwnManualInstallmentsResponseSchema } from '../../../src/api/billing/own-manual-installments.schema';

const row = {
    subscriptionId: '00000000-0000-4000-8000-000000000001',
    manualPaymentId: '00000000-0000-4000-8000-000000000002',
    vertical: 'partner',
    plan: { slug: 'partner-monthly', name: 'Partner' },
    amount: { amountMinor: 10000, currency: 'ARS' },
    periodStart: '2026-11-01T00:00:00.000Z',
    dueAt: '2026-11-20T00:00:00.000Z'
};

describe('OwnManualInstallmentsResponseSchema (HOS-1782)', () => {
    it('parses an installment with amount', () => {
        // Arrange
        const input = { installments: [row] };
        // Act
        const result = OwnManualInstallmentsResponseSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('parses an installment without amount', () => {
        // Arrange
        const input = { installments: [{ ...row, amount: null }] };
        // Act
        const result = OwnManualInstallmentsResponseSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a non-ARS amount', () => {
        // Arrange
        const input = {
            installments: [{ ...row, amount: { amountMinor: 10000, currency: 'USD' } }]
        };
        // Act
        const result = OwnManualInstallmentsResponseSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });
});
