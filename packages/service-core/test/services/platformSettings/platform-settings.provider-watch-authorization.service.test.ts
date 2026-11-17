/**
 * Unit tests for the HOS-1512 provider watch authorization setting.
 *
 * @module test/services/platformSettings/platform-settings.provider-watch-authorization.service.test
 */

import { PlatformSettingsModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlatformSettingsService } from '../../../src/services/platformSettings/platform-settings.service.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const KEY = 'billing.providerWatchAuthorization' as const;
const VALUE = { month: '2026-11', maxChargeMinor: 150000 };
const ROW = {
    key: KEY,
    value: VALUE,
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    updatedBy: '22222222-2222-4222-8222-222222222222'
};

describe('PlatformSettingsService provider watch authorization', () => {
    let service: PlatformSettingsService;
    let modelMock: PlatformSettingsModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(PlatformSettingsModel, ['findByKey', 'upsertByKey']);
        loggerMock = createLoggerMock();
        service = new PlatformSettingsService({ logger: loggerMock }, modelMock);
    });

    describe('permissions', () => {
        it('reads with BILLING_SETTINGS_VIEW', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(ROW);
            const actor = createActor({ permissions: [PermissionEnum.BILLING_SETTINGS_VIEW] });
            const result = await service.get({ actor, key: KEY });
            expectSuccess(result);
            expect(result.data).toMatchObject({ key: KEY, value: VALUE });
        });

        it('writes with MAINTENANCE_MODE_WRITE, the SUPER_ADMIN-only critical permission', async () => {
            asMock(modelMock.upsertByKey).mockResolvedValue(ROW);
            const actor = createActor({
                id: VALID_UUID,
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            });
            const result = await service.upsert({ actor, key: KEY, value: VALUE });
            expectSuccess(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledWith(KEY, VALUE, VALID_UUID, undefined);
        });

        it('refuses a write with BILLING_SETTINGS_WRITE alone: an ADMIN cannot authorize spending', async () => {
            const actor = createActor({ permissions: [PermissionEnum.BILLING_SETTINGS_WRITE] });
            const result = await service.upsert({ actor, key: KEY, value: VALUE });
            expectForbiddenError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });

        it('rejects a value that is not a month and an integer maximum charge', async () => {
            const actor = createActor({ permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE] });
            const result = await service.upsert({
                actor,
                key: KEY,
                value: { month: '2026-11', maxChargeMinor: 1.5 }
            });
            expectValidationError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });
    });

    describe('getProviderWatchAuthorization', () => {
        it('returns the stored authorization', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(ROW);
            await expect(service.getProviderWatchAuthorization()).resolves.toEqual(VALUE);
            expect(modelMock.findByKey).toHaveBeenCalledWith(KEY);
        });

        it('returns null when no row exists', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(undefined);
            await expect(service.getProviderWatchAuthorization()).resolves.toBeNull();
        });

        it('fails closed with a warning when the stored value is malformed', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({ ...ROW, value: { month: 'x' } });
            await expect(service.getProviderWatchAuthorization()).resolves.toBeNull();
            expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        });

        it('propagates read errors instead of answering "not authorized"', async () => {
            asMock(modelMock.findByKey).mockRejectedValue(new Error('database unavailable'));
            await expect(service.getProviderWatchAuthorization()).rejects.toThrow(
                'database unavailable'
            );
        });
    });
});
