/**
 * Backward-compatibility + edge-case suite for the blog/post `category`/`categories`
 * facet (HOS-96 T-021, T-022).
 *
 * T-021 — locks in that the pre-existing singular `?category=` filter keeps
 * working standalone, and that when both `category` and `categories` are
 * present, the array wins (mirrors the precedence rule proven at the model
 * layer in `packages/db/test/models/post.model.categories.test.ts`).
 *
 * T-022 — locks in the array-param edge-case matrix at the API layer for
 * this facet: empty param resolves to "unfiltered" (not `IN ()`), selecting
 * every enum value is equivalent to no filter at all, and an invalid enum
 * member is rejected with a strict 400 before ever reaching the service
 * (OQ-3).
 *
 * Uses the same file-level `PostService` mock + fixture/oracle pattern as
 * `categories-regression.test.ts` (T-020) so this file can assert on real
 * filtered content without a database connection.
 *
 * @see .specs/HOS-96-multi-select-quick-filter-chips/spec.md — US-10, US-11
 */
import { PostCategoryEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture — one post per PostCategoryEnum member, shaped to satisfy
// PostPublicSchema (same minimal shape validated in T-020's regression file
// and in test/schema-validation/post-getById-schema.test.ts).
// ---------------------------------------------------------------------------

const VALID_MEDIA = {
    featuredImage: { url: 'https://example.com/image.jpg', moderationState: 'APPROVED' }
};

const VALID_SEO = {
    title: 'Test Post SEO Title Long Enough Here',
    description:
        'This is a long enough SEO description for the test post. It must be at least 70 characters long to pass validation.'
};

function makePost(id: string, slug: string, category: PostCategoryEnum) {
    return {
        id,
        slug,
        title: `Test Post ${slug}`,
        summary: 'A summary that is long enough for validation testing purposes.',
        content:
            'This is a very long content string that needs to be at least 100 characters to pass the Zod schema validation. Adding more text to make sure we exceed the minimum content length requirement.',
        category,
        authorId: '22222222-2222-4222-8222-222222222222',
        media: VALID_MEDIA,
        isFeatured: false,
        isFeaturedInWebsite: false,
        isNews: false,
        likes: 0,
        comments: 0,
        shares: 0,
        publishedAt: '2024-01-15T00:00:00.000Z',
        readingTimeMinutes: 5,
        visibility: 'PUBLIC',
        seo: VALID_SEO,
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
    };
}

/** One fixture item per PostCategoryEnum member — used for the all-selected == unfiltered proof. */
const ALL_CATEGORIES = Object.values(PostCategoryEnum);
const POST_FIXTURE = ALL_CATEGORIES.map((category, index) =>
    makePost(
        `${String(index + 1).padStart(2, '0')}111111-1111-4111-8111-111111111111`,
        `post-${category.toLowerCase()}`,
        category
    )
);

/**
 * Test oracle mirroring the real PostModel WHERE-branch precedence (T-005):
 * `categories` (non-empty array) wins over singular `category`; singular
 * alone still filters; absence of both means unfiltered (NOT `IN ()`).
 */
function searchByCategoryOracle(query: { categories?: string[]; category?: string }) {
    const activeCategories =
        Array.isArray(query.categories) && query.categories.length > 0
            ? query.categories
            : query.category
              ? [query.category]
              : undefined;

    const items = activeCategories
        ? POST_FIXTURE.filter((p) => activeCategories.includes(p.category))
        : POST_FIXTURE;

    return { data: { items, total: items.length } };
}

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        PostService: vi.fn().mockImplementation(function () {
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

describe('GET /api/v1/public/posts — category/categories backward compat + edge cases (HOS-96 T-021/T-022)', () => {
    let app: ReturnType<typeof initApp>;
    const BASE = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // T-021 — singular `category` still works standalone (US-10)
    // -----------------------------------------------------------------------

    describe('singular `category` still works standalone', () => {
        it('?category=CULTURE returns only CULTURE posts', async () => {
            const res = await app.request(`${BASE}?category=CULTURE`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const categories = (body.data.items as Array<{ category: string }>).map(
                (item) => item.category
            );
            expect(categories.length).toBeGreaterThan(0);
            expect(categories.every((c) => c === 'CULTURE')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // T-021 — both present: array wins (US-10)
    // -----------------------------------------------------------------------

    describe('both `category` and `categories` present: array wins', () => {
        it('?category=CULTURE&categories=GASTRONOMY,NATURE returns GASTRONOMY+NATURE, NOT CULTURE', async () => {
            const res = await app.request(`${BASE}?category=CULTURE&categories=GASTRONOMY,NATURE`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const categories = (body.data.items as Array<{ category: string }>).map(
                (item) => item.category
            );
            expect(categories).toContain('GASTRONOMY');
            expect(categories).toContain('NATURE');
            expect(categories).not.toContain('CULTURE');
        });
    });

    // -----------------------------------------------------------------------
    // T-022 — empty array param resolves to unfiltered, not IN ()
    // -----------------------------------------------------------------------

    describe('empty ?categories= resolves to unfiltered', () => {
        it('?categories= returns the full fixture set, not an empty result', async () => {
            const res = await app.request(`${BASE}?categories=`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.items).toHaveLength(POST_FIXTURE.length);
        });
    });

    // -----------------------------------------------------------------------
    // T-022 — selecting every category is equivalent to no filter
    // -----------------------------------------------------------------------

    describe('all-values-selected == fully unfiltered result set', () => {
        it('?categories=<every enum value> returns the same set as no filter at all', async () => {
            const [allSelected, unfiltered] = await Promise.all([
                app.request(`${BASE}?categories=${ALL_CATEGORIES.join(',')}`, {
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
    // T-022 — invalid enum member -> strict 400 (OQ-3)
    // -----------------------------------------------------------------------

    describe('invalid category member is rejected with 400', () => {
        it('?categories=CULTURE,NOT_A_CATEGORY returns 400 before reaching the service', async () => {
            const res = await app.request(`${BASE}?categories=CULTURE,NOT_A_CATEGORY`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(400);
        });
    });
});
