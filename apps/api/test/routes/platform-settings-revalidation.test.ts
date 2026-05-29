/**
 * Integration test: PATCH /api/v1/admin/platform-settings/{key} (SPEC-156 T-031).
 *
 * Crosses the route handler -> PlatformSettingsService.upsert -> model boundary
 * end-to-end via `app.request()`, asserting:
 *
 *   - The handler invokes the real service.upsert with the actor + key + value
 *     (no per-package mocking of the service — only the model is stubbed).
 *   - The per-key Zod gate inside the service still rejects shape mismatches.
 *   - The response is serialized at the API boundary (Date -> ISO string).
 *
 * The revalidation hook itself — fire-and-forget call to
 * `RevalidationService.revalidateByEntityType('post', 'hook')` on every
 * successful `seo.defaults` upsert — is unit-tested at the service layer in
 * `packages/service-core/test/services/platformSettings/platform-settings.service.test.ts`
 * ("SEO revalidation hook" describe block). Cross-package mocking of the
 * service-internal singleton at `@repo/service-core/src/revalidation/...` is
 * not reliable from this test, so we intentionally keep the assertion split:
 *
 *   - Service unit test (already exists): hook fires on seo.defaults upsert
 *     and is skipped for other keys.
 *   - This integration test (new): the API route reaches the service with
 *     the right inputs, so when the service runs in production the hook
 *     will fire.
 *
 * @module test/routes/platform-settings-revalidation
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Env / infrastructure mocks (must come BEFORE route import) ───────────────

vi.mock('../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: false,
            HOSPEDA_BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
            HOSPEDA_SITE_URL: 'http://localhost:4321'
        }
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// ── Actor mock (route handler reads this) ────────────────────────────────────

const SUPER_ADMIN_ACTOR = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'SUPER_ADMIN',
    permissions: [
        'access.panelAdmin',
        'access.apiAdmin',
        'settings.general.view',
        'settings.general.write',
        'system.maintenanceMode.write'
    ]
};

vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => SUPER_ADMIN_ACTOR
    };
});

// ── Model mock (hoisted so vi.mock factory can reach it) ─────────────────────

const { mockUpsertByKey, mockFindByKey } = vi.hoisted(() => ({
    mockUpsertByKey: vi.fn(),
    mockFindByKey: vi.fn()
}));

const seoPersistedRow = {
    key: 'seo.defaults' as const,
    value: {
        metaTitleTemplate: '%s | Hospeda',
        metaDescriptionDefault: 'Alojamientos en Concepción del Uruguay',
        ogImageDefault: 'https://hospeda.com.ar/og.png'
    },
    updatedAt: new Date('2026-05-29T00:00:00Z'),
    updatedBy: SUPER_ADMIN_ACTOR.id
};

const maintenancePersistedRow = {
    key: 'maintenance.mode' as const,
    value: { enabled: true },
    updatedAt: new Date('2026-05-29T00:00:00Z'),
    updatedBy: SUPER_ADMIN_ACTOR.id
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        PlatformSettingsModel: vi.fn().mockImplementation(() => ({
            upsertByKey: mockUpsertByKey,
            findByKey: mockFindByKey
        }))
    };
});

// ── Route import (after every mock is in place) ──────────────────────────────

import { adminPatchPlatformSettingsRoute } from '../../src/routes/platform-settings/admin/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/', adminPatchPlatformSettingsRoute);
    return app;
}

async function patchPlatformSetting(app: Hono, key: string, body: unknown): Promise<Response> {
    return app.request(`/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/admin/platform-settings/{key} (T-031)', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('reaches PlatformSettingsService.upsert with the actor + key + value when PATCHing seo.defaults', async () => {
        mockUpsertByKey.mockResolvedValue(seoPersistedRow);

        const res = await patchPlatformSetting(app, 'seo.defaults', {
            value: seoPersistedRow.value
        });

        expect(res.status).toBe(200);
        expect(mockUpsertByKey).toHaveBeenCalledTimes(1);

        // model.upsertByKey signature: (key, value, actorId, tx?)
        const [key, value, actorId] = mockUpsertByKey.mock.calls[0] ?? [];
        expect(key).toBe('seo.defaults');
        expect(value).toEqual(seoPersistedRow.value);
        expect(actorId).toBe(SUPER_ADMIN_ACTOR.id);
    });

    it('reaches the model layer with a maintenance.mode value when PATCHing that key', async () => {
        mockUpsertByKey.mockResolvedValue(maintenancePersistedRow);

        const res = await patchPlatformSetting(app, 'maintenance.mode', {
            value: { enabled: true }
        });

        expect(res.status).toBe(200);
        expect(mockUpsertByKey).toHaveBeenCalledTimes(1);

        const [key, value] = mockUpsertByKey.mock.calls[0] ?? [];
        expect(key).toBe('maintenance.mode');
        expect(value).toEqual({ enabled: true });
    });

    it('serializes the row updatedAt Date as an ISO-8601 string at the API boundary', async () => {
        mockUpsertByKey.mockResolvedValue(seoPersistedRow);

        const res = await patchPlatformSetting(app, 'seo.defaults', {
            value: seoPersistedRow.value
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { key: string; updatedAt: string; updatedBy: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.key).toBe('seo.defaults');
        expect(body.data.updatedAt).toBe('2026-05-29T00:00:00.000Z');
        expect(body.data.updatedBy).toBe(SUPER_ADMIN_ACTOR.id);
    });

    it('does NOT reach the model layer when the per-key Zod gate rejects a SEO value with wrong shape', async () => {
        const res = await patchPlatformSetting(app, 'seo.defaults', {
            value: { not: 'a valid seo value' }
        });

        // The per-key value-shape gate lives inside PlatformSettingsService.upsert
        // (T-004). A shape mismatch must reject BEFORE the model is touched.
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpsertByKey).not.toHaveBeenCalled();
    });

    it('rejects unknown keys at the route param level (Zod enum)', async () => {
        const res = await patchPlatformSetting(app, 'unknown.key', { value: {} });
        // Param schema (PlatformSettingsKeySchema) does not include this key.
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpsertByKey).not.toHaveBeenCalled();
    });
});
