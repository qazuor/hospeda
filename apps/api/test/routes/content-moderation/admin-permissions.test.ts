/**
 * Permission-enforcement tests for content-moderation admin routes.
 *
 * Follows the same pattern as admin-health.test.ts:
 * - Mock createAdminRoute / createAdminListRoute to capture the config object.
 * - Assert that `requiredPermissions` is declared on each route with the
 *   correct PermissionEnum value.
 */

const { createAdminRouteMock, createAdminListRouteMock } = vi.hoisted(() => ({
    createAdminRouteMock: vi.fn((config) => config),
    createAdminListRouteMock: vi.fn((config) => config)
}));

vi.mock('../../../src/utils/route-factory.js', () => ({
    createAdminRoute: createAdminRouteMock,
    createAdminListRoute: createAdminListRouteMock
}));

// Stub heavy dependencies so module imports don't fail in unit context.
vi.mock('@repo/service-core', () => ({
    ContentModerationTermService: vi.fn(),
    ContentModerationThresholdService: vi.fn(),
    ServiceError: class ServiceError extends Error {},
    getThresholdForContext: vi.fn()
}));

vi.mock('@repo/db', () => ({}));

import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-import a module so vi.hoisted mocks are always fresh per test. */
async function freshImport<T>(path: string): Promise<T> {
    vi.resetModules();
    return import(path) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Threshold: get-resolved — AUTHZ BLOCKER fix
// ---------------------------------------------------------------------------

describe('adminGetResolvedThresholdRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('declares MODERATION_THRESHOLD_VIEW permission', async () => {
        await freshImport(
            '../../../src/routes/content-moderation/admin/thresholds/get-resolved.js'
        );

        expect(createAdminRouteMock).toHaveBeenCalledTimes(1);
        const config = createAdminRouteMock.mock.calls[0]?.[0];
        expect(config.requiredPermissions).toContain(PermissionEnum.MODERATION_THRESHOLD_VIEW);
    });

    it('is registered on path /resolved', async () => {
        await freshImport(
            '../../../src/routes/content-moderation/admin/thresholds/get-resolved.js'
        );
        const config = createAdminRouteMock.mock.calls[0]?.[0];
        expect(config.path).toBe('/resolved');
    });
});

// ---------------------------------------------------------------------------
// Terms: hard-delete
// ---------------------------------------------------------------------------

describe('adminHardDeleteTermRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('declares MODERATION_TERM_HARD_DELETE permission', async () => {
        await freshImport('../../../src/routes/content-moderation/admin/terms/hard-delete.js');

        expect(createAdminRouteMock).toHaveBeenCalledTimes(1);
        const config = createAdminRouteMock.mock.calls[0]?.[0];
        expect(config.requiredPermissions).toContain(PermissionEnum.MODERATION_TERM_HARD_DELETE);
    });
});

// ---------------------------------------------------------------------------
// Terms: restore
// ---------------------------------------------------------------------------

describe('adminRestoreTermRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('declares MODERATION_TERM_RESTORE permission', async () => {
        await freshImport('../../../src/routes/content-moderation/admin/terms/restore.js');

        expect(createAdminRouteMock).toHaveBeenCalledTimes(1);
        const config = createAdminRouteMock.mock.calls[0]?.[0];
        expect(config.requiredPermissions).toContain(PermissionEnum.MODERATION_TERM_RESTORE);
    });
});
