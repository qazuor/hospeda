/**
 * POST /api/v1/admin/session-recording/purge (HOS-2347), through the real app.
 *
 * 401 without a session, 403 without `analytics.sessionRecording.manage`, 400 for a bad body,
 * `SERVICE_UNAVAILABLE` when the Umami DB is not configured, 200 with the counts.
 * The retention period travels through the platform-settings PATCH (400 for a
 * period outside 14/30/60). The purge itself is a spy: its SQL is pinned in
 * `test/services/session-recording-purge.test.ts`.
 */

import { PlatformSettingsService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The global setup swaps `ServiceError` for a double the error handler does not
// recognise; the real class is restored so 403 / 503 / 400 map correctly.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

const { purgeMock } = vi.hoisted(() => ({ purgeMock: vi.fn() }));
vi.mock('../../src/services/session-recording-purge.js', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    purgeSessionRecordingsFromEnv: purgeMock
}));

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PURGE = '/api/v1/admin/session-recording/purge';
const SETTING = '/api/v1/admin/platform-settings/analytics.sessionRecording';

const headersFor = (permissions: readonly string[]) => ({
    'user-agent': 'vitest',
    'content-type': 'application/json',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...permissions])
});
const MANAGER = headersFor(['analytics.sessionRecording.manage']);
const NOT_MANAGER = headersFor(['analytics.view']);

const post = (app: AppOpenAPI, headers: Record<string, string>, body?: unknown) =>
    app.request(PURGE, {
        method: 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

const PURGED = {
    status: 'purged',
    replaysDeleted: 12,
    heatmapEventsDeleted: 340,
    savedReplaysDeleted: 1,
    stoppedEarly: false
} as const;

describe('POST /api/v1/admin/session-recording/purge', () => {
    let app: AppOpenAPI;
    let retention: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        app = initApp();
        purgeMock.mockReset();
        retention = vi
            .spyOn(PlatformSettingsService.prototype, 'getSessionRecordingRetentionDays')
            .mockResolvedValue(30);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('answers 401 without a session', async () => {
        const res = await post(
            app,
            { 'user-agent': 'vitest', 'content-type': 'application/json' },
            { retentionDays: 30 }
        );

        expect(res.status).toBe(401);
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('answers 403 to an admin without the permission, before purging', async () => {
        const res = await post(app, NOT_MANAGER, { retentionDays: 30 });

        expect(res.status).toBe(403);
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it.each([
        { retentionDays: 45 },
        {},
        { retentionDays: 30, extra: true }
    ])('answers 400 for the body %j', async (body) => {
        const res = await post(app, MANAGER, body);

        expect(res.status).toBe(400);
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('answers 409 RECORDING_RETENTION_MISMATCH when the stored period differs from the confirmed one', async () => {
        // Arrange: the admin confirmed 60 but somebody saved 14 meanwhile
        retention.mockResolvedValue(14);

        // Act
        const res = await post(app, MANAGER, { retentionDays: 60 });
        const body = (await res.json()) as {
            error?: { code?: string; reason?: string; details?: { storedRetentionDays?: number } };
        };

        // Assert
        expect(res.status).toBe(409);
        expect(body.error?.code).toBe('ALREADY_EXISTS');
        expect(body.error?.reason).toBe('RECORDING_RETENTION_MISMATCH');
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('answers 409 RECORDING_PURGE_ALREADY_RUNNING when another purge holds the lock', async () => {
        // Arrange
        purgeMock.mockResolvedValue({ status: 'locked' });

        // Act
        const res = await post(app, MANAGER, { retentionDays: 30 });
        const body = (await res.json()) as { error?: { code?: string; reason?: string } };

        // Assert
        expect(res.status).toBe(409);
        expect(body.error?.reason).toBe('RECORDING_PURGE_ALREADY_RUNNING');
    });

    it('answers 503 SERVICE_UNAVAILABLE when the Umami DB URL is unset (the reason is masked on a 5xx)', async () => {
        // Arrange
        purgeMock.mockResolvedValue({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });

        // Act
        const res = await post(app, MANAGER, { retentionDays: 30 });
        const body = (await res.json()) as { success: boolean; error?: { code?: string } };

        // Assert
        expect(res.status).toBe(503);
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('answers 200 with the counts, the period used and a time-budget signal when the confirmed period matches', async () => {
        // Arrange
        retention.mockResolvedValue(60);
        purgeMock.mockResolvedValue(PURGED);

        // Act
        const res = await post(app, MANAGER, { retentionDays: 60 });
        const body = (await res.json()) as { data: unknown };

        // Assert
        expect(res.status).toBe(200);
        expect(purgeMock).toHaveBeenCalledWith({
            retentionDays: 60,
            signal: expect.any(AbortSignal)
        });
        expect(body.data).toEqual({
            replaysDeleted: 12,
            heatmapEventsDeleted: 340,
            savedReplaysDeleted: 1,
            retentionDays: 60,
            stoppedEarly: false
        });
    });

    it('reports stoppedEarly when the time budget cut the purge short', async () => {
        purgeMock.mockResolvedValue({ ...PURGED, stoppedEarly: true });

        const res = await post(app, MANAGER, { retentionDays: 30 });
        const body = (await res.json()) as { data: { stoppedEarly: boolean } };

        expect(res.status).toBe(200);
        expect(body.data.stoppedEarly).toBe(true);
    });
});

describe('PATCH analytics.sessionRecording retention period', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([7, 45, 90, '30'])('answers 400 for the period %s and stores nothing', async (days) => {
        // Arrange
        const upsert = vi.spyOn(PlatformSettingsService.prototype, 'upsert');

        // Act
        const res = await app.request(SETTING, {
            method: 'PATCH',
            headers: MANAGER,
            body: JSON.stringify({ value: { enabled: true, retentionDays: days } })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(upsert).toHaveBeenCalledTimes(1);
        const result = await upsert.mock.results[0]?.value;
        expect(result.error).toBeDefined();
    });
});

describe('PATCH analytics.sessionRecording partial writes merge with the stored value', () => {
    let app: AppOpenAPI;
    let findByKey: ReturnType<typeof vi.spyOn>;
    let upsertByKey: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        app = initApp();
        const { PlatformSettingsModel } = await import('@repo/db');
        findByKey = vi.spyOn(PlatformSettingsModel.prototype, 'findByKey');
        upsertByKey = vi.spyOn(PlatformSettingsModel.prototype, 'upsertByKey').mockImplementation(
            async (key: string, value: unknown) =>
                ({
                    key,
                    value,
                    updatedAt: new Date('2026-11-18T03:00:00.000Z'),
                    updatedBy: ACTOR_ID
                }) as never
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const patch = (value: unknown) =>
        app.request(SETTING, {
            method: 'PATCH',
            headers: MANAGER,
            body: JSON.stringify({ value })
        });

    it('a value without retentionDays keeps the stored 60, it does not reset to 30', async () => {
        // Arrange
        findByKey.mockResolvedValue({
            key: 'analytics.sessionRecording',
            value: { enabled: false, retentionDays: 60 }
        } as never);

        // Act
        const res = await patch({ enabled: true });

        // Assert
        expect(res.status).toBe(200);
        expect(upsertByKey.mock.calls[0]?.[1]).toEqual({ enabled: true, retentionDays: 60 });
    });

    it('a value without enabled keeps the stored switch', async () => {
        findByKey.mockResolvedValue({
            key: 'analytics.sessionRecording',
            value: { enabled: true, retentionDays: 30 }
        } as never);

        const res = await patch({ retentionDays: 14 });

        expect(res.status).toBe(200);
        expect(upsertByKey.mock.calls[0]?.[1]).toEqual({ enabled: true, retentionDays: 14 });
    });

    it('falls back to OFF and 30 days when nothing is stored', async () => {
        findByKey.mockResolvedValue(undefined as never);

        const res = await patch({ retentionDays: 60 });

        expect(res.status).toBe(200);
        expect(upsertByKey.mock.calls[0]?.[1]).toEqual({ enabled: false, retentionDays: 60 });
    });

    it('an empty value answers 400 and stores nothing', async () => {
        const res = await patch({});

        expect(res.status).toBe(400);
        expect(upsertByKey).not.toHaveBeenCalled();
    });
});
