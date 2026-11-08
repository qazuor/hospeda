/**
 * HOS-2058 -- GET /api/v1/admin/accommodations/:id carries the catalog
 * attributes: `scope`/`availability` from `r_accommodation_amenity` on each
 * amenity, and `category` on each feature, matching the protected getById.
 *
 * Reuses the harness of `getById.applicable-verticals.test.ts`: the mocked
 * `select()` projects fixture rows through the projection the route actually
 * passes, and the REAL `stripWithSchema` runs, so a column missing from the
 * projection OR from `AccommodationAdminSchema` drops the key and fails here.
 *
 * @module test/routes/accommodation/admin/getById.catalog-attributes
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

// ---------------------------------------------------------------------------
// Hoist mocks — must run before any imports of the mocked modules
// ---------------------------------------------------------------------------

const { mockAdminGetById, mockSelect } = vi.hoisted(() => ({
    mockAdminGetById: vi.fn(),
    mockSelect: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                adminGetById: mockAdminGetById
            };
        })
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({ select: mockSelect })),
        amenities: {
            id: 'amenities.id',
            slug: 'amenities.slug',
            description: 'amenities.description',
            icon: 'amenities.icon',
            isBuiltin: 'amenities.isBuiltin',
            isFeatured: 'amenities.isFeatured',
            displayWeight: 'amenities.displayWeight',
            type: 'amenities.type',
            applicableVerticals: 'amenities.applicableVerticals',
            lifecycleState: 'amenities.lifecycleState',
            adminInfo: 'amenities.adminInfo',
            createdAt: 'amenities.createdAt',
            updatedAt: 'amenities.updatedAt',
            createdById: 'amenities.createdById',
            updatedById: 'amenities.updatedById',
            deletedAt: 'amenities.deletedAt',
            deletedById: 'amenities.deletedById'
        },
        features: {
            id: 'features.id',
            slug: 'features.slug',
            description: 'features.description',
            icon: 'features.icon',
            isBuiltin: 'features.isBuiltin',
            isFeatured: 'features.isFeatured',
            displayWeight: 'features.displayWeight',
            category: 'features.category',
            applicableVerticals: 'features.applicableVerticals',
            lifecycleState: 'features.lifecycleState',
            adminInfo: 'features.adminInfo',
            createdAt: 'features.createdAt',
            updatedAt: 'features.updatedAt',
            createdById: 'features.createdById',
            updatedById: 'features.updatedById',
            deletedAt: 'features.deletedAt',
            deletedById: 'features.deletedById'
        },
        rAccommodationAmenity: {
            amenityId: 'raa.amenityId',
            accommodationId: 'raa.accommodationId',
            scope: 'raa.scope',
            availability: 'raa.availability'
        },
        rAccommodationFeature: {
            featureId: 'raf.featureId',
            accommodationId: 'raf.accommodationId'
        }
    };
});

vi.mock('../../../../src/utils/actor.js', () => ({
    getActorFromContext: () => ({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        roles: ['SUPER_ADMIN'],
        permissions: ['access.panelAdmin']
    }),
    // HOS-296: mirrors the real `isGuestActor`, which asks whether the role SET
    // contains GUEST. Left comparing a `role` scalar it would return false for
    // every actor, silently — including a genuine guest.
    isGuestActor: (actor: { roles?: readonly string[] }) => actor.roles?.includes('GUEST') ?? false,
    createGuestActor: () => ({ id: 'guest', roles: ['GUEST'], permissions: [] })
}));

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Route import — MUST come after all vi.mock() calls
// ---------------------------------------------------------------------------

import { adminGetAccommodationByIdRoute } from '../../../../src/routes/accommodation/admin/getById.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '99999999-9999-4999-8999-999999999999';
const AMENITY_ID = '44444444-4444-4444-8444-444444444444';
const FEATURE_ID = '55555555-5555-4555-8555-555555555555';

/**
 * Valid full accommodation fixture — same shape proven to satisfy
 * `AccommodationAdminSchema` in `test/schema-validation/field-enforcement/tiered-enforcement.test.ts`.
 * Amenities/features are added separately by the handler under test.
 */
const ACCOMMODATION_FIXTURE = {
    id: ACCOMMODATION_ID,
    slug: 'hotel-applicable-verticals',
    name: 'Applicable Verticals Hotel',
    type: 'HOTEL',
    summary: 'Accommodation used to regression-test the applicableVerticals fix.',
    description:
        'Long enough description to pass the minimum character requirements set on the schema validation layer.',
    isFeatured: true,
    destinationId: DESTINATION_ID,
    ownerId: OWNER_ID,
    media: {
        featuredImage: {
            url: 'https://example.com/image.jpg',
            moderationState: 'APPROVED'
        }
    },
    location: { city: 'Concepcion del Uruguay', country: 'Argentina' },
    averageRating: 4.5,
    reviewsCount: 42,
    publicationStatus: 'PUBLISHED',
    seo: {
        title: 'Hotel Test Accommodation SEO Title',
        description:
            'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
    },
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: {
        capacity: 4,
        bedrooms: 2,
        bathrooms: 1
    },
    policies: { paymentMethods: ['cash'], minNights: 1 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    createdById: ADMIN_ID,
    updatedById: ADMIN_ID,
    deletedById: null,
    deletedAt: null,
    adminInfo: { notes: 'internal notes', favorite: false }
};

/** Amenity junction-table projection row — matches `fetchAdminAmenities`'s selected columns. */
const AMENITY_ROW = {
    id: AMENITY_ID,
    slug: 'wifi',
    description: null,
    icon: 'wifi-icon',
    isBuiltin: true,
    isFeatured: false,
    displayWeight: 50,
    type: 'CONNECTIVITY',
    applicableVerticals: ['accommodation'],
    lifecycleState: 'ACTIVE',
    adminInfo: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: ADMIN_ID,
    updatedById: ADMIN_ID,
    deletedAt: null,
    deletedById: null,
    scope: 'shared',
    availability: 'seasonal'
};

/** Feature junction-table projection row — matches `fetchAdminFeatures`'s selected columns. */
const FEATURE_ROW = {
    id: FEATURE_ID,
    slug: 'sea-view',
    description: null,
    icon: 'sea-view-icon',
    isBuiltin: true,
    isFeatured: false,
    displayWeight: 50,
    category: 'VIEW',
    applicableVerticals: ['accommodation'],
    lifecycleState: 'ACTIVE',
    adminInfo: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: ADMIN_ID,
    updatedById: ADMIN_ID,
    deletedAt: null,
    deletedById: null
};

/**
 * Queues successive `db.select(...)` call results. Each call to `mockSelect` shifts the
 * next raw row-set off the queue, mirroring the chain shape used by the route
 * (`select(projection).from().innerJoin().where()`, awaited directly with no `.limit()`).
 *
 * Critically, this does NOT return the raw fixture rows verbatim — it projects each raw
 * row through the `projection` object argument actually passed to `.select({...})` by the
 * route under test (keeping only the keys present in that object). This mirrors real
 * Drizzle behavior (the returned row only has the columns you selected) and is what makes
 * this test capable of catching the regression: with the pre-fix projection (missing
 * `applicableVerticals`), the projected row also lacks that key, exactly like the real bug.
 * A naive mock that always returns the full fixture regardless of the projection argument
 * would pass whether or not the source code selects `applicableVerticals`, defeating the
 * point of this regression test.
 */
function queueSelectResults(...rowsByCall: Record<string, unknown>[][]) {
    mockSelect.mockImplementation((projection: Record<string, unknown>) => {
        const rawRows = rowsByCall.shift() ?? [];
        const projectedRows = rawRows.map((raw) => {
            const projected: Record<string, unknown> = {};
            for (const key of Object.keys(projection)) {
                projected[key] = raw[key];
            }
            return projected;
        });
        return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(projectedRows)
        };
    });
}

// ---------------------------------------------------------------------------
// App factory — minimal Hono app to bypass the global middleware chain
// ---------------------------------------------------------------------------

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>({ strict: false });
    app.route('/', adminGetAccommodationByIdRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /:id — adminGetAccommodationByIdRoute — catalog attributes (HOS-2058)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdminGetById.mockResolvedValue({ data: ACCOMMODATION_FIXTURE, error: undefined });
        app = buildApp();
    });

    it('returns amenity scope/availability and feature category', async () => {
        queueSelectResults([AMENITY_ROW], [FEATURE_ROW]);

        const res = await app.request(`/${ACCOMMODATION_ID}`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.amenities[0].scope).toBe('shared');
        expect(body.data.amenities[0].availability).toBe('seasonal');
        expect(body.data.features[0].category).toBe('VIEW');
    });

    it('passes undeclared attributes through as null', async () => {
        queueSelectResults(
            [{ ...AMENITY_ROW, scope: null, availability: null }],
            [{ ...FEATURE_ROW, category: null }]
        );

        const res = await app.request(`/${ACCOMMODATION_ID}`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.amenities[0].scope).toBeNull();
        expect(body.data.amenities[0].availability).toBeNull();
        expect(body.data.features[0].category).toBeNull();
    });
});
