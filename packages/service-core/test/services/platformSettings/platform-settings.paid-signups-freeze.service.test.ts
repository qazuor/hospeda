/**
 * Unit tests for the HOS-1749 paid signups freeze setting.
 *
 * @module test/services/platformSettings/platform-settings.paid-signups-freeze.service.test
 */

import { PlatformSettingsModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlatformSettingsService } from '../../../src/services/platformSettings/platform-settings.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const freezeRow = {
    key: 'billing.paidSignupsFreeze' as const,
    value: { frozen: true },
    updatedAt: new Date('2026-05-28T00:00:00Z'),
    updatedBy: '22222222-2222-4222-8222-222222222222'
};

const billingFreezeKeys = ['billing.paidSignupsFreeze', 'billing.addonPurchasesFreeze'] as const;

describe('PlatformSettingsService', () => {
    let service: PlatformSettingsService;
    let modelMock: PlatformSettingsModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(PlatformSettingsModel, ['findByKey', 'upsertByKey']);
        loggerMock = createLoggerMock();
        service = new PlatformSettingsService({ logger: loggerMock }, modelMock);
    });

    describe.each(billingFreezeKeys)('HOS-1749 %s setting permissions', (key) => {
        it('reads the freeze setting with BILLING_SETTINGS_VIEW', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.BILLING_SETTINGS_VIEW]
            });
            asMock(modelMock.findByKey).mockResolvedValue({ ...freezeRow, key });

            // Act
            const result = await service.get({ actor, key });

            // Assert
            expectSuccess(result);
            expect(result.data).toMatchObject({
                key,
                value: { frozen: true }
            });
        });

        it('rejects reading the freeze setting without BILLING_SETTINGS_VIEW', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });

            // Act
            const result = await service.get({ actor, key });

            // Assert
            expectForbiddenError(result);
            expect(modelMock.findByKey).toHaveBeenCalledTimes(0);
        });

        it('upserts the freeze setting with BILLING_SETTINGS_WRITE', async () => {
            // Arrange
            const actor: Actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.BILLING_SETTINGS_WRITE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(freezeRow);

            // Act
            const result = await service.upsert({
                actor,
                key,
                value: { frozen: true }
            });

            // Assert
            expectSuccess(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledWith(
                key,
                { frozen: true },
                VALID_UUID,
                undefined
            );
        });

        it('rejects upserting the freeze setting with only BILLING_SETTINGS_VIEW', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.BILLING_SETTINGS_VIEW]
            });

            // Act
            const result = await service.upsert({
                actor,
                key,
                value: { frozen: true }
            });

            // Assert
            expectForbiddenError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });
    });

    describe('HOS-1749 paid signups freeze reader', () => {
        it('rejects an invalid value shape for the freeze setting', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.BILLING_SETTINGS_WRITE]
            });

            // Act
            const result = await service.upsert({
                actor,
                key: 'billing.paidSignupsFreeze',
                value: { enabled: true }
            });

            // Assert
            expectValidationError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });

        it('returns false when the freeze setting row is absent', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue(undefined);

            // Act
            const result = await service.isNewPaidSignupsFrozen();

            // Assert
            expect(result).toBe(false);
        });

        it('returns true when the freeze setting is enabled', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue(freezeRow);

            // Act
            const result = await service.isNewPaidSignupsFrozen();

            // Assert
            expect(result).toBe(true);
        });

        it('returns false when the freeze setting is disabled', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue({
                ...freezeRow,
                value: { frozen: false }
            });

            // Act
            const result = await service.isNewPaidSignupsFrozen();

            // Assert
            expect(result).toBe(false);
        });

        it('returns false and warns when the freeze setting is malformed', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue({ ...freezeRow, value: { frozen: 'x' } });

            // Act
            const result = await service.isNewPaidSignupsFrozen();

            // Assert
            expect(result).toBe(false);
            expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        });

        it('propagates freeze setting read errors', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockRejectedValue(new Error('database unavailable'));

            // Act & Assert
            await expect(service.isNewPaidSignupsFrozen()).rejects.toThrow('database unavailable');
        });
    });

    describe('HOS-1749 addon purchases freeze reader', () => {
        const addonFreezeRow = { ...freezeRow, key: 'billing.addonPurchasesFreeze' as const };

        it('returns false when the freeze setting row is absent', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(undefined);
            await expect(service.isAddonPurchasesFrozen()).resolves.toBe(false);
        });

        it('returns true when the freeze setting is enabled', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(addonFreezeRow);
            await expect(service.isAddonPurchasesFrozen()).resolves.toBe(true);
        });

        it('returns false when the freeze setting is disabled', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({
                ...addonFreezeRow,
                value: { frozen: false }
            });
            await expect(service.isAddonPurchasesFrozen()).resolves.toBe(false);
        });

        it('returns false and warns when the freeze setting is malformed', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({
                ...addonFreezeRow,
                value: { frozen: 'x' }
            });
            await expect(service.isAddonPurchasesFrozen()).resolves.toBe(false);
            expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        });

        it('propagates freeze setting read errors', async () => {
            asMock(modelMock.findByKey).mockRejectedValue(new Error('database unavailable'));
            await expect(service.isAddonPurchasesFrozen()).rejects.toThrow('database unavailable');
        });
    });
});
