/**
 * Route wiring smoke test for the public occupancy calendar read (HOS-43 Phase 1).
 *
 * Route under test: GET /api/v1/public/accommodations/:id/occupancy
 *
 * Scope note (mirrors `featured-toggle.test.ts`): this file covers ONLY route
 * registration, the public-access boundary (no 401/403 for a guest), request
 * validation, and error propagation. The public-safe field-stripping logic
 * itself is asserted deterministically at the service layer in
 * `accommodation.occupancy.reads.test.ts` (`getPublicOccupancyForAccommodation`)
 * — re-asserting it here would only exercise the mocked service function.
 *
 * Mock strategy: minimal Hono app with a guest actor injected directly into
 * context (no Better Auth session needed), `@repo/service-core`'s
 * `getPublicOccupancyForAccommodation` replaced with a controllable mock.
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';

const { mockGetPublicOccupancyForAccommodation } = vi.hoisted(() => ({
    mockGetPublicOccupancyForAccommodation: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getPublicOccupancyForAccommodation: mockGetPublicOccupancyForAccommodation
    };
});

const { publicGetOccupancyRoute } = await import(
    '../../../../src/routes/accommodation/public/getOccupancy.js'
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

function buildApp(
    ...routes: ReturnType<typeof import('../../../../src/utils/create-app.js').createRouter>[]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', { id: GUEST_ID, role: RoleEnum.GUEST, permissions: [] });
        return next();
    });
    for (const route of routes) {
        app.route('/', route);
    }
    return app;
}

beforeEach(() => {
    mockGetPublicOccupancyForAccommodation.mockResolvedValue([
        { date: '2026-07-10', isBlocked: true, source: 'MANUAL' }
    ]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /:id/occupancy (public)', () => {
    it('is registered, reachable, and requires no authentication', async () => {
        const app = buildApp(publicGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toEqual({
            occupancy: [{ date: '2026-07-10', isBlocked: true, source: 'MANUAL' }]
        });
        expect(mockGetPublicOccupancyForAccommodation).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            from: undefined,
            to: undefined
        });
    });

    it('forwards a valid from/to range to the service', async () => {
        const app = buildApp(publicGetOccupancyRoute);
        const res = await app.request(
            `/${ACCOMMODATION_ID}/occupancy?from=2026-07-01&to=2026-08-01`
        );

        expect(res.status).toBe(200);
        expect(mockGetPublicOccupancyForAccommodation).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
    });

    it('returns 400 when only "from" is provided without "to"', async () => {
        const app = buildApp(publicGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy?from=2026-07-01`);

        expect(res.status).toBe(400);
        expect(mockGetPublicOccupancyForAccommodation).not.toHaveBeenCalled();
    });

    it('returns 400 when from >= to', async () => {
        const app = buildApp(publicGetOccupancyRoute);
        const res = await app.request(
            `/${ACCOMMODATION_ID}/occupancy?from=2026-08-01&to=2026-07-01`
        );

        expect(res.status).toBe(400);
    });

    it('propagates a NOT_FOUND from the service as HTTP 404', async () => {
        mockGetPublicOccupancyForAccommodation.mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
        );
        const app = buildApp(publicGetOccupancyRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/occupancy`);

        expect(res.status).toBe(404);
    });
});
