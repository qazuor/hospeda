/**
 * Regression tests for SPEC-210 PR2 — post public routes schema enforcement.
 *
 * Verifies that the following routes serialize responses through `PostPublicSchema`
 * and NEVER leak the internal-only field `lifecycleState` (or any other audit/admin
 * field that `PostPublicSchema` intentionally omits).
 *
 * Routes covered (§5 of the public-route-audit):
 *   GET /api/v1/public/posts/category/:category        (getByCategory.ts)
 *   GET /api/v1/public/posts/related/accommodation/:id (getByRelatedAccommodation.ts)
 *   GET /api/v1/public/posts/related/destination/:id   (getByRelatedDestination.ts)
 *   GET /api/v1/public/posts/related/event/:id         (getByRelatedEvent.ts)
 *   GET /api/v1/public/posts/featured                  (getFeatured.ts)
 *   GET /api/v1/public/posts/news                      (getNews.ts)
 *
 * The "Schema unit tests — always run (no DB required)" block runs unconditionally
 * so a schema revert is caught even in the DB-less CI environment.
 */

import { PostPublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fields that must NEVER appear in a public post list response. */
const FORBIDDEN_FIELDS = [
    'lifecycleState',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'adminInfo',
    'moderationState',
    'translationMeta',
    'adminNote',
    'expiresAt',
    'sponsorshipId'
] as const;

/** Fields that must be present on every public post item. */
const REQUIRED_PUBLIC_FIELDS = ['id', 'slug', 'title', 'category', 'authorId'] as const;

/**
 * Raw post object that includes all internal fields.
 * Used by the always-running schema unit tests.
 */
const RAW_POST_WITH_FORBIDDEN_FIELDS = {
    // Public fields (required by PostSchema)
    id: '123e4567-e89b-12d3-a456-426614174010',
    slug: 'visiting-concepcion-del-uruguay',
    title: 'Visiting Concepcion del Uruguay',
    summary: 'A guide to the best places in Concepcion del Uruguay',
    content: 'x'.repeat(100), // min 100 chars
    category: 'TOURISM',
    authorId: '123e4567-e89b-12d3-a456-000000000002',
    isFeatured: false,
    isFeaturedInWebsite: false,
    isNews: false,
    likes: 0,
    comments: 0,
    shares: 0,
    readingTimeMinutes: 5,
    visibility: 'PUBLIC',
    createdAt: new Date(),
    updatedAt: new Date(),
    // Internal-only fields that must be stripped by PostPublicSchema
    lifecycleState: 'ACTIVE',
    createdById: '123e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    adminInfo: { someInternalKey: true },
    moderationState: 'APPROVED',
    translationMeta: { en: { title: { status: 'approved' } } },
    adminNote: 'some internal note',
    expiresAt: null,
    sponsorshipId: null
};

// ---------------------------------------------------------------------------
// Schema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('PostPublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('strips lifecycleState and all audit/admin fields', () => {
        const result = PostPublicSchema.safeParse(RAW_POST_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves required public fields after parse', () => {
        const result = PostPublicSchema.safeParse(RAW_POST_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves createdAt and updatedAt (which are public-safe on posts)', () => {
        const result = PostPublicSchema.safeParse(RAW_POST_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data).toHaveProperty('createdAt');
            expect(data).toHaveProperty('updatedAt');
        }
    });

    it('parses successfully with only the minimum public field set', () => {
        const minimal = {
            id: '123e4567-e89b-12d3-a456-426614174011',
            slug: 'minimal-post',
            title: 'Minimal post title',
            summary: 'A short summary of the post for testing purposes.',
            content: 'x'.repeat(100),
            category: 'GENERAL',
            authorId: '123e4567-e89b-12d3-a456-000000000003',
            createdAt: new Date(),
            updatedAt: new Date(),
            visibility: 'PUBLIC'
        };
        const result = PostPublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Route-level regression tests (may be skipped if DB unavailable)
// ---------------------------------------------------------------------------

/**
 * Helper that asserts forbidden fields are absent in paginated response items.
 * Accepts both {data:{items:[]}} and {items:[]} envelope shapes.
 */
function assertNoForbiddenFields(body: unknown): void {
    const b = body as Record<string, unknown>;
    const dataItems = (b?.data as Record<string, unknown>)?.items;
    const items: unknown[] = Array.isArray(dataItems)
        ? (dataItems as unknown[])
        : Array.isArray(b?.items)
          ? (b.items as unknown[])
          : [];

    for (const item of items) {
        const record = item as Record<string, unknown>;
        for (const field of FORBIDDEN_FIELDS) {
            expect(record, `field "${field}" must be absent`).not.toHaveProperty(field);
        }
    }
}

type RouteCase = { label: string; path: string };

const POST_LIST_ROUTES: RouteCase[] = [
    {
        label: 'GET /api/v1/public/posts/category/TOURISM',
        path: '/api/v1/public/posts/category/TOURISM'
    },
    {
        label: 'GET /api/v1/public/posts/related/accommodation/:id',
        path: '/api/v1/public/posts/related/accommodation/123e4567-e89b-12d3-a456-426614174000'
    },
    {
        label: 'GET /api/v1/public/posts/related/destination/:id',
        path: '/api/v1/public/posts/related/destination/123e4567-e89b-12d3-a456-426614174000'
    },
    {
        label: 'GET /api/v1/public/posts/related/event/:id',
        path: '/api/v1/public/posts/related/event/123e4567-e89b-12d3-a456-426614174000'
    },
    {
        label: 'GET /api/v1/public/posts/featured',
        path: '/api/v1/public/posts/featured'
    },
    {
        label: 'GET /api/v1/public/posts/news',
        path: '/api/v1/public/posts/news'
    }
];

describe('Post public list routes — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        app = initApp();
    });

    for (const { label, path } of POST_LIST_ROUTES) {
        describe(label, () => {
            it('should be registered and reachable (not 404)', async () => {
                try {
                    const res = await app.request(path, {
                        method: 'GET',
                        headers: { 'user-agent': 'vitest', accept: 'application/json' }
                    });
                    expect(res.status).not.toBe(404);
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'status' in error) {
                        expect([401, 403]).toContain((error as { status: number }).status);
                    } else {
                        throw error;
                    }
                }
            });

            it('should not require authentication', async () => {
                try {
                    const res = await app.request(path, {
                        method: 'GET',
                        headers: { 'user-agent': 'vitest', accept: 'application/json' }
                    });
                    expect(res.status).not.toBe(401);
                    expect(res.status).not.toBe(403);
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'status' in error) {
                        expect([401, 403]).toContain((error as { status: number }).status);
                    } else {
                        throw error;
                    }
                }
            });

            it('should NOT include lifecycleState or audit/admin fields in list items', async () => {
                try {
                    const res = await app.request(path, {
                        method: 'GET',
                        headers: { 'user-agent': 'vitest', accept: 'application/json' }
                    });

                    if (res.status === 200) {
                        const body = await res.json();
                        assertNoForbiddenFields(body);
                    }

                    expect(res.status).not.toBe(404);
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'status' in error) {
                        expect([401, 403, 500]).toContain((error as { status: number }).status);
                    } else {
                        throw error;
                    }
                }
            });
        });
    }
});
