/**
 * POST /api/v1/admin/session-recording/purge (HOS-2347), through the real app.
 *
 * 401 without a session, 403 without `analytics.sessionRecording.manage`, 503
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
        const res = await app.request(PURGE, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(401);
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('answers 403 to an admin without the permission, before purging', async () => {
        const res = await app.request(PURGE, { method: 'POST', headers: NOT_MANAGER });

        expect(res.status).toBe(403);
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('answers 503 SERVICE_UNAVAILABLE when the Umami DB URL is unset', async () => {
        // Arrange
        purgeMock.mockResolvedValue({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });

        // Act
        const res = await app.request(PURGE, { method: 'POST', headers: MANAGER });
        const body = (await res.json()) as { success: boolean; error?: { code?: string } };

        // Assert
        expect(res.status).toBe(503);
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('answers 200 with the counts and the period used', async () => {
        // Arrange
        retention.mockResolvedValue(60);
        purgeMock.mockResolvedValue({
            status: 'purged',
            replaysDeleted: 12,
            heatmapEventsDeleted: 340,
            stoppedEarly: false
        });

        // Act
        const res = await app.request(PURGE, { method: 'POST', headers: MANAGER });
        const body = (await res.json()) as { data: unknown };

        // Assert
        expect(res.status).toBe(200);
        expect(purgeMock).toHaveBeenCalledWith({ retentionDays: 60 });
        expect(body.data).toEqual({
            replaysDeleted: 12,
            heatmapEventsDeleted: 340,
            retentionDays: 60
        });
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
