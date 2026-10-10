/** Protected accommodation editor filters rich content by the owner capability. */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

const RICH_HTML = '<p>Una casa <strong>frente al río</strong> con galería.</p>';
const RICH_I18N = {
    es: RICH_HTML,
    en: '<p>A house <strong>facing the river</strong> with a porch.</p>',
    pt: null
};

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetById, mockSelect, mockEffectiveSet } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockSelect: vi.fn(),
    mockEffectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // `function` (not an arrow) — the route calls this with `new`.
        AccommodationService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById };
        })
    };
});

// `@repo/db` re-exports its tables through chained `export *` barrels, which are
// not materialized by the object spread inside a `vi.mock` factory. Stub the
// tables the route joins for its amenity/feature enrichment; the queries here
// resolve to empty sets, so column identity does not matter.
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

// Dynamic import AFTER the vi.mock calls so the route picks up the mocks.
const { protectedGetOwnAccommodationByIdRoute } = await import(
    '../../../../src/routes/accommodation/protected/getById.js'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal accommodation payload satisfying `AccommodationProtectedSchema`. */
const ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    slug: 'casa-beta-199',
    name: 'Casa BETA-199',
    type: 'HOUSE',
    summary: 'A test accommodation for the rich-description exposure regression.',
    description:
        'A description long enough to satisfy the accommodation read schema without tripping any minimum-length bound.',
    nameI18n: { es: 'Casa BETA-199', en: 'BETA-199 House', pt: 'Casa BETA-199' },
    summaryI18n: null,
    descriptionI18n: null,
    richDescription: RICH_HTML,
    richDescriptionI18n: RICH_I18N,
    isFeatured: false,
    ownerId: OWNER_ID,
    destinationId: '66666666-6666-4666-8666-666666666666',
    media: { featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' } },
    location: { street: 'Av. Costanera', number: '123' },
    averageRating: 4.5,
    reviewsCount: 3,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
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

/** Drizzle `select().from().innerJoin().where()` chain resolving to no rows. */
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

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

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
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
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

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

beforeEach(() => {
    mockGetById.mockResolvedValue({ data: ACCOMMODATION, error: undefined });
    mockEffectiveSet.mockImplementation(async () => ({ entitlements: { get: () => 1 } }));
    queueEmptySelects();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TEST:V5:31 GET /api/v1/protected/accommodations/:id — owner rich description', () => {
    it('returns both rich-description fields when the owner is entitled', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        // RED before the schema change: `stripWithSchema` deleted both, so the
        // TranslationPanel's richDescription row rendered "—" for every locale.
        expect(body.data.richDescriptionI18n).toEqual(RICH_I18N);
        expect(body.data.richDescription).toBe(RICH_HTML);
    });

    it('omits both fields when the owner lacks the effective capability', async () => {
        mockEffectiveSet.mockImplementation(async () => ({ entitlements: { get: () => 0 } }));

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).not.toHaveProperty('richDescriptionI18n');
        expect(body.data).not.toHaveProperty('richDescription');
        expect(body.data.id).toBe(ACCOMMODATION_ID);
        expect(body.data.nameI18n).toEqual(ACCOMMODATION.nameI18n);
    });

    it('serves an authorized admin reading another owner’s row', async () => {
        // An admin holding ACCOMMODATION_UPDATE_ANY reads someone else's row. The
        // entitlement lookup must be keyed by that row's ownerId — keying it by
        // the reader would hand out (or withhold) premium content according to
        // who happens to be looking.
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID },
            error: undefined
        });

        mockEffectiveSet.mockImplementation(async ({ userId }: { userId: string }) => ({
            entitlements: { get: () => (userId === OTHER_USER_ID ? 1 : 0) }
        }));
        const app = buildApp({
            id: OWNER_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        expect(mockEffectiveSet).toHaveBeenCalledWith({
            userId: OTHER_USER_ID,
            vertical: 'accommodation'
        });
        const body = await res.json();
        expect(body.data.richDescription).toBe(RICH_HTML);
        expect(body.data.richDescriptionI18n).toEqual(RICH_I18N);
    });

    it('keeps the editor available when the effective set lookup fails', async () => {
        // The entitlement lookup hits billing. Letting it throw would 500 the GET,
        // and `editar.astro` redirects the owner away on a failed fetch: a billing
        // hiccup would lock the host out of editing their own accommodation
        // entirely (the HOS-190 lock-out). So the failure is contained, and it
        // resolves to "no entitlement proven" → the premium pair is withheld while
        // every other field is still served.
        mockEffectiveSet.mockRejectedValue(new Error('billing unreachable'));

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).not.toHaveProperty('richDescriptionI18n');
        expect(body.data).not.toHaveProperty('richDescription');
        expect(body.data.name).toBe('Casa BETA-199');
    });

    it('does not resolve owner entitlements when ownership is rejected', async () => {
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID },
            error: undefined
        });

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(404);
        expect(mockEffectiveSet).not.toHaveBeenCalled();
    });

    it('keeps the entitled response usable when the columns are empty', async () => {
        // The "entitled but never written" case: the keys must still be PRESENT
        // (as null) so the panel can tell it apart from the gated case above.
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, richDescription: null, richDescriptionI18n: null },
            error: undefined
        });

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveProperty('richDescriptionI18n');
        expect(body.data.richDescriptionI18n).toBeNull();
    });
});
