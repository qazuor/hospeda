/**
 * Integration tests for the SPEC-076 multi-sort + forced featuredFirst wiring on
 * GET /api/v1/public/accommodations.
 *
 * These tests hit the real app against accommodations seeded in `beforeEach`
 * (3 featured + 4 non-featured, with distinct ratings), so every ordering
 * assertion below runs against real rows instead of short-circuiting.
 *
 * Coverage vs spec acceptance criteria:
 *   (a) featured items come first            → `should place featured items before non-featured`
 *   (b) secondary sort order is applied      → `should apply the secondary sort key within each featured group`
 *   (c) pagination tiebreaker is stable      → `should not repeat rows across page 1 and page 2`
 *   (d) forced featuredFirst (opt-out denied)→ `featuredFirst=false is ignored server-side`
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { seedPublicAccommodation } from '../helpers/seed-public-accommodation';

type ListItem = {
    id: string;
    name: string;
    isFeatured: boolean;
    averageRating: number;
};

type ListResponse = {
    success: boolean;
    data: {
        items: ListItem[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    };
};

describe('GET /accommodations — SPEC-076 multi-sort + forced featuredFirst', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/accommodations';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        const first = await seedPublicAccommodation({
            name: 'Sort Fixture 0',
            isFeatured: true,
            averageRating: 4.5
        });
        const shared = { ownerId: first.ownerId, destinationId: first.destinationId };
        const fixtures = [
            { isFeatured: true, averageRating: 3.5 },
            { isFeatured: true, averageRating: 4.9 },
            { isFeatured: false, averageRating: 4.8 },
            { isFeatured: false, averageRating: 2.1 },
            { isFeatured: false, averageRating: 3.9 },
            { isFeatured: false, averageRating: 1.2 }
        ];
        for (const [index, fixture] of fixtures.entries()) {
            await seedPublicAccommodation({
                ...shared,
                ...fixture,
                name: `Sort Fixture ${index + 1}`
            });
        }
    });

    async function fetchList(query: string): Promise<{ status: number; body: ListResponse }> {
        const res = await app.request(`${baseUrl}${query}`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        const body = (await res.json()) as ListResponse;
        return { status: res.status, body };
    }

    it('should accept a multi-sort CSV and return a well-formed response', async () => {
        const { status, body } = await fetchList('?sorts=averageRating:desc,name:asc&pageSize=10');
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.pagination).toHaveProperty('total');
    });

    it('should place featured items before non-featured (SPEC-076 criterion a)', async () => {
        const { status, body } = await fetchList('?sorts=averageRating:desc,name:asc&pageSize=50');
        expect(status).toBe(200);
        const items = body.data.items;
        expect(items).toHaveLength(7);
        // Find the first non-featured item. Every item BEFORE it must also be
        // featured; every item AFTER it must be non-featured.
        const firstNonFeaturedIdx = items.findIndex((i) => !i.isFeatured);
        expect(firstNonFeaturedIdx).toBe(3);
        const pre = items.slice(0, firstNonFeaturedIdx);
        const post = items.slice(firstNonFeaturedIdx);
        expect(pre.every((i) => i.isFeatured)).toBe(true);
        expect(post.every((i) => !i.isFeatured)).toBe(true);
    });

    it('should apply the secondary sort key within each featured group (SPEC-076 criterion b)', async () => {
        const { status, body } = await fetchList('?sorts=averageRating:desc,name:asc&pageSize=50');
        expect(status).toBe(200);
        const items = body.data.items;
        expect(items).toHaveLength(7);

        // Partition by isFeatured group; within each group verify that
        // averageRating is non-increasing (DESC).
        const featured = items.filter((i) => i.isFeatured);
        const nonFeatured = items.filter((i) => !i.isFeatured);
        expect(featured).toHaveLength(3);
        expect(nonFeatured).toHaveLength(4);
        for (const group of [featured, nonFeatured]) {
            const ratings = group.map((i) => i.averageRating);
            expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
        }
    });

    it('should not repeat rows across page 1 and page 2 — stable tiebreaker (SPEC-076 criterion c)', async () => {
        const { status: s1, body: b1 } = await fetchList(
            '?sorts=averageRating:desc,name:asc&page=1&pageSize=5'
        );
        expect(s1).toBe(200);
        expect(b1.data.items).toHaveLength(5);
        expect(b1.data.pagination.total).toBe(7);
        const { status: s2, body: b2 } = await fetchList(
            '?sorts=averageRating:desc,name:asc&page=2&pageSize=5'
        );
        expect(s2).toBe(200);
        expect(b2.data.items).toHaveLength(2);
        const ids1 = new Set(b1.data.items.map((i) => i.id));
        const duplicated = b2.data.items.filter((i) => ids1.has(i.id));
        expect(duplicated).toEqual([]);
    });

    it('should ignore a client-supplied featuredFirst=false and still return featured items first (SPEC-076 criterion d)', async () => {
        const { status, body } = await fetchList('?featuredFirst=false&pageSize=50');
        expect(status).toBe(200);
        const items = body.data.items;
        expect(items).toHaveLength(7);
        // The route forces `featuredFirst: true` server-side — the ordering
        // MUST still put featured first.
        const firstNonFeaturedIdx = items.findIndex((i) => !i.isFeatured);
        expect(firstNonFeaturedIdx).toBe(3);
        const pre = items.slice(0, firstNonFeaturedIdx);
        expect(pre.every((i) => i.isFeatured)).toBe(true);
    });

    it('should silently drop non-whitelisted sort fields', async () => {
        const { status, body } = await fetchList(
            '?sorts=internalHiddenColumn:desc,name:asc&pageSize=10'
        );
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        // Route accepted the request without 400; response is well-formed.
    });

    it('should reject a non-literal featuredFirst value (strict boolean)', async () => {
        const res = await app.request(`${baseUrl}?featuredFirst=garbage`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });
});
