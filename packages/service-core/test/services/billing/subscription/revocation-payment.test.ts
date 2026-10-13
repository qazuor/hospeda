import { describe, expect, it } from 'vitest';
import {
    REVOCATION_WINDOW_DAYS,
    revocationWindowEndsAt
} from '../../../../src/services/billing/subscription/revocation-payment';

describe('TEST:B5:11 AC:B5:21 the 10 calendar-day window', () => {
    it('is the legal 10 days', () => {
        // Arrange / Act / Assert
        expect(REVOCATION_WINDOW_DAYS).toBe(10);
    });

    it('closes at 00:00 AR of the eleventh day after the charge day', () => {
        // Arrange: 2026-10-01 10:00 in Buenos Aires (-03:00)
        const chargedAt = new Date('2026-10-01T13:00:00.000Z');

        // Act
        const endsAt = revocationWindowEndsAt({ chargedAt });

        // Assert: 2026-10-12 00:00 AR
        expect(endsAt.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    });

    it('counts a charge at 23:30 AR on its local day, not on the UTC one', () => {
        // Arrange: 2026-10-01 23:30 AR is already 2026-10-02 in UTC
        const chargedAt = new Date('2026-10-02T02:30:00.000Z');

        // Act
        const endsAt = revocationWindowEndsAt({ chargedAt });

        // Assert: still 2026-10-12 00:00 AR, never 2026-10-13
        expect(endsAt.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    });
});
