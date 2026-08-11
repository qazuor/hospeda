/**
 * GET /api/v1/admin/revalidation/health — `environmentFlushTarget` (HOS-369)
 *
 * The admin panel's "flush everything" control reads this field to name its own
 * blast radius, so the assertions here run against a REAL 200 body rather than
 * the `if (res.status === 200)` guard used by `revalidation.test.ts`. That file
 * mocks `src/utils/env` with a spread of an `env` binding that is still
 * undefined at import time, which leaves `HOSPEDA_ALLOW_MOCK_ACTOR` unset and
 * makes every request there answer 401 — a guarded body assertion in that file
 * never actually executes. This suite therefore lives on its own, without the
 * env mock, so the mock-actor headers work and the body is really inspected.
 *
 * @module test/routes/revalidation-health-flush-target
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/service-core — only getRevalidationService is overridden; the rest
// of the module is spread through so eager route-registration imports keep
// resolving (same rationale as revalidation.test.ts).
// ---------------------------------------------------------------------------

const mockRevalidationService = {
    getAdapterName: vi.fn().mockReturnValue('CloudflareRevalidationAdapter'),
    getEnvironmentFlushTarget: vi.fn().mockReturnValue('prod:all')
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getRevalidationService: vi.fn(() => mockRevalidationService)
    };
});

import { getRevalidationService } from '@repo/service-core';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const HEALTH_PATH = '/api/v1/admin/revalidation/health';
const ADMIN_ACTOR_ID = '22222222-2222-4222-8222-222222222222';

/** Issues an authenticated admin GET against the health endpoint. */
async function getHealth(app: AppOpenAPI) {
    return app.request(HEALTH_PATH, {
        method: 'GET',
        headers: {
            'user-agent': 'vitest',
            accept: 'application/json',
            'x-mock-actor-id': ADMIN_ACTOR_ID,
            'x-mock-actor-role': RoleEnum.ADMIN,
            'x-mock-actor-permissions': JSON.stringify([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN
            ])
        }
    });
}

describe('GET /api/v1/admin/revalidation/health — environmentFlushTarget', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        (getRevalidationService as ReturnType<typeof vi.fn>).mockReturnValue(
            mockRevalidationService
        );
        mockRevalidationService.getAdapterName.mockReturnValue('CloudflareRevalidationAdapter');
        mockRevalidationService.getEnvironmentFlushTarget.mockReturnValue('prod:all');
    });

    it('reports the namespaced tag an environment flush would purge', async () => {
        // Arrange
        mockRevalidationService.getEnvironmentFlushTarget.mockReturnValue('prod:all');

        // Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.status).toBe('operational');
        expect(body.data.adapter).toBe('active');
        expect(body.data.environmentFlushTarget).toBe('prod:all');
    });

    it('reports whichever environment the service resolves, not a fixed one', async () => {
        // Arrange — a staging deployment names a different namespace, which is
        // the whole point of surfacing it instead of guessing in the browser.
        mockRevalidationService.getEnvironmentFlushTarget.mockReturnValue('preview:all');

        // Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.environmentFlushTarget).toBe('preview:all');
    });

    it("reports 'unresolved' when the service cannot name its environment", async () => {
        // Arrange — the service is up, but its deployment namespace is unset,
        // which is exactly when `purgeEverything` refuses to run at all.
        mockRevalidationService.getEnvironmentFlushTarget.mockReturnValue('unresolved');

        // Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.status).toBe('operational');
        expect(body.data.environmentFlushTarget).toBe('unresolved');
    });

    it("reports 'unresolved' when the revalidation service is not initialized", async () => {
        // Arrange
        (getRevalidationService as ReturnType<typeof vi.fn>).mockReturnValue(null);

        // Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert — the field is always present, so no consumer has to read a
        // missing key as "probably fine".
        expect(res.status).toBe(200);
        expect(body.data.status).toBe('not_initialized');
        expect(body.data.adapter).toBe('none');
        expect(body.data.environmentFlushTarget).toBe('unresolved');
    });

    it("reports 'unresolved' when the service throws while reporting", async () => {
        // Arrange
        mockRevalidationService.getAdapterName.mockImplementation(() => {
            throw new Error('adapter exploded');
        });

        // Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert — a degraded service must not be quoted on which environment
        // it would flush.
        expect(res.status).toBe(200);
        expect(body.data.status).toBe('degraded');
        expect(body.data.environmentFlushTarget).toBe('unresolved');
    });

    it('never reports the whole-zone target, which this surface cannot reach', async () => {
        // Arrange / Act
        const res = await getHealth(app);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.environmentFlushTarget).not.toBe('*');
    });
});
