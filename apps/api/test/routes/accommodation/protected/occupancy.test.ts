/**
 * Route wiring smoke test for the protected occupancy calendar endpoints
 * (HOS-43 Phase 1).
 *
 * Routes under test:
 *   GET    /api/v1/protected/accommodations/:id/occupancy
 *   POST   /api/v1/protected/accommodations/:id/occupancy
 *   PATCH  /api/v1/protected/accommodations/:id/occupancy/batch
 *   DELETE /api/v1/protected/accommodations/:id/occupancy/:date
 *
 * Scope note (mirrors `featured-toggle.test.ts`): these routes have NO
 * declarative `ownership:` config — ownership + `ACCOMMODATION_OCCUPANCY_MANAGE`
 * gating happens inside the service functions (`accommodation.occupancy.ts`).
 * This file covers route registration, the guest/401 boundary, request
 * validation, the path-derives-accommodationId contract (POST body's
 * `accommodationId` is never trusted), error propagation, AND the
 * `CAN_USE_CALENDAR` `requireEntitlement` gate wired at the ROUTE layer on
 * the three write endpoints (POST/PATCH/DELETE — never GET, reads are
 * ungated). The non-entitlement 403 gating scenarios (non-owner) are still
 * asserted deterministically at the service layer in
 * `accommodation.occupancy.writes.test.ts` — re-asserted HERE only as "does a
 * FORBIDDEN from the mocked service surface as HTTP 403", which is a
 * route-wiring concern, not a re-test of the gate logic.
 *
 * Mock strategy: minimal Hono app with the actor AND `userEntitlements` /
 * `userLimits` / `billingLoadFailed` injected directly into context (mirrors
 * `accommodation-entitlement-gates.test.ts`), `@repo/service-core`'s
 * occupancy functions replaced with controllable mocks (mirrors
 * `featured-toggle.test.ts` / other protected route tests in this
 * directory). By default `buildApp` grants `CAN_USE_CALENDAR` so the
 * pre-existing happy-path/validation/non-owner tests are unaffected by the
 * new route-level gate; the dedicated entitlement-gate `describe` blocks
 * override this explicitly.
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';
const OCCUPANCY_ID = '22222222-2222-4222-8222-222222222222';

const {
    mockGetOwnerOccupancyForAccommodation,
    mockAddOccupancy,
    mockBatchToggleOccupancy,
    mockRemoveOccupancy
} = vi.hoisted(() => ({
    mockGetOwnerOccupancyForAccommodation: vi.fn(),
    mockAddOccupancy: vi.fn(),
    mockBatchToggleOccupancy: vi.fn(),
    mockRemoveOccupancy: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getOwnerOccupancyForAccommodation: mockGetOwnerOccupancyForAccommodation,
        addOccupancy: mockAddOccupancy,
        batchToggleOccupancy: mockBatchToggleOccupancy,
        removeOccupancy: mockRemoveOccupancy
    };
});

const {
    protectedGetOccupancyRoute,
    protectedAddOccupancyRoute,
    protectedBatchOccupancyRoute,
    protectedRemoveOccupancyRoute
} = await (async () => {
    const [getMod, addMod, batchMod, removeMod] = await Promise.all([
        import('../../../../src/routes/accommodation/protected/getOccupancy.js'),
        import('../../../../src/routes/accommodation/protected/addOccupancy.js'),
        import('../../../../src/routes/accommodation/protected/batchOccupancy.js'),
        import('../../../../src/routes/accommodation/protected/removeOccupancy.js')
    ]);
    return {
        protectedGetOccupancyRoute: getMod.protectedGetOccupancyRoute,
        protectedAddOccupancyRoute: addMod.protectedAddOccupancyRoute,
        protectedBatchOccupancyRoute: batchMod.protectedBatchOccupancyRoute,
        protectedRemoveOccupancyRoute: removeMod.protectedRemoveOccupancyRoute
    };
})();

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
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

/**
 * Builds a minimal Hono app with `actor` and `userEntitlements` injected
 * directly into context (bypassing the real `entitlementMiddleware` — same
 * approach as `accommodation-entitlement-gates.test.ts`). Defaults to
 * granting `CAN_USE_CALENDAR` so pre-existing tests unrelated to the
 * entitlement gate keep passing; pass `entitlements: []` (or any array
 * omitting the key) to exercise the 403 path.
 */
function buildApp(
    actor: ActorOptions,
    routes: ReturnType<typeof import('../../../../src/utils/create-app.js').createRouter>[],
    options?: { entitlements?: EntitlementKey[] }
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', actor);
        c.set(
            'userEntitlements',
            new Set(options?.entitlements ?? [EntitlementKey.CAN_USE_CALENDAR])
        );
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
    for (const route of routes) {
        app.route('/', route);
    }
    return app;
}

const ownerActor: ActorOptions = {
    id: OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE]
};
const guestActor: ActorOptions = { id: GUEST_ID, role: RoleEnum.GUEST, permissions: [] };

function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: OCCUPANCY_ID,
        accommodationId: ACCOMMODATION_ID,
        date: '2026-07-10',
        isBlocked: true,
        source: 'MANUAL',
        externalEventId: null,
        note: null,
        createdById: OWNER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

beforeEach(() => {
    mockGetOwnerOccupancyForAccommodation.mockResolvedValue([makeRow()]);
    mockAddOccupancy.mockResolvedValue(makeRow());
    mockBatchToggleOccupancy.mockResolvedValue([makeRow()]);
    mockRemoveOccupancy.mockResolvedValue({ deleted: true });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /:id/occupancy
// ---------------------------------------------------------------------------

describe('GET /:id/occupancy (protected)', () => {
    it('is registered and reachable — returns 200 on happy path (owner reads)', async () => {
        const app = buildApp(ownerActor, [protectedGetOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.occupancy).toHaveLength(1);
        expect(mockGetOwnerOccupancyForAccommodation).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            accommodationId: ACCOMMODATION_ID,
            from: undefined,
            to: undefined
        });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedGetOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);
        expect([401, 403]).toContain(res.status);
        expect(mockGetOwnerOccupancyForAccommodation).not.toHaveBeenCalled();
    });

    it('propagates a FORBIDDEN from the service as HTTP 403 (non-owner)', async () => {
        mockGetOwnerOccupancyForAccommodation.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not the owner')
        );
        const app = buildApp(ownerActor, [protectedGetOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/occupancy
// ---------------------------------------------------------------------------

describe('POST /:id/occupancy (protected)', () => {
    it('is registered and reachable — returns 201 on happy path', async () => {
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: '2026-07-10' })
        });

        expect(res.status).toBe(201);
        expect(mockAddOccupancy).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10', note: undefined }
        });
    });

    it('derives accommodationId from the URL path, never trusting the body value', async () => {
        const otherAccommodationId = '44444444-4444-4444-8444-444444444444';
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // Body claims a DIFFERENT accommodationId than the URL path.
            body: JSON.stringify({ accommodationId: otherAccommodationId, date: '2026-07-10' })
        });

        expect(res.status).toBe(201);
        expect(mockAddOccupancy).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10', note: undefined }
        });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedAddOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: '2026-07-10' })
        });
        expect([401, 403]).toContain(res.status);
        expect(mockAddOccupancy).not.toHaveBeenCalled();
    });

    it('returns 400 on an invalid date format', async () => {
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: 'not-a-date' })
        });
        expect(res.status).toBe(400);
    });

    it('propagates a FORBIDDEN from the service as HTTP 403 (non-owner)', async () => {
        mockAddOccupancy.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not the owner')
        );
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: '2026-07-10' })
        });
        expect(res.status).toBe(403);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: '2026-07-10' })
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mockAddOccupancy).not.toHaveBeenCalled();
    });

    it('succeeds when the owner holds CAN_USE_CALENDAR via HOST draft defaults (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedAddOccupancyRoute], {
            entitlements: [EntitlementKey.CAN_USE_CALENDAR]
        });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, date: '2026-07-10' })
        });
        expect(res.status).toBe(201);
        expect(mockAddOccupancy).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// PATCH /:id/occupancy/batch
// ---------------------------------------------------------------------------

describe('PATCH /:id/occupancy/batch (protected)', () => {
    it('is registered and reachable — returns 200 on happy path block', async () => {
        const app = buildApp(ownerActor, [protectedBatchOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10', '2026-07-11'],
                isBlocked: true
            })
        });

        expect(res.status).toBe(200);
        expect(mockBatchToggleOccupancy).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            input: {
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10', '2026-07-11'],
                isBlocked: true,
                note: undefined
            }
        });
    });

    it('returns 200 on happy path unblock', async () => {
        mockBatchToggleOccupancy.mockResolvedValue([]);
        const app = buildApp(ownerActor, [protectedBatchOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10'],
                isBlocked: false
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.occupancy).toEqual([]);
    });

    it('returns 400 for an empty dates array', async () => {
        const app = buildApp(ownerActor, [protectedBatchOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, dates: [], isBlocked: true })
        });
        expect(res.status).toBe(400);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedBatchOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10'],
                isBlocked: true
            })
        });
        expect([401, 403]).toContain(res.status);
        expect(mockBatchToggleOccupancy).not.toHaveBeenCalled();
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedBatchOccupancyRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10'],
                isBlocked: true
            })
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mockBatchToggleOccupancy).not.toHaveBeenCalled();
    });

    it('succeeds when the owner holds CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedBatchOccupancyRoute], {
            entitlements: [EntitlementKey.CAN_USE_CALENDAR]
        });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/batch`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10'],
                isBlocked: true
            })
        });
        expect(res.status).toBe(200);
        expect(mockBatchToggleOccupancy).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// DELETE /:id/occupancy/:date
// ---------------------------------------------------------------------------

describe('DELETE /:id/occupancy/:date (protected)', () => {
    it('is registered and reachable — returns 200 with deleted:true on happy path', async () => {
        const app = buildApp(ownerActor, [protectedRemoveOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ deleted: true });
        expect(mockRemoveOccupancy).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10'
        });
    });

    it('returns 200 with deleted:false when no MANUAL row existed', async () => {
        mockRemoveOccupancy.mockResolvedValue({ deleted: false });
        const app = buildApp(ownerActor, [protectedRemoveOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ deleted: false });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedRemoveOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });
        expect([401, 403]).toContain(res.status);
        expect(mockRemoveOccupancy).not.toHaveBeenCalled();
    });

    it('propagates a FORBIDDEN from the service as HTTP 403 (non-owner)', async () => {
        mockRemoveOccupancy.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not the owner')
        );
        const app = buildApp(ownerActor, [protectedRemoveOccupancyRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(403);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedRemoveOccupancyRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mockRemoveOccupancy).not.toHaveBeenCalled();
    });

    it('succeeds when the owner holds CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, [protectedRemoveOccupancyRoute], {
            entitlements: [EntitlementKey.CAN_USE_CALENDAR]
        });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/2026-07-10`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(200);
        expect(mockRemoveOccupancy).toHaveBeenCalled();
    });
});
