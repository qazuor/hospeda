/**
 * accommodation-publish-deps × new-paid-signups freeze.
 *
 * `AccommodationService.publish()` decides WHEN the freeze applies (a first
 * publish by the owner); the API deps factory supplies HOW it is read. This
 * pins that the factory's `readNewSignupsFreeze` reads the real billing
 * setting, so a frozen platform reaches the service as `{ frozen: true }`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings } = vi.hoisted(() => ({ mockGetSettings: vi.fn() }));

vi.mock('../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/services/billing/trial-eligibility.service', () => ({
    resolveTrialEligibility: vi.fn()
}));

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

describe('buildAccommodationPublishDeps — readNewSignupsFreeze', () => {
    beforeEach(() => {
        mockGetSettings.mockReset();
    });

    it('reads frozen: true from the billing settings', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.readNewSignupsFreeze?.();

        // Assert
        expect(result).toEqual({ frozen: true });
    });

    it('reads frozen: false when the freeze is off', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.readNewSignupsFreeze?.();

        // Assert
        expect(result).toEqual({ frozen: false });
    });
});
