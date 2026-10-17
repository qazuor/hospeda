/** Protected accommodation inspection permission regression (HOS-1693). */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

const { mockGetById, mockSelect, mockEffectiveSet } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockSelect: vi.fn(),
    mockEffectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById };
        })
    };
});

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
        amenities: { __table: 'amenities', id: 'amenities.id' },
        features: { __table: 'features', id: 'features.id' },
        rAccommodationAmenity: {
            __table: 'raa',
            amenityId: 'raa.amenityId',
            accommodationId: 'raa.accommodationId'
        },
        rAccommodationFeature: {
            __table: 'raf',
            featureId: 'raf.featureId',
            accommodationId: 'raf.accommodationId'
        },
        getDb: vi.fn(() => ({ select: mockSelect }))
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mockEffectiveSet })
}));
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetOwnAccommodationByIdRoute } = await import(
    '../../../../src/routes/accommodation/protected/getById.js'
);

const ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    slug: 'casa-beta-199',
    name: 'Casa BETA-199',
    type: 'HOUSE',
    summary: 'A test accommodation for the inspection permission regression.',
    description:
        'A description long enough to satisfy the accommodation read schema without tripping any minimum-length bound.',
    nameI18n: { es: 'Casa BETA-199', en: 'BETA-199 House', pt: 'Casa BETA-199' },
    summaryI18n: null,
    descriptionI18n: null,
    richDescription: '<p>Una casa frente al río.</p>',
    richDescriptionI18n: { es: '<p>Una casa frente al río.</p>', en: null, pt: null },
    isFeatured: false,
    ownerId: OWNER_ID,
    destinationId: '66666666-6666-4666-8666-666666666666',
    media: { featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' } },
    location: { street: 'Av. Costanera', number: '123' },
    averageRating: 4.5,
    reviewsCount: 3,
    publicationStatus: 'PUBLISHED',
    seo: null,
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 },
    contactInfo: null,
    socialNetworks: null,
    faqs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

function queueEmptySelects(): void {
    mockSelect.mockImplementation(() => {
        const chain = {
            from: () => chain,
            innerJoin: () => chain,
            where: () => Promise.resolve([])
        };
        return chain;
    });
}

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.INTERNAL_ERROR]: 500
};

function buildApp(actor: {
    id: string;
    roles: readonly RoleEnum[];
    permissions: PermissionEnum[];
}): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
    app.route('/', protectedGetOwnAccommodationByIdRoute);
    return app;
}

const staff = (permissions: PermissionEnum[]) => ({
    id: OWNER_ID,
    roles: [RoleEnum.ADMIN],
    permissions
});

beforeEach(() => {
    mockGetById.mockResolvedValue({ data: ACCOMMODATION, error: undefined });
    mockEffectiveSet.mockImplementation(async () => ({ entitlements: { get: () => 1 } }));
    queueEmptySelects();
});
afterEach(() => vi.clearAllMocks());

describe('TEST:1693:1 the protected accommodation detail reads a foreign listing only with the inspection permission', () => {
    const foreignPublished = { ...ACCOMMODATION, ownerId: OTHER_USER_ID };

    it('denies UPDATE_ANY alone with the same 404 as an unprivileged stranger', async () => {
        mockGetById.mockResolvedValue({ data: foreignPublished, error: undefined });
        const withWrite = await buildApp(staff([PermissionEnum.ACCOMMODATION_UPDATE_ANY])).request(
            `/${ACCOMMODATION_ID}`
        );
        const without = await buildApp({
            id: OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        }).request(`/${ACCOMMODATION_ID}`);
        const { metadata: _withMetadata, ...withWriteBody } = await withWrite.json();
        const { metadata: _withoutMetadata, ...withoutBody } = await without.json();
        expect({ status: withWrite.status, body: withWriteBody }).toEqual({
            status: without.status,
            body: withoutBody
        });
        expect(withWrite.status).toBe(404);
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockEffectiveSet).not.toHaveBeenCalled();
    });

    it('lets VIEW_ALL inspect a foreign DRAFT using the listing owner as subject', async () => {
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID, publicationStatus: 'DRAFT' },
            error: undefined
        });
        const res = await buildApp(staff([PermissionEnum.ACCOMMODATION_VIEW_ALL])).request(
            `/${ACCOMMODATION_ID}`
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.id).toBe(ACCOMMODATION_ID);
        expect(mockEffectiveSet).toHaveBeenCalledWith({
            userId: OTHER_USER_ID,
            vertical: 'accommodation'
        });
    });

    it('lets VIEW_ALL read a foreign PUBLISHED listing', async () => {
        mockGetById.mockResolvedValue({ data: foreignPublished, error: undefined });
        const res = await buildApp(staff([PermissionEnum.ACCOMMODATION_VIEW_ALL])).request(
            `/${ACCOMMODATION_ID}`
        );
        expect(res.status).toBe(200);
        expect((await res.json()).data.id).toBe(ACCOMMODATION_ID);
    });

    it('lets an actor with both write and inspection permissions inspect a foreign DRAFT', async () => {
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID, publicationStatus: 'DRAFT' },
            error: undefined
        });
        const res = await buildApp(
            staff([PermissionEnum.ACCOMMODATION_UPDATE_ANY, PermissionEnum.ACCOMMODATION_VIEW_ALL])
        ).request(`/${ACCOMMODATION_ID}`);
        expect(res.status).toBe(200);
    });

    it('keeps owner access and denies a stranger a foreign DRAFT', async () => {
        const owner = await buildApp({
            id: OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        }).request(`/${ACCOMMODATION_ID}`);
        expect(owner.status).toBe(200);
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID, publicationStatus: 'DRAFT' },
            error: undefined
        });
        const stranger = await buildApp({
            id: OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: []
        }).request(`/${ACCOMMODATION_ID}`);
        expect(stranger.status).toBe(404);
    });
});
