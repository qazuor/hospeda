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

describe('PlatformSettingsService', () => {
    let service: PlatformSettingsService;
    let modelMock: PlatformSettingsModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(PlatformSettingsModel, ['findByKey', 'upsertByKey']);
        loggerMock = createLoggerMock();
        service = new PlatformSettingsService({ logger: loggerMock }, modelMock);
    });

    describe('HOS-1749 paid signups freeze setting', () => {
        it('reads the freeze setting with BILLING_SETTINGS_VIEW', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.BILLING_SETTINGS_VIEW]
            });
            asMock(modelMock.findByKey).mockResolvedValue(freezeRow);

            // Act
            const result = await service.get({ actor, key: 'billing.paidSignupsFreeze' });

            // Assert
            expectSuccess(result);
            expect(result.data).toMatchObject({
                key: 'billing.paidSignupsFreeze',
                value: { frozen: true }
            });
        });

        it('rejects reading the freeze setting without BILLING_SETTINGS_VIEW', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });

            // Act
            const result = await service.get({ actor, key: 'billing.paidSignupsFreeze' });

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
                key: 'billing.paidSignupsFreeze',
                value: { frozen: true }
            });

            // Assert
            expectSuccess(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledWith(
                'billing.paidSignupsFreeze',
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
                key: 'billing.paidSignupsFreeze',
                value: { frozen: true }
            });

            // Assert
            expectForbiddenError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });

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
});
