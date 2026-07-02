/**
 * Route wiring smoke test for the owner self-service featured toggle
 * (SPEC-309 T-019/T-020, task T-028).
 *
 * Routes under test:
 *   PATCH /api/v1/protected/accommodations/:id/featured-toggle
 *   GET   /api/v1/protected/accommodations/:id/featured-toggle
 *
 * Scope note: this file intentionally covers ONLY route registration and the
 * guest/401 boundary. `protectedFeaturedToggleRoute` and
 * `protectedGetFeaturedEntitlementRoute` have NO declarative `ownership:`
 * config — ALL ownership + FEATURED_LISTING entitlement gating happens inside
 * `setAccommodationFeaturedToggle` / `getAccommodationFeaturedEntitlement`
 * (`packages/service-core/src/services/accommodation/accommodation.featured-toggle.ts`).
 * The 4 required gating scenarios (owner without entitlement, owner with
 * plan-derived entitlement, owner with addon-derived entitlement, foreign
 * owner denied regardless of entitlement) are asserted deterministically at
 * the service layer in
 * `packages/service-core/test/services/accommodation/accommodation.featured-toggle.test.ts`
 * — re-asserting them here would only exercise the mocked service functions,
 * not the real gating logic.
 *
 * Mock strategy: mirrors
 * `apps/api/test/routes/accommodation-external-reputation/protected.test.ts`
 * (masterToggle's own route test) — a minimal Hono app with the actor
 * injected directly into context, `@repo/service-core`'s two service
 * functions replaced with controllable mocks (importActual for everything
 * else, so `ServiceError`/`ServiceErrorCode` stay real).
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSetAccommodationFeaturedToggle, mockGetAccommodationFeaturedEntitlement } = vi.hoisted(
    () => ({
        mockSetAccommodationFeaturedToggle: vi.fn(),
        mockGetAccommodationFeaturedEntitlement: vi.fn()
    })
);

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        setAccommodationFeaturedToggle: mockSetAccommodationFeaturedToggle,
        getAccommodationFeaturedEntitlement: mockGetAccommodationFeaturedEntitlement
    };
});

// Dynamic import AFTER vi.mock calls.
const { protectedFeaturedToggleRoute, protectedGetFeaturedEntitlementRoute } = await import(
    '../../../../src/routes/accommodation/protected/featured-toggle.js'
);

// ---------------------------------------------------------------------------
// Error handler + app builder (mirrors protected.test.ts)
// ---------------------------------------------------------------------------

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

type ActorOptions = {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
};

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

const ownerActor: ActorOptions = {
    id: OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

const guestActor: ActorOptions = {
    id: GUEST_ID,
    role: RoleEnum.GUEST,
    permissions: []
};

beforeEach(() => {
    mockSetAccommodationFeaturedToggle.mockResolvedValue({ isFeatured: true });
    mockGetAccommodationFeaturedEntitlement.mockResolvedValue({
        isFeatured: false,
        hasEntitlement: true
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// PATCH /:id/featured-toggle
// ---------------------------------------------------------------------------

describe('PATCH /:id/featured-toggle', () => {
    it('is registered and reachable — returns 200 on happy path (owner toggles)', async () => {
        const app = buildApp(ownerActor, protectedFeaturedToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isFeatured: true })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.isFeatured).toBe(true);
        expect(mockSetAccommodationFeaturedToggle).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            accommodationId: ACCOMMODATION_ID,
            isFeatured: true
        });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, protectedFeaturedToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isFeatured: true })
        });
        expect([401, 403]).toContain(res.status);
        expect(mockSetAccommodationFeaturedToggle).not.toHaveBeenCalled();
    });

    it('returns 400 on missing body isFeatured field', async () => {
        const app = buildApp(ownerActor, protectedFeaturedToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(400);
    });

    it('propagates a FORBIDDEN from the service as HTTP 403 (route wiring only, gate itself tested at service layer)', async () => {
        mockSetAccommodationFeaturedToggle.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'No active FEATURED_LISTING entitlement')
        );
        const app = buildApp(ownerActor, protectedFeaturedToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isFeatured: true })
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// GET /:id/featured-toggle
// ---------------------------------------------------------------------------

describe('GET /:id/featured-toggle', () => {
    it('is registered and reachable — returns 200 with isFeatured/hasEntitlement on happy path', async () => {
        const app = buildApp(ownerActor, protectedGetFeaturedEntitlementRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toEqual({ isFeatured: false, hasEntitlement: true });
        expect(mockGetAccommodationFeaturedEntitlement).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            accommodationId: ACCOMMODATION_ID
        });
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, protectedGetFeaturedEntitlementRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`);
        expect([401, 403]).toContain(res.status);
        expect(mockGetAccommodationFeaturedEntitlement).not.toHaveBeenCalled();
    });

    it('returns 404 when the service reports the accommodation missing', async () => {
        mockGetAccommodationFeaturedEntitlement.mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
        );
        const app = buildApp(ownerActor, protectedGetFeaturedEntitlementRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/featured-toggle`);
        expect(res.status).toBe(404);
    });
});
