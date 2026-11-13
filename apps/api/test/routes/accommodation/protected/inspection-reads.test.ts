import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findById, findMedia, findOccupancy, findCalendar } = vi.hoisted(() => ({
    findById: vi.fn(),
    findMedia: vi.fn(),
    findOccupancy: vi.fn(),
    findCalendar: vi.fn()
}));

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById };
        }),
        AccommodationMediaModel: vi.fn().mockImplementation(function () {
            return { findByAccommodation: findMedia };
        }),
        accommodationOccupancyModel: {
            findByAccommodation: findOccupancy,
            findByAccommodationAndRange: findOccupancy
        },
        accommodationCalendarSyncModel: { findByAccommodationAndProvider: findCalendar }
    };
});

import { protectedCalendarSyncStatusRoute } from '../../../../src/routes/accommodation/protected/calendarSyncStatus.js';
import { protectedGetMediaRoute } from '../../../../src/routes/accommodation/protected/getMedia.js';
import { protectedGetOccupancyRoute } from '../../../../src/routes/accommodation/protected/getOccupancy.js';
import type { AppBindings } from '../../../../src/types.js';

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const URLS = [
    `/api/v1/protected/accommodations/${ID}/media`,
    `/api/v1/protected/accommodations/${ID}/occupancy`,
    `/api/v1/protected/accommodations/${ID}/calendar-sync/status`
] as const;
const ROUTES = [
    protectedGetMediaRoute,
    protectedGetOccupancyRoute,
    protectedCalendarSyncStatusRoute
] as const;

function buildApp(
    actor: { id: string; roles: RoleEnum[]; permissions: PermissionEnum[] },
    route: (typeof ROUTES)[number]
) {
    const app = new Hono<AppBindings>();
    app.use((context, next) => {
        context.set('actor', actor);
        return next();
    });
    app.route('/', route);
    app.onError((error, context) => {
        if (error instanceof ServiceError) {
            const status = error.code === ServiceErrorCode.NOT_FOUND ? 404 : 403;
            return context.json(
                { success: false, error: { code: error.code, message: error.message } },
                status
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return context.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            500
        );
    });
    return app;
}

async function answer(
    actor: { id: string; roles: RoleEnum[]; permissions: PermissionEnum[] },
    route: (typeof ROUTES)[number],
    url: string
) {
    const app = buildApp(actor, route);
    const path = url.replace('/api/v1/protected/accommodations', '');
    const response = await app.request(path);
    const body = (await response.json()) as Record<string, unknown>;
    delete body.metadata;
    return { status: response.status, body };
}

beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue({ id: ID, ownerId: OWNER_ID, deletedAt: null });
    findMedia.mockResolvedValue({ items: [] });
    findOccupancy.mockResolvedValue([]);
    findCalendar.mockResolvedValue(null);
});

describe('TEST:1703:2 and TEST:1703:3 protected inspection reads', () => {
    it.each(
        URLS
    )('answers identically for UPDATE_ANY-only foreign, unpermitted foreign, and missing rows: %s', async (url) => {
        const route = ROUTES[URLS.indexOf(url as (typeof URLS)[number])];
        if (!route) throw new Error(`No route configured for ${url}`);
        const foreign = await answer(
            {
                id: 'staff',
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
            },
            route,
            url
        );
        const stranger = await answer(
            { id: 'stranger', roles: [RoleEnum.USER], permissions: [] },
            route,
            url
        );
        findById.mockResolvedValue(null);
        const missing = await answer(
            { id: 'stranger', roles: [RoleEnum.USER], permissions: [] },
            route,
            url
        );
        expect(foreign).toEqual(stranger);
        expect(foreign).toEqual(missing);
        expect(foreign.status).toBe(404);
    });

    it.each(URLS)('allows VIEW_ALL staff and the owner: %s', async (url) => {
        const route = ROUTES[URLS.indexOf(url as (typeof URLS)[number])];
        if (!route) throw new Error(`No route configured for ${url}`);
        expect(
            (
                await answer(
                    {
                        id: 'staff',
                        roles: [RoleEnum.ADMIN],
                        permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
                    },
                    route,
                    url
                )
            ).status
        ).toBe(200);
        expect(
            (
                await answer(
                    {
                        id: OWNER_ID,
                        roles: [RoleEnum.HOST],
                        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
                    },
                    route,
                    url
                )
            ).status
        ).toBe(200);
    });
});
