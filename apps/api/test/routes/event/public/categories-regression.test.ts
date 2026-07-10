/**
 * Regression suite for the shipped `?category=A,B` latent bug (HOS-96 T-020).
 *
 * Before T-002 (schema) + T-004 (model) + T-006 (service forwarding) landed,
 * `EventSearchHttpSchema` had no `categories` array field. Because the schema
 * is a plain (non-strict) `z.object`, an unknown `?categories=MUSIC,CULTURE`
 * query param was silently STRIPPED before ever reaching the service — the
 * events sidebar already serialized this shape, so real users hit a listing
 * that silently ignored their multi-category selection and matched EVERY
 * event instead of the union of the selected categories.
 *
 * This suite proves the fix end-to-end through a real HTTP request:
 * schema parses `?categories=MUSIC,CULTURE` into an array → the route
 * forwards it to `EventService.search()` → the (mocked) service applies the
 * exact same union semantics the real `EventModel` WHERE branch implements
 * (see `packages/db/test/models/event.model.categories.test.ts` for the
 * real-model proof of that branch) → the response contains events of BOTH
 * categories and excludes the third fixture category entirely.
 *
 * RED before the fix: `categories` never reaches the mocked service (it is
 * stripped at the schema boundary), so the mock's fallback path returns the
 * FULL unfiltered fixture — which fails the "does not include SPORTS"
 * assertion below. GREEN after the fix: only MUSIC + CULTURE come back.
 *
 * @see .specs/HOS-96-multi-select-quick-filter-chips/spec.md — US-9, AC5
 */
import { EventCategoryEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture — one event per category, shaped to satisfy EventPublicSchema.
// Field values/lengths mirror the already-validated fixture in
// `test/schema-validation/event-getById-schema.test.ts` (GAP-031).
// ---------------------------------------------------------------------------

const VALID_MEDIA = {
    featuredImage: { url: 'https://example.com/event.jpg', moderationState: 'APPROVED' }
};

function makeEvent(id: string, slug: string, category: EventCategoryEnum) {
    return {
        id,
        slug,
        name: `Test Event ${slug}`,
        category,
        summary: 'A test event summary that is long enough for validation.',
        description:
            'This is a sufficiently long event description. It needs to exceed the 50 character minimum requirement set in the Zod schema for event descriptions.',
        isFeatured: false,
        media: VALID_MEDIA,
        date: { start: '2024-06-01T00:00:00.000Z', end: '2024-06-02T00:00:00.000Z' },
        pricing: { isFree: false, price: 50, currency: 'ARS' },
        locationId: '22222222-2222-4222-8222-222222222222',
        organizerId: '33333333-3333-4333-8333-333333333333',
        visibility: 'PUBLIC',
        seo: {
            title: 'Test Event SEO Title Long Enough Here',
            description:
                'This is a long enough SEO description for the test event. It must be at least 70 characters long to pass validation.'
        },
        tags: []
    };
}

const EVENT_FIXTURE = [
    makeEvent('11111111-1111-4111-8111-111111111111', 'music-event', EventCategoryEnum.MUSIC),
    makeEvent('22222222-2222-4222-8222-222222222222', 'culture-event', EventCategoryEnum.CULTURE),
    makeEvent('33333333-3333-4333-8333-333333333333', 'sports-event', EventCategoryEnum.SPORTS)
];

/**
 * Test oracle: reproduces the union-vs-singular-vs-unfiltered precedence
 * the real `EventModel` WHERE branch implements (T-004), independently of
 * production code, so this file can assert on genuine filtered content
 * without needing a real database connection.
 */
function searchByCategoryOracle(query: { categories?: string[]; category?: string }) {
    const activeCategories =
        Array.isArray(query.categories) && query.categories.length > 0
            ? query.categories
            : query.category
              ? [query.category]
              : undefined;

    const items = activeCategories
        ? EVENT_FIXTURE.filter((e) => activeCategories.includes(e.category))
        : EVENT_FIXTURE;

    return { data: { items, total: items.length } };
}

// ---------------------------------------------------------------------------
// Module mocks — file-level override of the global EventService mock
// (which has no `search` method at all). Mirrors the established pattern in
// `apps/api/test/routes/post/admin-trend.test.ts` and
// `apps/api/test/integration/event/admin-search-filters.test.ts`.
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        EventService: vi.fn().mockImplementation(function () {
            return {
                search: async (_actor: Actor, query: Record<string, unknown>) =>
                    searchByCategoryOracle(query),
                count: async (_actor: Actor, query: Record<string, unknown>) => {
                    const result = searchByCategoryOracle(query);
                    return { data: result.data.total };
                }
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

describe('GET /api/v1/public/events — ?categories=A,B regression (HOS-96 T-020)', () => {
    let app: ReturnType<typeof initApp>;
    const BASE = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns events of BOTH categories, count > 0, when given ?categories=MUSIC,CULTURE', async () => {
        // Arrange — nothing to arrange, the mocked service applies the real
        // union semantics against EVENT_FIXTURE.

        // Act
        const res = await app.request(`${BASE}?categories=MUSIC,CULTURE`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);

        const categories = (body.data.items as Array<{ category: string }>).map(
            (item) => item.category
        );
        expect(body.data.items.length).toBeGreaterThan(0);
        expect(categories).toContain('MUSIC');
        expect(categories).toContain('CULTURE');
    });

    it('does NOT return the exact failure mode being regressed: an unfiltered/mismatched set', async () => {
        // The shipped bug matched EVERYTHING (including SPORTS) instead of
        // the union of MUSIC and CULTURE. Assert SPORTS is explicitly absent.
        const res = await app.request(`${BASE}?categories=MUSIC,CULTURE`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const categories = (body.data.items as Array<{ category: string }>).map(
            (item) => item.category
        );

        expect(categories).not.toContain('SPORTS');
        expect(body.data.items).toHaveLength(2);
    });

    it('the response is not an error response', async () => {
        const res = await app.request(`${BASE}?categories=MUSIC,CULTURE`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        const body = await res.json();
        expect(body).not.toHaveProperty('error');
        expect(body.success).toBe(true);
    });
});
