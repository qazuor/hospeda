import { describe, expect, it } from 'vitest';
import {
    isManualInstallmentShown,
    resolveManualInstallmentDueAt
} from '../../../src/routes/billing-subscription/read-own-manual-installments';

describe('manual installment due date (HOS-1782)', () => {
    it('the first installment is due when the authorization window ends', () => {
        // Arrange
        const dueAt = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const result = resolveManualInstallmentDueAt({
            status: 'PENDING_AUTHORIZATION',
            authorizationWindowEndsAt: dueAt,
            graceEndsAt: null
        });
        // Assert
        expect(result).toBe(dueAt);
    });

    it('a renewal installment is due when the grace period ends', () => {
        // Arrange
        const dueAt = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const result = resolveManualInstallmentDueAt({
            status: 'GRACE_PERIOD',
            authorizationWindowEndsAt: null,
            graceEndsAt: dueAt
        });
        // Assert
        expect(result).toBe(dueAt);
    });

    it.each([
        'ACTIVE',
        'SUSPENDED',
        'CANCEL_SCHEDULED',
        'PAUSED',
        'CANCELLED'
    ])('no other subscription state has a due date (%s)', (status) => {
        // Arrange
        // Act
        const result = resolveManualInstallmentDueAt({
            status,
            authorizationWindowEndsAt: new Date(),
            graceEndsAt: new Date()
        });
        // Assert
        expect(result).toBeNull();
    });

    it('an installment is shown only while its due date is ahead', () => {
        // Arrange
        const now = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const atNow = isManualInstallmentShown({ dueAt: now, now });
        const ahead = isManualInstallmentShown({ dueAt: new Date(now.getTime() + 1), now });
        const missing = isManualInstallmentShown({ dueAt: null, now });
        // Assert
        expect(atNow).toBe(false);
        expect(ahead).toBe(true);
        expect(missing).toBe(false);
    });
});
