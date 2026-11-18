/**
 * HOS-2347: the session recording switch over HTTP.
 *
 * The routes run for real (route factory + error handler). Only the DB model is
 * stubbed: `PlatformSettingsService` is the REAL service wired to a stubbed
 * `PlatformSettingsModel`, so the per-key permission gate and the value schema
 * are exercised as in production.
 *
 * @module test/routes/platform-settings-session-recording.test
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PRIVATE_CACHE_ENDPOINTS,
    PUBLIC_CACHE_ENDPOINTS
} from '../../src/middlewares/cache.constants';
import { createErrorHandler } from '../../src/middlewares/response';
import { createRouter } from '../../src/utils/create-app';

const { modelMock, warnMock } = vi.hoisted(() => ({
    modelMock: { findByKey: vi.fn(), upsertByKey: vi.fn() },
    warnMock: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        PlatformSettingsService: vi.fn().mockImplementation(function (config: unknown) {
            return new actual.PlatformSettingsService(
                config as ConstructorParameters<typeof actual.PlatformSettingsService>[0],
                modelMock as never
            );
        })
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: warnMock, error: vi.fn() }
}));

const SUPER_ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const mockActor: {
    id: string;
    roles: string[];
    permissions: string[];
    emailVerified: boolean;
    _isSystemActor: boolean;
} = {
    id: SUPER_ADMIN_ID,
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [],
    emailVerified: true,
    _isSystemActor: false
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return { ...actual, getActorFromContext: () => mockActor };
});

const PUBLIC_PATH = '/api/v1/public/session-recording';
const ADMIN_PATH = '/api/v1/admin/platform-settings/analytics.sessionRecording';

async function requestPublic(): Promise<Response> {
    const { publicSessionRecordingRoutes } = await import(
        '../../src/routes/platform-settings/public/session-recording.js'
    );
    const app = createRouter();
    app.onError(createErrorHandler());
    app.route(PUBLIC_PATH, publicSessionRecordingRoutes);
    return app.request(PUBLIC_PATH);
}

async function requestAdmin(method: 'GET' | 'PATCH', body?: unknown): Promise<Response> {
    const { adminPlatformSettingsRoutes } = await import(
        '../../src/routes/platform-settings/admin/index.js'
    );
    const app = createRouter();
    app.onError(createErrorHandler());
    app.route('/api/v1/admin/platform-settings', adminPlatformSettingsRoutes);
    return app.request(ADMIN_PATH, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
}

/** Unwraps the `{ success, data }` envelope of a 200. */
async function dataOf(response: Response): Promise<unknown> {
    const body = (await response.json()) as { data?: unknown };
    return body.data;
}

describe('GET /api/v1/public/session-recording (HOS-2347)', () => {
    beforeEach(() => {
        modelMock.findByKey.mockReset();
        warnMock.mockReset();
    });

    it('AC-P1: answers 200 { enabled: false } with no row and no auth', async () => {
        // Arrange
        modelMock.findByKey.mockResolvedValue(undefined);

        // Act
        const response = await requestPublic();

        // Assert
        expect(response.status).toBe(200);
        expect(await dataOf(response)).toEqual({ enabled: false });
    });

    it('AC-P2: answers { enabled: true } with exactly one key', async () => {
        // Arrange
        modelMock.findByKey.mockResolvedValue({
            key: 'analytics.sessionRecording',
            value: { enabled: true },
            updatedAt: new Date('2026-11-18T00:00:00Z'),
            updatedBy: SUPER_ADMIN_ID
        });

        // Act
        const response = await requestPublic();
        const data = (await dataOf(response)) as Record<string, unknown>;

        // Assert
        expect(response.status).toBe(200);
        expect(Object.keys(data)).toEqual(['enabled']);
        expect(data.enabled).toBe(true);
    });

    it('AC-P3: every 200 carries the 30 s public Cache-Control', async () => {
        modelMock.findByKey.mockResolvedValue(undefined);

        const response = await requestPublic();

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, s-maxage=30');
    });

    it('AC-P3 guard: the path is in neither in-process cache list', () => {
        const all: readonly string[] = [...PUBLIC_CACHE_ENDPOINTS, ...PRIVATE_CACHE_ENDPOINTS];
        const covering = all.filter(
            (prefix) => PUBLIC_PATH === prefix || PUBLIC_PATH.startsWith(`${prefix}/`)
        );
        expect(covering).toEqual([]);
    });

    it('AC-P4: answers { enabled: false } and logs one warning for a malformed value', async () => {
        // Arrange
        modelMock.findByKey.mockResolvedValue({
            key: 'analytics.sessionRecording',
            value: { enabled: 'true' },
            updatedAt: new Date('2026-11-18T00:00:00Z'),
            updatedBy: SUPER_ADMIN_ID
        });

        // Act
        const response = await requestPublic();

        // Assert
        expect(response.status).toBe(200);
        expect(await dataOf(response)).toEqual({ enabled: false });
        expect(warnMock).toHaveBeenCalledTimes(1);
    });

    it('AC-P5: answers 500 with the standard error body and no public cache header', async () => {
        // Arrange
        modelMock.findByKey.mockRejectedValue(new Error('connection refused'));

        // Act
        const response = await requestPublic();
        const body = (await response.json()) as {
            success?: boolean;
            error?: { code?: string };
        };

        // Assert
        expect(response.status).toBe(500);
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('INTERNAL_ERROR');
        expect(response.headers.get('Cache-Control') ?? '').not.toContain('public');
    });
});

describe('Admin /platform-settings/analytics.sessionRecording (HOS-2347)', () => {
    beforeEach(() => {
        modelMock.findByKey.mockReset();
        modelMock.upsertByKey.mockReset();
        mockActor.permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE
        ];
    });

    it('AC-A4: GET answers 403 to an admin without the permission', async () => {
        // Arrange
        mockActor.permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ANALYTICS_VIEW,
            PermissionEnum.MAINTENANCE_MODE_WRITE
        ];

        // Act
        const response = await requestAdmin('GET');

        // Assert
        expect(response.status).toBe(403);
        expect(modelMock.findByKey).not.toHaveBeenCalled();
    });

    it('AC-A4: PATCH answers 403 to an admin without the permission', async () => {
        mockActor.permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ANALYTICS_VIEW];

        const response = await requestAdmin('PATCH', { value: { enabled: true } });

        expect(response.status).toBe(403);
        expect(modelMock.upsertByKey).not.toHaveBeenCalled();
    });

    it('AC-A1: GET answers 200 null when the key was never written', async () => {
        modelMock.findByKey.mockResolvedValue(undefined);

        const response = await requestAdmin('GET');

        expect(response.status).toBe(200);
        expect(await dataOf(response)).toBeNull();
    });

    it('AC-A2: PATCH stores { enabled: true } with updatedBy = the actor id', async () => {
        // Arrange
        modelMock.upsertByKey.mockResolvedValue({
            key: 'analytics.sessionRecording',
            value: { enabled: true },
            updatedAt: new Date('2026-11-18T03:00:00.000Z'),
            updatedBy: SUPER_ADMIN_ID
        });

        // Act
        const response = await requestAdmin('PATCH', { value: { enabled: true } });

        // Assert
        expect(response.status).toBe(200);
        expect(modelMock.upsertByKey).toHaveBeenCalledWith(
            'analytics.sessionRecording',
            { enabled: true },
            SUPER_ADMIN_ID,
            undefined
        );
        expect(await dataOf(response)).toEqual({
            key: 'analytics.sessionRecording',
            value: { enabled: true },
            updatedAt: '2026-11-18T03:00:00.000Z',
            updatedBy: SUPER_ADMIN_ID
        });
    });

    it('AC-A6: PATCH { enabled: "yes" } answers 400 and stores nothing', async () => {
        const response = await requestAdmin('PATCH', { value: { enabled: 'yes' } });

        expect(response.status).toBe(400);
        expect(modelMock.upsertByKey).not.toHaveBeenCalled();
    });
});
