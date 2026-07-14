/**
 * Route wiring smoke test for the admin occupancy calendar read (HOS-43 Phase 1).
 *
 * Route under test: GET /api/v1/admin/accommodations/:id/occupancy
 *
 * Unlike the protected/public occupancy routes, the `ACCOMMODATION_OCCUPANCY_VIEW`
 * gate here is enforced by REAL middleware (`adminAuthMiddleware`'s
 * `requiredPermissions`), not mocked service logic — so this file exercises
 * the actual gate, not just wiring. The service function itself
 * (`getAdminOccupancyForAccommodation`) is still mocked to avoid a live DB.
 *
 * Mock strategy mirrors `featured-toggle.test.ts` / `occupancy.test.ts`.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';
const OCCUPANCY_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const { mockGetAdminOccupancyForAccommodation } = vi.hoisted(() => ({
    mockGetAdminOccupancyForAccommodation: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getAdminOccupancyForAccommodation: mockGetAdminOccupancyForAccommodation
    };
});

const { adminGetOccupancyRoute } = await import(
    '../../../../src/routes/accommodation/admin/getOccupancy.js'
);

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
}

type ActorOptions = { id: string; role: RoleEnum; permissions: PermissionEnum[] };

function buildApp(
    actor: ActorOptions,
    ...routes: ReturnType<typeof import('../../../../src/utils/create-app.js').createRouter>[]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
    for (const route of routes) {
        app.route('/', route);
    }
    return app;
}

const viewerActor: ActorOptions = {
    id: 'admin-001',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW]
};
const noViewPermissionAdminActor: ActorOptions = {
    id: 'admin-002',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
};
const guestActor: ActorOptions = { id: GUEST_ID, role: RoleEnum.GUEST, permissions: [] };

beforeEach(() => {
    mockGetAdminOccupancyForAccommodation.mockResolvedValue([
        {
            id: OCCUPANCY_ID,
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10',
            isBlocked: true,
            source: 'MANUAL',
            externalEventId: null,
            note: 'internal note',
            createdById: OWNER_ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /:id/occupancy (admin)', () => {
    it('is registered and reachable — returns 200 with ACCOMMODATION_OCCUPANCY_VIEW', async () => {
        const app = buildApp(viewerActor, adminGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.occupancy).toHaveLength(1);
        expect(mockGetAdminOccupancyForAccommodation).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: 'admin-001' }),
            accommodationId: ACCOMMODATION_ID,
            from: undefined,
            to: undefined
        });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, adminGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);
        expect([401, 403]).toContain(res.status);
        expect(mockGetAdminOccupancyForAccommodation).not.toHaveBeenCalled();
    });

    it('returns 403 for an admin actor lacking ACCOMMODATION_OCCUPANCY_VIEW (real middleware gate)', async () => {
        const app = buildApp(noViewPermissionAdminActor, adminGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);
        expect(res.status).toBe(403);
        expect(mockGetAdminOccupancyForAccommodation).not.toHaveBeenCalled();
    });

    it('propagates a NOT_FOUND from the service as HTTP 404', async () => {
        mockGetAdminOccupancyForAccommodation.mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
        );
        const app = buildApp(viewerActor, adminGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);
        expect(res.status).toBe(404);
    });
});
