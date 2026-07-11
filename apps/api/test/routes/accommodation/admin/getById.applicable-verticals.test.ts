/**
 * Regression test — GET /api/v1/admin/accommodations/:id 500 on applicableVerticals
 * (SPEC-266 follow-up bugfix, branch fix/admin-accom-getbyid-applicable-verticals).
 *
 * Root cause: `fetchAdminAmenities` / `fetchAdminFeatures` in
 * `src/routes/accommodation/admin/getById.ts` hand-roll Drizzle projections that select
 * catalog columns for `AmenityAdminSchema` / `FeatureAdminSchema` but omitted the SPEC-266
 * `applicableVerticals` column (required, `.min(1)`, no default/optional). Any accommodation
 * with at least one amenity AND/OR feature attached returned `applicableVerticals: undefined`
 * on those rows, failing `AccommodationAdminSchema.safeParse()` inside `stripWithSchema` and
 * producing an HTTP 500 ("Response payload does not match declared schema"). Accommodations
 * with zero amenities/features sidestepped the bug entirely — the route omits empty
 * amenities/features arrays from the response (`amenitiesData.length > 0 ? amenitiesData :
 * undefined`) — which is why this regression needs a NON-EMPTY fixture on both relations to
 * actually exercise the failure path.
 *
 * Testing strategy mirrors two existing precedents in this codebase:
 * - `test/routes/accommodation-verify.test.ts` — minimal Hono app mounting only the target
 *   route, with `@repo/service-core` locally mocked (bypasses the shared `initApp()` +
 *   `test/setup.ts` global mocks).
 * - `test/routes/accommodation/public/getBySlug.rich-description.test.ts` — same pattern,
 *   plus a locally mocked `@repo/db` with a queueable `select()` chain to control the
 *   hand-rolled junction-table projections.
 *
 * Deliberately does NOT mock `createResponse` / `stripWithSchema` (unlike
 * accommodation-verify.test.ts) — the whole point of this test is to exercise the REAL
 * response-schema validation path that the original bug broke.
 *
 * This is a separate file from the existing `getById.test.ts` (which uses the shared
 * `initApp()` + the global `@repo/service-core` / `@repo/db` mocks from `test/setup.ts`)
 * because those global mocks lack `adminGetById` entirely (calling it throws, which already
 * produces a non-403/404 status the existing gate-only assertions accept) and never return
 * real amenity/feature row data, so they cannot exercise `stripWithSchema` at all. Overriding
 * `@repo/db` module-wide for that file would also break `initApp()`'s bootstrap of every
 * other route module that imports table/model exports from `@repo/db` at module scope.
 *
 * @module test/routes/accommodation/admin/getById.applicable-verticals
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
            accommodationId: 'raa.accommodationId'
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
        role: 'SUPER_ADMIN',
        permissions: ['access.panelAdmin']
    }),
    isGuestActor: (actor: { role: string }) => actor.role === 'GUEST',
    createGuestActor: () => ({ id: 'guest', role: 'GUEST', permissions: [] })
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
    visibility: 'PUBLIC',
    seo: {
        title: 'Hotel Test Accommodation SEO Title',
        description:
            'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
    },
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: {
        capacity: 4,
        minNights: 1,
        bedrooms: 2,
        bathrooms: 1
    },
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
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
    deletedById: null
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

describe('GET /:id — adminGetAccommodationByIdRoute — applicableVerticals regression', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdminGetById.mockResolvedValue({ data: ACCOMMODATION_FIXTURE, error: undefined });
        // Order matches the handler's Promise.all([fetchAdminAmenities, fetchAdminFeatures]).
        queueSelectResults([AMENITY_ROW], [FEATURE_ROW]);
        app = buildApp();
    });

    it('returns 200 (not 500) when the accommodation has >=1 amenity AND >=1 feature', async () => {
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
    });

    it('response payload validates against AccommodationAdminSchema — amenities/features carry applicableVerticals', async () => {
        const res = await app.request(`/${ACCOMMODATION_ID}`);
        const body = await res.json();

        expect(body.success).toBe(true);
        expect(body.data.amenities).toHaveLength(1);
        expect(body.data.amenities[0].applicableVerticals).toEqual(['accommodation']);
        expect(body.data.features).toHaveLength(1);
        expect(body.data.features[0].applicableVerticals).toEqual(['accommodation']);
    });

    it('still returns 200 when only amenities are present (features empty)', async () => {
        queueSelectResults([AMENITY_ROW], []);

        const res = await app.request(`/${ACCOMMODATION_ID}`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.amenities).toHaveLength(1);
        expect(body.data.features).toBeUndefined();
    });
});
