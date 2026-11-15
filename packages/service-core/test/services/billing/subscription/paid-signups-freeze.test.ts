import { describe, expect, it, vi } from 'vitest';
import {
    assertNewPaidSignupsOpen,
    platformPaidSignupsFreeze
} from '../../../../src/services/billing/subscription/paid-signups-freeze';
import { PlatformSettingsService } from '../../../../src/services/platformSettings/platform-settings.service';
import { ServiceError } from '../../../../src/types';

describe('HOS-1749 the paid signups freeze refuses a new signup with 409 NEW_PAID_SIGNUPS_FROZEN', () => {
    it('throws NEW_PAID_SIGNUPS_FROZEN while frozen', async () => {
        // Arrange
        const freeze = { isFrozen: vi.fn(async () => true) };

        // Act
        const action = assertNewPaidSignupsOpen({ freeze });

        // Assert
        await expect(action).rejects.toMatchObject({ code: 'NEW_PAID_SIGNUPS_FROZEN' });
        await expect(action).rejects.toBeInstanceOf(ServiceError);
    });

    it('resolves while not frozen', async () => {
        // Arrange
        const freeze = { isFrozen: vi.fn(async () => false) };

        // Act & Assert
        await expect(assertNewPaidSignupsOpen({ freeze })).resolves.toBeUndefined();
    });

    it('the platform port asks the platform settings service', async () => {
        // Arrange
        const reader = vi
            .spyOn(PlatformSettingsService.prototype, 'isNewPaidSignupsFrozen')
            .mockResolvedValue(true);

        // Act
        const result = await platformPaidSignupsFreeze.isFrozen();

        // Assert
        expect(result).toBe(true);
        expect(reader).toHaveBeenCalledTimes(1);
    });
});
