/**
 * Route wiring smoke test for the protected occupancy event-edit endpoint
 * (HOS-175 Phase 3).
 *
 * Route under test:
 *   PATCH /api/v1/protected/accommodations/:id/occupancy/event
 *
 * Mirrors the structure/mock strategy of `occupancy.test.ts` (the sibling
 * add/batch/remove occupancy route test): no declarative `ownership:` config
 * — ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` gating happens inside the
 * service function (`accommodation.occupancy.ts::updateOccupancyEvent`).
 * This file covers route registration, the guest/401 boundary, request
 * validation, error propagation, and the `CAN_USE_CALENDAR` `requireEntitlement`
 * gate wired at the ROUTE layer. Non-entitlement 403 gating scenarios
 * (non-owner) are asserted deterministically at the service layer in
 * `accommodation.occupancy.writes.test.ts` — re-asserted HERE only as "does a
 * FORBIDDEN from the mocked service surface as HTTP 403", a route-wiring
 * concern, not a re-test of the gate logic.
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

const { mockUpdateOccupancyEvent } = vi.hoisted(() => ({
    mockUpdateOccupancyEvent: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        updateOccupancyEvent: mockUpdateOccupancyEvent
    };
});

const { protectedUpdateOccupancyEventRoute } = await import(
    '../../../../src/routes/accommodation/protected/updateOccupancyEvent.js'
);

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
 * approach as `occupancy.test.ts`). Defaults to granting `CAN_USE_CALENDAR`
 * so pre-existing tests unrelated to the entitlement gate keep passing; pass
 * `entitlements: []` to exercise the 403 path.
 */
function buildApp(
    actor: ActorOptions,
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
    app.route('/', protectedUpdateOccupancyEventRoute);
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
        date: '2026-07-11',
        isBlocked: true,
        source: 'MANUAL',
        externalEventId: null,
        note: 'moved event',
        createdById: OWNER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

const validBody = {
    oldStartDate: '2026-07-10',
    oldEndDate: '2026-07-12',
    newStartDate: '2026-07-11',
    newEndDate: '2026-07-13',
    note: 'moved event'
};

beforeEach(() => {
    mockUpdateOccupancyEvent.mockResolvedValue([makeRow()]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('PATCH /:id/occupancy/event (protected)', () => {
    it('is registered and reachable — returns 200 on happy path', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.occupancy).toHaveLength(1);
        expect(mockUpdateOccupancyEvent).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-12',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-13',
            note: 'moved event'
        });
    });

    it('derives accommodationId from the URL path (not from the body — the body has no such field)', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });

        expect(res.status).toBe(200);
        expect(mockUpdateOccupancyEvent).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationId: ACCOMMODATION_ID })
        );
    });

    it('omitting note is accepted and forwarded as undefined', async () => {
        const app = buildApp(ownerActor);
        const { note: _note, ...bodyWithoutNote } = validBody;
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(bodyWithoutNote)
        });

        expect(res.status).toBe(200);
        expect(mockUpdateOccupancyEvent).toHaveBeenCalledWith(
            expect.objectContaining({ note: undefined })
        );
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect([401, 403]).toContain(res.status);
        expect(mockUpdateOccupancyEvent).not.toHaveBeenCalled();
    });

    it('returns 400 on an invalid date format', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...validBody, oldStartDate: 'not-a-date' })
        });
        expect(res.status).toBe(400);
        expect(mockUpdateOccupancyEvent).not.toHaveBeenCalled();
    });

    // NOTE: `oldStartDate <= oldEndDate` / `newStartDate <= newEndDate` are
    // declared on `AccommodationOccupancyEventUpdateSchema` via `.refine()`,
    // but a Zod v4 + route-factory compatibility gap means a top-level
    // object `.refine()` is NOT actually enforced by the HTTP body validator
    // (see the long comment on `updateOccupancyEvent` in
    // `accommodation.occupancy.ts` for the full root cause). The invariant is
    // therefore guarded directly in the SERVICE (real-function coverage in
    // `accommodation.occupancy.writes.test.ts`) — here we only assert that a
    // VALIDATION_ERROR the service throws is correctly mapped to HTTP 400,
    // same "wiring, not logic" scope as the FORBIDDEN/NOT_FOUND propagation
    // tests below.
    it('propagates a VALIDATION_ERROR from the service as HTTP 400 (invalid date range)', async () => {
        mockUpdateOccupancyEvent.mockRejectedValue(
            new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'oldStartDate must be on or before oldEndDate'
            )
        );
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...validBody,
                oldStartDate: '2026-07-15',
                oldEndDate: '2026-07-10'
            })
        });
        expect(res.status).toBe(400);
    });

    it('accepts a single-day event where start === end for either range', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                oldStartDate: '2026-07-10',
                oldEndDate: '2026-07-10',
                newStartDate: '2026-07-11',
                newEndDate: '2026-07-11'
            })
        });
        expect(res.status).toBe(200);
        expect(mockUpdateOccupancyEvent).toHaveBeenCalled();
    });

    it('propagates a FORBIDDEN from the service as HTTP 403 (non-owner)', async () => {
        mockUpdateOccupancyEvent.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not the owner')
        );
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(403);
    });

    it('propagates a NOT_FOUND from the service as HTTP 404', async () => {
        mockUpdateOccupancyEvent.mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
        );
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(404);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mockUpdateOccupancyEvent).not.toHaveBeenCalled();
    });

    it('succeeds when the owner holds CAN_USE_CALENDAR (real route-level gate)', async () => {
        const app = buildApp(ownerActor, { entitlements: [EntitlementKey.CAN_USE_CALENDAR] });
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy/event`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(200);
        expect(mockUpdateOccupancyEvent).toHaveBeenCalled();
    });
});
