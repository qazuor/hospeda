/**
 * HOS-321 — regression test for GET /api/v1/protected/accommodations/:id.
 *
 * Bug: the route returned the accommodation row WITHOUT the
 * `r_accommodation_amenity` / `r_accommodation_feature` junction relations.
 * `AccommodationService.getDefaultGetByIdRelations()` deliberately omits them
 * (they need a dedicated join projection), and — unlike the admin `getById`
 * and the public `getBySlug` routes, which both enrich the payload in the
 * route handler — this route never loaded them.
 *
 * Consequence in the web host editor (`AccommodationEditor.client.tsx`): the
 * form baseline was built from this response, so `amenityIds` / `featureIds`
 * were ALWAYS `[]`. Two visible symptoms:
 *  1. Previously saved amenities/features rendered as unchecked.
 *  2. Saving was destructive — the PATCH diff sent the handful of boxes the
 *     host ticked in that session as the complete target set, and
 *     `syncAmenityJunction` (exact-set contract) deleted every other row.
 *
 * `AccommodationProtectedSchema` already DECLARED `amenities` / `features`
 * (see `accommodation.access.schema.ts`), so the response contract was never
 * the blocker — only the route handler's failure to populate it.
 *
 * Mount strategy mirrors `featured-toggle.test.ts`: the REAL
 * `createProtectedRoute` output is mounted into a bare Hono app with the actor
 * injected, so the response passes through the real fail-closed
 * `stripWithSchema` pipeline.
 */

import {
    AccommodationProtectedSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const AMENITY_ID = '44444444-4444-4444-8444-444444444444';
const FEATURE_ID = '55555555-5555-4555-8555-555555555555';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetById, mockSelect } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockSelect: vi.fn()
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

// `@repo/db` re-exports its tables through chained `export *` barrels, which
// are not materialized on the object spread inside a `vi.mock` factory — the
// table bindings come back `undefined`. Stub the four tables the route joins
// (mirroring `accommodation/public/getBySlug.rich-description.test.ts`): the
// query is never executed, so column identity does not matter here.
vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
        // `and`, `isNull` and the `deletedAt` columns below are DELIBERATE
        // scaffolding, not leftovers: the route must NOT filter soft-deleted
        // catalog rows (doing so makes the next exact-set save hard-delete a
        // link the owner never saw). Keeping the stubs means a re-added filter
        // fails on the readable `where` assertion instead of crashing with
        // `TypeError: isNull is not a function`.
        and: (...conditions: unknown[]) => ({ op: 'and', conditions }),
        isNull: (column: unknown) => ({ op: 'isNull', column }),
        amenities: {
            __table: 'amenities',
            deletedAt: 'amenities.deletedAt',
            id: 'amenities.id',
            slug: 'amenities.slug',
            description: 'amenities.description',
            icon: 'amenities.icon',
            applicableVerticals: 'amenities.applicableVerticals',
            type: 'amenities.type',
            isFeatured: 'amenities.isFeatured',
            displayWeight: 'amenities.displayWeight',
            isBuiltin: 'amenities.isBuiltin',
            lifecycleState: 'amenities.lifecycleState',
            createdAt: 'amenities.createdAt',
            updatedAt: 'amenities.updatedAt'
        },
        features: {
            __table: 'features',
            deletedAt: 'features.deletedAt',
            id: 'features.id',
            slug: 'features.slug',
            description: 'features.description',
            icon: 'features.icon',
            applicableVerticals: 'features.applicableVerticals',
            isFeatured: 'features.isFeatured',
            displayWeight: 'features.displayWeight',
            isBuiltin: 'features.isBuiltin',
            lifecycleState: 'features.lifecycleState',
            createdAt: 'features.createdAt',
            updatedAt: 'features.updatedAt'
        },
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

/**
 * Minimal accommodation payload that satisfies `AccommodationProtectedSchema`
 * (the route's declared, fail-closed response contract).
 */
const ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    slug: 'hotel-hos-321',
    name: 'Hotel HOS-321',
    type: 'HOTEL',
    summary: 'A test accommodation for the junction-relation regression.',
    description:
        'A description long enough to satisfy the accommodation read schema without tripping any minimum-length bound.',
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

/** Catalog row shaped like `AmenityProtectedSchema`. */
const AMENITY_ROW = {
    id: AMENITY_ID,
    slug: 'wifi',
    description: { es: 'Wifi en todo el predio', en: 'Wifi everywhere', pt: 'Wifi em todo lugar' },
    icon: 'wifi',
    applicableVerticals: ['accommodation'],
    type: 'CONNECTIVITY',
    isFeatured: false,
    displayWeight: 50,
    isBuiltin: true,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
};

/** Catalog row shaped like `FeatureProtectedSchema` (no `type` column). */
const FEATURE_ROW = {
    id: FEATURE_ID,
    slug: 'parking',
    description: { es: 'Estacionamiento propio', en: 'Private parking', pt: 'Estacionamento' },
    icon: 'parking',
    applicableVerticals: ['accommodation'],
    isFeatured: false,
    displayWeight: 50,
    isBuiltin: true,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
};

/** One captured `select().from().innerJoin().where()` call. */
interface CapturedQuery {
    projection: Record<string, unknown>;
    from: unknown;
    joinTable: unknown;
    joinOn: unknown;
    where: unknown;
}

/** Queries captured from the route, in call order (amenities, then features). */
const capturedQueries: CapturedQuery[] = [];

/**
 * The element shape of `AccommodationProtectedSchema.amenities` — i.e. the
 * lenient overlay the route is actually validated against. The overlays
 * themselves are module-private in `accommodation.access.schema.ts`, so this
 * walks the public schema to reach them.
 */
function amenityRowShape(): Record<string, unknown> {
    const field = AccommodationProtectedSchema.shape.amenities as unknown as {
        unwrap: () => { element: { shape: Record<string, unknown> } };
    };
    return field.unwrap().element.shape;
}

/** Feature counterpart of {@link amenityRowShape}. */
function featureRowShape(): Record<string, unknown> {
    const field = AccommodationProtectedSchema.shape.features as unknown as {
        unwrap: () => { element: { shape: Record<string, unknown> } };
    };
    return field.unwrap().element.shape;
}

/**
 * Builds a thenable Drizzle `select().from().innerJoin().where()` chain that
 * resolves to `rows`. Each `mockSelect()` call consumes the next queued result,
 * so the amenity and feature queries can return different sets.
 *
 * Every argument is recorded into {@link capturedQueries}. That matters: a
 * route that dropped the `accommodationId` filter would return the WHOLE
 * catalog as "selected", the editor would render every box checked, and the
 * next save would write all of them — the same family of destruction HOS-321
 * fixes. A chain that swallows its arguments cannot see that.
 */
function queueSelectResults(...results: readonly (readonly unknown[])[]): void {
    let call = 0;
    mockSelect.mockImplementation((projection: Record<string, unknown>) => {
        const rows = results[call] ?? [];
        call += 1;
        const captured: CapturedQuery = {
            projection,
            from: undefined,
            joinTable: undefined,
            joinOn: undefined,
            where: undefined
        };
        capturedQueries.push(captured);

        const chain = {
            from: (table: unknown) => {
                captured.from = table;
                return chain;
            },
            innerJoin: (table: unknown, on: unknown) => {
                captured.joinTable = table;
                captured.joinOn = on;
                return chain;
            },
            where: (condition: unknown) => {
                captured.where = condition;
                return Promise.resolve(rows);
            }
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
    role: RoleEnum;
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
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

beforeEach(() => {
    capturedQueries.length = 0;
    mockGetById.mockResolvedValue({ data: ACCOMMODATION, error: undefined });
    queueSelectResults([AMENITY_ROW], [FEATURE_ROW]);
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/accommodations/:id — junction relations (HOS-321)', () => {
    it('includes the amenities linked through r_accommodation_amenity', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // RED before the fix: `amenities` is absent, so the web editor's
        // `transformAccommodationEdit` derives `amenityIds: []`.
        expect(body.data.amenities).toBeDefined();
        expect(body.data.amenities).toHaveLength(1);
        expect(body.data.amenities[0].id).toBe(AMENITY_ID);
        expect(body.data.amenities[0].slug).toBe('wifi');
        expect(body.data.amenities[0].description).toEqual(AMENITY_ROW.description);
    });

    it('includes the features linked through r_accommodation_feature', async () => {
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.features).toBeDefined();
        expect(body.data.features).toHaveLength(1);
        expect(body.data.features[0].id).toBe(FEATURE_ID);
        expect(body.data.features[0].slug).toBe('parking');
    });

    it('omits both arrays when the accommodation has no junction rows', async () => {
        queueSelectResults([], []);
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.amenities).toBeUndefined();
        expect(body.data.features).toBeUndefined();
    });

    it('scopes both joins to THIS accommodation and does not filter soft-deleted rows', async () => {
        const app = buildApp(ownerActor);
        await app.request(`/${ACCOMMODATION_ID}`);

        expect(capturedQueries).toHaveLength(2);
        const amenityQuery = capturedQueries[0] as CapturedQuery;
        const featureQuery = capturedQueries[1] as CapturedQuery;

        // Without the accommodation-id filter the route would hand back the
        // WHOLE catalog as this owner's selection.
        expect((amenityQuery.from as { __table: string }).__table).toBe('raa');
        expect((amenityQuery.joinTable as { __table: string }).__table).toBe('amenities');
        expect(amenityQuery.joinOn).toEqual({
            op: 'eq',
            left: 'raa.amenityId',
            right: 'amenities.id'
        });
        // A bare `eq`, NOT an `and(..., isNull(deletedAt))`. Excluding a
        // soft-deleted catalog row would drop its link from the baseline, and
        // the next exact-set save would hard-delete a link the owner never saw.
        expect(amenityQuery.where).toEqual({
            op: 'eq',
            left: 'raa.accommodationId',
            right: ACCOMMODATION_ID
        });

        expect((featureQuery.from as { __table: string }).__table).toBe('raf');
        expect((featureQuery.joinTable as { __table: string }).__table).toBe('features');
        expect(featureQuery.joinOn).toEqual({
            op: 'eq',
            left: 'raf.featureId',
            right: 'features.id'
        });
        expect(featureQuery.where).toEqual({
            op: 'eq',
            left: 'raf.accommodationId',
            right: ACCOMMODATION_ID
        });
    });

    it('projects exactly the columns the response schema declares', async () => {
        const app = buildApp(ownerActor);
        await app.request(`/${ACCOMMODATION_ID}`);

        const amenityQuery = capturedQueries[0] as CapturedQuery;
        const featureQuery = capturedQueries[1] as CapturedQuery;

        // Pins the projection against the schema the route ACTUALLY validates
        // against — the lenient overlay reached through
        // `AccommodationProtectedSchema`, not the strict `AmenityProtectedSchema`
        // it extends. The two coincide today, but `.extend()` can ADD keys: an
        // overlay that declared a field the projection never selects would 500
        // every protected GET, and comparing against the strict schema would
        // not notice.
        expect(Object.keys(amenityQuery.projection).sort()).toEqual(
            Object.keys(amenityRowShape()).sort()
        );
        expect(Object.keys(featureQuery.projection).sort()).toEqual(
            Object.keys(featureRowShape()).sort()
        );
    });

    it('tolerates a catalog row that violates the strict write bounds', async () => {
        // The catalog is ADMIN-owned but this response is fail-closed for the
        // HOST: before the lenient read overlay a single row like this threw
        // INTERNAL_ERROR, the GET 500'd, and `editar.astro` silently redirected
        // the owner away from their own accommodation (the HOS-190 lock-out).
        queueSelectResults(
            [
                {
                    ...AMENITY_ROW,
                    slug: 'x', // below the write schema's min(3)
                    icon: 'a', // below min(2)
                    applicableVerticals: [], // the DB column default, which min(1) rejects
                    displayWeight: 0, // below min(1)
                    description: { es: 'corta' } // partial i18n, under min(10)
                }
            ],
            [FEATURE_ROW]
        );

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        // The relaxed values must SURVIVE, not be silently stripped to
        // undefined. (The editor renders labels from the separately-fetched
        // `/public/amenities` catalog, not from these rows — this asserts the
        // overlay RELAXES the bounds rather than dropping the fields, which is
        // what "one-directional" has to mean to be worth anything.)
        const amenity = body.data.amenities[0];
        expect(amenity.id).toBe(AMENITY_ID);
        expect(amenity.slug).toBe('x');
        expect(amenity.icon).toBe('a');
        expect(amenity.applicableVerticals).toEqual([]);
        expect(amenity.displayWeight).toBe(0);
        expect(amenity.description).toEqual({ es: 'corta' });
    });

    it('accepts a row that OMITS the optional catalog fields', async () => {
        // Every relaxation in the overlay has to be one-directional. Dropping
        // `.default(50)` off `displayWeight` (or making `description`/`slug`
        // required) would make an omitted key newly INVALID — a lock-out
        // introduced by the very block that exists to prevent lock-outs.
        queueSelectResults(
            [
                {
                    id: AMENITY_ID,
                    icon: null,
                    applicableVerticals: ['accommodation'],
                    type: 'CONNECTIVITY',
                    isFeatured: false,
                    isBuiltin: true,
                    lifecycleState: 'ACTIVE',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-01-01T00:00:00.000Z')
                }
            ],
            // Feature `slug` is REQUIRED on the strict schema — the overlay
            // relaxing it to `.nullish()` is the load-bearing half here.
            [{ ...FEATURE_ROW, slug: null }]
        );

        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.amenities[0].displayWeight).toBe(50);
        expect(body.data.features[0].id).toBe(FEATURE_ID);
    });

    it('serves an actor holding ACCOMMODATION_UPDATE_ANY who is not the owner', async () => {
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID },
            error: undefined
        });

        const app = buildApp({
            id: OWNER_ID,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.amenities[0].id).toBe(AMENITY_ID);
    });

    it('does not query the junction tables when ownership is rejected', async () => {
        mockGetById.mockResolvedValue({
            data: { ...ACCOMMODATION, ownerId: OTHER_USER_ID },
            error: undefined
        });
        const app = buildApp(ownerActor);
        const res = await app.request(`/${ACCOMMODATION_ID}`);

        expect(res.status).toBe(404);
        expect(mockSelect).not.toHaveBeenCalled();
    });
});
