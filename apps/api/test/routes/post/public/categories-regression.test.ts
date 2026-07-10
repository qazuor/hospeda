/**
 * Regression suite for the shipped `?category=A,B` latent bug (HOS-96 T-020).
 *
 * Before T-003 (schema) + T-005 (model) + T-007 (service forwarding) landed,
 * `PostSearchHttpSchema` had no `categories` array field. Because the schema
 * is a plain (non-strict) `z.object`, an unknown `?categories=CULTURE,GASTRONOMY`
 * query param was silently STRIPPED before ever reaching the service — the
 * blog sidebar already serialized this shape, so real users hit a listing
 * that silently ignored their multi-category selection and matched EVERY
 * post instead of the union of the selected categories.
 *
 * This suite proves the fix end-to-end through a real HTTP request: schema
 * parses `?categories=CULTURE,GASTRONOMY` into an array → the route forwards
 * it to `PostService.search()` → the (mocked) service applies the exact same
 * union semantics the real `PostModel` WHERE branch implements (see
 * `packages/db/test/models/post.model.categories.test.ts` for the real-model
 * proof of that branch) → the response contains posts of BOTH categories and
 * excludes the third fixture category entirely.
 *
 * RED before the fix: `categories` never reaches the mocked service (it is
 * stripped at the schema boundary), so the mock's fallback path returns the
 * FULL unfiltered fixture — which fails the "does not include NATURE"
 * assertion below. GREEN after the fix: only CULTURE + GASTRONOMY come back.
 *
 * @see .specs/HOS-96-multi-select-quick-filter-chips/spec.md — US-9, AC5
 */
import { PostCategoryEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture — one post per category, shaped to satisfy PostPublicSchema.
// Field values/lengths mirror the already-validated fixture in
// `test/schema-validation/post-getById-schema.test.ts` (GAP-031).
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

const POST_FIXTURE = [
    makePost('11111111-1111-4111-8111-111111111111', 'culture-post', PostCategoryEnum.CULTURE),
    makePost(
        '22222222-2222-4222-8222-222222222222',
        'gastronomy-post',
        PostCategoryEnum.GASTRONOMY
    ),
    makePost('33333333-3333-4333-8333-333333333333', 'nature-post', PostCategoryEnum.NATURE)
];

/**
 * Test oracle: reproduces the union-vs-singular-vs-unfiltered precedence
 * the real `PostModel` WHERE branch implements (T-005), independently of
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

describe('GET /api/v1/public/posts — ?categories=A,B regression (HOS-96 T-020)', () => {
    let app: ReturnType<typeof initApp>;
    const BASE = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns posts of BOTH categories, count > 0, when given ?categories=CULTURE,GASTRONOMY', async () => {
        // Act
        const res = await app.request(`${BASE}?categories=CULTURE,GASTRONOMY`, {
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
        expect(categories).toContain('CULTURE');
        expect(categories).toContain('GASTRONOMY');
    });

    it('does NOT return the exact failure mode being regressed: an unfiltered/mismatched set', async () => {
        const res = await app.request(`${BASE}?categories=CULTURE,GASTRONOMY`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const categories = (body.data.items as Array<{ category: string }>).map(
            (item) => item.category
        );

        expect(categories).not.toContain('NATURE');
        expect(body.data.items).toHaveLength(2);
    });

    it('the response is not an error response', async () => {
        const res = await app.request(`${BASE}?categories=CULTURE,GASTRONOMY`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        const body = await res.json();
        expect(body).not.toHaveProperty('error');
        expect(body.success).toBe(true);
    });
});
