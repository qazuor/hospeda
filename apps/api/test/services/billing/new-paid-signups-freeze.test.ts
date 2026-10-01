/**
 * Unit tests for the new-paid-signups freeze gate.
 *
 * The gate is the single reader of `billing_settings.newPaidSignupsFrozen` on
 * the request path, so these tests pin both halves of its contract: it
 * refuses with the domain code (never a generic one) while frozen, and it is
 * silent otherwise — including for a malformed stored value.
 *
 * @module test/services/billing/new-paid-signups-freeze
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockLoggerInfo } = vi.hoisted(() => ({
    mockGetSettings: vi.fn(),
    mockLoggerInfo: vi.fn()
}));

vi.mock('../../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: mockLoggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    assertNewPaidSignupsAllowed,
    NEW_PAID_SIGNUPS_FROZEN_MESSAGE,
    readNewPaidSignupsFreeze
} from '../../../src/services/billing/new-paid-signups-freeze';

describe('readNewPaidSignupsFreeze', () => {
    beforeEach(() => {
        mockGetSettings.mockReset();
    });

    it('reports frozen when the setting is true', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = await readNewPaidSignupsFreeze();

        // Assert
        expect(result).toEqual({ frozen: true });
    });

    it('reports not frozen when the setting is false (the shipped default)', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });

        // Act
        const result = await readNewPaidSignupsFreeze();

        // Assert
        expect(result).toEqual({ frozen: false });
    });

    it.each([
        ['missing', undefined],
        ['the string "true"', 'true'],
        ['the number 1', 1]
    ])('reports not frozen when the stored value is %s', async (_label, value) => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: value });

        // Act
        const result = await readNewPaidSignupsFreeze();

        // Assert
        expect(result).toEqual({ frozen: false });
    });
});

describe('assertNewPaidSignupsAllowed', () => {
    beforeEach(() => {
        mockGetSettings.mockReset();
        mockLoggerInfo.mockReset();
    });

    it('resolves without throwing when signups are not frozen', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });

        // Act
        const result = assertNewPaidSignupsAllowed({ entryPoint: 'start-paid' });

        // Assert
        await expect(result).resolves.toBeUndefined();
        expect(mockLoggerInfo).not.toHaveBeenCalled();
    });

    it('throws NEW_PAID_SIGNUPS_FROZEN with the client message when frozen', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = assertNewPaidSignupsAllowed({ entryPoint: 'addon-purchase' });

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN,
            message: NEW_PAID_SIGNUPS_FROZEN_MESSAGE
        });
    });

    it('logs which entry point was refused', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        await assertNewPaidSignupsAllowed({ entryPoint: 'commerce-self-checkout' }).catch(
            () => undefined
        );

        // Assert
        expect(mockLoggerInfo).toHaveBeenCalledWith(
            { entryPoint: 'commerce-self-checkout' },
            expect.stringContaining('frozen')
        );
    });
});
