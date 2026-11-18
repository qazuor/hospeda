/**
 * Unit tests for the HOS-2347 session recording setting
 * (`analytics.sessionRecording`).
 *
 * @module test/services/platformSettings/platform-settings.session-recording.service.test
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

const KEY = 'analytics.sessionRecording' as const;
const SUPER_ADMIN_ID = '11111111-1111-4111-8111-111111111111';

const recordingRow = {
    key: KEY,
    value: { enabled: true },
    updatedAt: new Date('2026-11-18T00:00:00Z'),
    updatedBy: SUPER_ADMIN_ID
};

describe('PlatformSettingsService — analytics.sessionRecording (HOS-2347)', () => {
    let service: PlatformSettingsService;
    let modelMock: PlatformSettingsModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(PlatformSettingsModel, ['findByKey', 'upsertByKey']);
        loggerMock = createLoggerMock();
        service = new PlatformSettingsService({ logger: loggerMock }, modelMock);
    });

    describe('admin read and write gate', () => {
        it('reads the setting with ANALYTICS_SESSION_RECORDING_MANAGE', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]
            });
            asMock(modelMock.findByKey).mockResolvedValue(recordingRow);

            // Act
            const result = await service.get({ actor, key: KEY });

            // Assert
            expectSuccess(result);
            expect(result.data).toEqual(recordingRow);
        });

        it('AC-A4: forbids the read without the permission (an ADMIN-like actor)', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ANALYTICS_VIEW,
                    PermissionEnum.MAINTENANCE_MODE_WRITE
                ]
            });

            // Act
            const result = await service.get({ actor, key: KEY });

            // Assert
            expectForbiddenError(result);
            expect(modelMock.findByKey).toHaveBeenCalledTimes(0);
        });

        it('AC-A2: upserts { enabled: true } with updatedBy = the actor id', async () => {
            // Arrange
            const actor: Actor = createActor({
                id: SUPER_ADMIN_ID,
                permissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]
            });
            asMock(modelMock.upsertByKey).mockResolvedValue(recordingRow);

            // Act
            const result = await service.upsert({ actor, key: KEY, value: { enabled: true } });

            // Assert
            expectSuccess(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledWith(
                KEY,
                { enabled: true, retentionDays: 30 },
                SUPER_ADMIN_ID,
                undefined
            );
        });

        it('AC-A4: forbids the write without the permission', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ANALYTICS_VIEW]
            });

            // Act
            const result = await service.upsert({ actor, key: KEY, value: { enabled: true } });

            // Assert
            expectForbiddenError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });

        it('AC-A6: rejects { enabled: "yes" } and stores nothing', async () => {
            // Arrange
            const actor: Actor = createActor({
                permissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]
            });

            // Act
            const result = await service.upsert({ actor, key: KEY, value: { enabled: 'yes' } });

            // Assert
            expectValidationError(result);
            expect(modelMock.upsertByKey).toHaveBeenCalledTimes(0);
        });
    });

    describe('isSessionRecordingEnabled', () => {
        it('AC-P1: answers false when the key was never written', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue(undefined);

            // Act
            const enabled = await service.isSessionRecordingEnabled();

            // Assert
            expect(enabled).toBe(false);
            expect(modelMock.findByKey).toHaveBeenCalledWith(KEY);
        });

        it('AC-P2: answers true when { enabled: true } is stored', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(recordingRow);
            await expect(service.isSessionRecordingEnabled()).resolves.toBe(true);
        });

        it('answers false when { enabled: false } is stored', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({
                ...recordingRow,
                value: { enabled: false }
            });
            await expect(service.isSessionRecordingEnabled()).resolves.toBe(false);
        });

        it('AC-P4: answers false and logs ONE warning when the stored value fails the schema', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue({
                ...recordingRow,
                value: { enabled: 'true' }
            });

            // Act
            const enabled = await service.isSessionRecordingEnabled();

            // Assert
            expect(enabled).toBe(false);
            expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        });

        it('AC-P5: propagates a DB read error (the route answers 500)', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockRejectedValue(new Error('connection refused'));

            // Act / Assert
            await expect(service.isSessionRecordingEnabled()).rejects.toThrow('connection refused');
        });
    });

    describe('getSessionRecordingRetentionDays (retention)', () => {
        it('answers the default 30 when the key was never written', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(null);
            await expect(service.getSessionRecordingRetentionDays()).resolves.toBe(30);
        });

        it('answers 30 for a row written before the field existed', async () => {
            asMock(modelMock.findByKey).mockResolvedValue(recordingRow);
            await expect(service.getSessionRecordingRetentionDays()).resolves.toBe(30);
        });

        it.each([14, 30, 60])('answers the stored %i days', async (days) => {
            asMock(modelMock.findByKey).mockResolvedValue({
                ...recordingRow,
                value: { enabled: true, retentionDays: days }
            });
            await expect(service.getSessionRecordingRetentionDays()).resolves.toBe(days);
        });

        it('answers the period even when the switch is OFF (old data still has to go)', async () => {
            asMock(modelMock.findByKey).mockResolvedValue({
                ...recordingRow,
                value: { enabled: false, retentionDays: 14 }
            });
            await expect(service.getSessionRecordingRetentionDays()).resolves.toBe(14);
        });

        it('answers 30 and logs ONE warning when the stored value fails the schema', async () => {
            // Arrange
            asMock(modelMock.findByKey).mockResolvedValue({
                ...recordingRow,
                value: { enabled: true, retentionDays: 45 }
            });

            // Act
            const days = await service.getSessionRecordingRetentionDays();

            // Assert
            expect(days).toBe(30);
            expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        });

        it('propagates a DB read error instead of purging on a guess', async () => {
            asMock(modelMock.findByKey).mockRejectedValue(new Error('connection refused'));
            await expect(service.getSessionRecordingRetentionDays()).rejects.toThrow(
                'connection refused'
            );
        });
    });

    it('an upsert with no retentionDays stores the default 30, never a missing field', async () => {
        // Arrange
        const actor: Actor = createActor({
            permissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]
        });
        asMock(modelMock.upsertByKey).mockResolvedValue(recordingRow);

        // Act
        await service.upsert({ actor, key: KEY, value: { enabled: true } });

        // Assert
        expect(modelMock.upsertByKey).toHaveBeenCalledWith(
            KEY,
            { enabled: true, retentionDays: 30 },
            expect.any(String),
            undefined
        );
    });
});
