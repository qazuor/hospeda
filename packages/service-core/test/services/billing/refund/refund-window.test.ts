import { describe, expect, it } from 'vitest';
import { providerRefundWindow } from '../../../../src/services/billing/refund/refund-window.js';

describe('TEST:B6:5 AC:B6:7 provider refund window', () => {
    it('is open one millisecond before the deadline and closed at the deadline', () => {
        // Arrange
        const factAt = new Date('2026-01-01T00:00:00.000Z');
        const closesAt = new Date(factAt.getTime() + 180 * 86400000);

        // Act
        const before = providerRefundWindow({ factAt, now: new Date(closesAt.getTime() - 1) });
        const at = providerRefundWindow({ factAt, now: closesAt });

        // Assert
        expect(before).toEqual({ open: true, closesAt });
        expect(at).toEqual({ open: false, closesAt });
    });
});
