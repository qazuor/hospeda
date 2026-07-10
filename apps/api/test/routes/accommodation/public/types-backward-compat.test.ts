/**
 * Backward-compatibility + edge-case suite for the accommodation `type`/`types`
 * facet (HOS-96 T-021, T-022).
 *
 * Accommodation `type`/`types` is the PRE-EXISTING blueprint this spec's
 * events/posts `categories` fields were modeled after (see
 * `AccommodationModel.search()`'s `types`/`type` branch). It already shipped
 * before HOS-96 and its schema/model are explicitly out of scope to touch —
 * this file only LOCKS IN the already-shipped contract with tests, since none
 * existed at the HTTP-round-trip layer before.
 *
 * T-021 — singular `?type=` keeps working standalone, and when both `type`
 * and `types` are present, the array wins (same precedence rule as events'
 * `category`/`categories` and posts' `category`/`categories`).
 *
 * T-022 — empty `?types=` resolves to unfiltered (not `IN ()`), selecting
 * every enum value is equivalent to no filter at all. Unlike events/posts
 * `categories`, `AccommodationSearchHttpSchema.types` has NO enum-pipe
 * validation (see `packages/schemas/src/entities/accommodation/accommodation.http.schema.ts`
 * line ~74: `createArrayQueryParam(...)` without `.pipe(z.array(enum))`), so
 * an invalid member does NOT get the strict-400 behavior OQ-3 gives events/
 * posts `categories` — that is a pre-existing, out-of-scope gap in the
 * blueprint, not a HOS-96 regression, and is documented (not "fixed") here.
 *
 * The public accommodation list route has several collaborators beyond
 * AccommodationService (SearchHistoryService, quick-amenity resolver, owner
 * entitlement resolution) — all of them short-circuit cleanly for a GUEST
 * actor with no boolean amenity flags and no `ownerId` on the fixture items,
 * so no extra mocking is required beyond overriding AccommodationService.
 *
 * @see .specs/HOS-96-multi-select-quick-filter-chips/spec.md — US-10, US-11
 */
import { AccommodationTypeEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture — one accommodation per AccommodationTypeEnum member, shaped to
// satisfy AccommodationPublicSchema. This minimal shape is the same one
// already proven valid as the `relatedAccommodation` nested relation in
// `test/schema-validation/post-getById-schema.test.ts` (GAP-031).
// Deliberately has NO `ownerId` / `isVerified: true` so the route's owner-
// entitlement resolution and verification-badge gate stay no-ops.
// ---------------------------------------------------------------------------

const VALID_MEDIA = {
    featuredImage: { url: 'https://example.com/image.jpg', moderationState: 'APPROVED' }
};

function makeAccommodation(id: string, slug: string, type: AccommodationTypeEnum) {
    return {
        id,
        slug,
        name: `Test Accommodation ${slug}`,
        type,
        summary: 'A related accommodation for testing purposes.',
        description:
            'Description of the test accommodation. This needs to be at least 30 characters long.',
        isFeatured: false,
        destinationId: '33333333-3333-4333-8333-333333333333',
        visibility: 'PUBLIC',
        averageRating: 3.5,
        reviewsCount: 5,
        media: VALID_MEDIA,
        location: { city: 'Test City', country: 'Argentina' }
    };
}

/** One fixture item per AccommodationTypeEnum member — for the all-selected proof. */
const ALL_TYPES = Object.values(AccommodationTypeEnum);
const ACCOMMODATION_FIXTURE = ALL_TYPES.map((type, index) =>
    makeAccommodation(
        `${String(index + 1).padStart(2, '0')}111111-1111-4111-8111-111111111111`,
        `acc-${type.toLowerCase()}`,
        type
    )
);

/**
 * Test oracle mirroring the real AccommodationModel.search() `types`/`type`
 * WHERE-branch precedence (pre-existing blueprint): `types` (non-empty
 * array) wins over singular `type`; singular alone still filters; absence
 * of both means unfiltered (NOT `IN ()`).
 */
function searchByTypeOracle(query: { types?: string[]; type?: string }) {
    const activeTypes =
        Array.isArray(query.types) && query.types.length > 0
            ? query.types
            : query.type
              ? [query.type]
              : undefined;

    const items = activeTypes
        ? ACCOMMODATION_FIXTURE.filter((a) => activeTypes.includes(a.type))
        : ACCOMMODATION_FIXTURE;

    return { data: { items, total: items.length } };
}

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: async (_actor: Actor, query: Record<string, unknown>) =>
                    searchByTypeOracle(query)
            };
        }),
        ServiceError: class ServiceError extends Error {
            constructor(
                public readonly code: string,
                message: string
            ) {
                super(message);
                this.name = 'ServiceError';
            }
        }
    };
});

const { initApp } = await import('../../../../src/app.js');

describe('GET /api/v1/public/accommodations — type/types backward compat + edge cases (HOS-96 T-021/T-022)', () => {
    let app: ReturnType<typeof initApp>;
    const BASE = '/api/v1/public/accommodations';

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // T-021 — singular `type` still works standalone (US-10)
    // -----------------------------------------------------------------------

    describe('singular `type` still works standalone', () => {
        it('?type=HOTEL returns only hotels', async () => {
            const res = await app.request(`${BASE}?type=HOTEL`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const types = (body.data.items as Array<{ type: string }>).map((item) => item.type);
            expect(types.length).toBeGreaterThan(0);
            expect(types.every((t) => t === 'HOTEL')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // T-021 — both present: array wins (US-10)
    // -----------------------------------------------------------------------

    describe('both `type` and `types` present: array wins', () => {
        it('?type=HOTEL&types=CABIN,APARTMENT returns cabins+apartments, NOT hotel', async () => {
            const res = await app.request(`${BASE}?type=HOTEL&types=CABIN,APARTMENT`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const types = (body.data.items as Array<{ type: string }>).map((item) => item.type);
            expect(types).toContain('CABIN');
            expect(types).toContain('APARTMENT');
            expect(types).not.toContain('HOTEL');
        });
    });

    // -----------------------------------------------------------------------
    // T-022 — empty array param resolves to unfiltered, not IN ()
    // -----------------------------------------------------------------------

    describe('empty ?types= resolves to unfiltered', () => {
        it('?types= returns the full fixture set, not an empty result', async () => {
            const res = await app.request(`${BASE}?types=`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.items).toHaveLength(ACCOMMODATION_FIXTURE.length);
        });
    });

    // -----------------------------------------------------------------------
    // T-022 — selecting every type is equivalent to no filter
    // -----------------------------------------------------------------------

    describe('all-values-selected == fully unfiltered result set', () => {
        it('?types=<every enum value> returns the same set as no filter at all', async () => {
            const [allSelected, unfiltered] = await Promise.all([
                app.request(`${BASE}?types=${ALL_TYPES.join(',')}`, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                }),
                app.request(BASE, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ]);

            expect(allSelected.status).toBe(200);
            expect(unfiltered.status).toBe(200);

            const allSelectedBody = await allSelected.json();
            const unfilteredBody = await unfiltered.json();

            const allSelectedIds = (allSelectedBody.data.items as Array<{ id: string }>)
                .map((i) => i.id)
                .sort();
            const unfilteredIds = (unfilteredBody.data.items as Array<{ id: string }>)
                .map((i) => i.id)
                .sort();

            expect(allSelectedIds).toEqual(unfilteredIds);
        });
    });

    // -----------------------------------------------------------------------
    // T-022 — pre-existing nuance: invalid `types` member is NOT rejected
    // (documented gap in the blueprint, out of scope to fix here — OQ-3's
    // strict-400 behavior was added for events/posts `categories` via a new
    // `.pipe(z.array(enum))`; accommodation `types` never got that pipe).
    // -----------------------------------------------------------------------

    describe('invalid type member (pre-existing blueprint gap, documented not fixed)', () => {
        it('?types=HOTEL,NOT_A_TYPE is accepted by the HTTP schema (NOT a 400)', async () => {
            const res = await app.request(`${BASE}?types=HOTEL,NOT_A_TYPE`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            // Documents actual behavior: no enum-pipe validation on `types` means
            // an invalid member reaches the service as a plain string and simply
            // matches nothing extra — it is NOT rejected at the schema boundary.
            expect(res.status).not.toBe(400);
        });
    });
});
