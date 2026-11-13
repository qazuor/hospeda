import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const NON_OWNER_ID = '22222222-2222-4222-8222-222222222222';
const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '44444444-4444-4444-8444-444444444444';

const FOREIGN_ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    ownerId: OWNER_ID,
    deletedAt: null,
    showExternalReputation: false
};

const LISTING = {
    id: LISTING_ID,
    accommodationId: ACCOMMODATION_ID,
    platform: 'GOOGLE',
    url: 'https://maps.google.com/?q=test',
    showLink: true,
    showReviews: false,
    verified: false,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: OWNER_ID,
    updatedById: OWNER_ID,
    lifecycleState: 'ACTIVE'
};

const { mockFindById, mockFindByAccommodation, mockReputationFindAll } = vi.hoisted(() => ({
    mockFindById: vi.fn(),
    mockFindByAccommodation: vi.fn(),
    mockReputationFindAll: vi.fn()
}));

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockFindById };
        }),
        AccommodationExternalListingModel: vi.fn().mockImplementation(function () {
            return { findByAccommodation: mockFindByAccommodation };
        }),
        AccommodationExternalReputationModel: vi.fn().mockImplementation(function () {
            return { findAll: mockReputationFindAll };
        })
    };
});

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../src/utils/env.js', async (importActual) => {
    const actual = await importActual<typeof import('../../../src/utils/env.js')>();
    return {
        ...actual,
        env: { ...actual.env, HOSPEDA_GOOGLE_PLACES_API_KEY: undefined, NODE_ENV: 'test' }
    };
});

const { protectedListExternalListingsRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/listListings.js'
);

type ActorOptions = {
    id: string;
    roles: readonly RoleEnum[];
    permissions: PermissionEnum[];
};

const serviceErrorStatuses: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function buildApp(actor: ActorOptions): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, context) => {
        if (error instanceof ServiceError) {
            return context.json(
                { success: false, error: { code: error.code, message: error.message } },
                (serviceErrorStatuses[error.code] ?? 500) as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return context.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
    app.use((context, next) => {
        context.set('actor', actor);
        return next();
    });
    app.route('/', protectedListExternalListingsRoute);
    return app;
}

async function readListings(actor: ActorOptions) {
    const response = await buildApp(actor).request(`/${ACCOMMODATION_ID}/external-listings`);
    const body = await response.json();
    delete body.metadata;
    return { status: response.status, body };
}

describe('TEST:1703:1 the external listings read admits a foreign listing only with the inspection permission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindById.mockResolvedValue(FOREIGN_ACCOMMODATION);
        mockFindByAccommodation.mockResolvedValue([LISTING]);
        mockReputationFindAll.mockResolvedValue({ items: [], total: 0 });
    });

    it('returns the same 404 for UPDATE_ANY-only staff, a stranger, and a missing accommodation', async () => {
        const updateAnyStaff = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const stranger = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        });
        mockFindById.mockResolvedValueOnce(null);
        const missing = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        });

        expect(updateAnyStaff.status).toBe(404);
        expect(updateAnyStaff).toEqual(stranger);
        expect(updateAnyStaff).toEqual(missing);
        expect(mockFindByAccommodation).not.toHaveBeenCalled();
    });

    it('allows a foreign accommodation with ACCOMMODATION_VIEW_ALL', async () => {
        const result = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
        });

        expect(result.status).toBe(200);
        expect(result.body.data.listings).toEqual([LISTING]);
        expect(mockFindByAccommodation).toHaveBeenCalledTimes(1);
        expect(mockFindByAccommodation).toHaveBeenCalledWith(ACCOMMODATION_ID);
    });

    it('allows a foreign accommodation with UPDATE_ANY and VIEW_ALL together', async () => {
        const result = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ]
        });

        expect(result.status).toBe(200);
    });

    it('allows the owner with ACCOMMODATION_UPDATE_OWN', async () => {
        mockFindById.mockResolvedValueOnce({ ...FOREIGN_ACCOMMODATION, ownerId: NON_OWNER_ID });
        const result = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        expect(result.status).toBe(200);
    });

    it('returns the same 404 for a foreign UPDATE_OWN actor as for UPDATE_ANY-only staff', async () => {
        const updateAnyStaff = await readListings({
            id: NON_OWNER_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const foreignUpdateOwn = await readListings({
            id: '55555555-5555-4555-8555-555555555555',
            roles: [RoleEnum.HOST],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        expect(foreignUpdateOwn.status).toBe(404);
        expect(foreignUpdateOwn).toEqual(updateAnyStaff);
    });

    it('returns 404 when the owner lacks ACCOMMODATION_UPDATE_OWN', async () => {
        const result = await readListings({
            id: OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        });

        expect(result.status).toBe(404);
    });
});
