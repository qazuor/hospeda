/**
 * Content-level integration test for the `?applicableVertical=` filter on
 * GET /api/v1/public/amenities (SPEC-266 T-012).
 *
 * Requires a real seeded database. Run against the worktree DB:
 *
 *   HOSPEDA_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5436/worktree_hospeda2 \
 *     pnpm --filter hospeda-api test:e2e:single \
 *     --reporter=verbose test/integration/amenity/vertical-filter.content.test.ts
 *
 * Three assertions validated here:
 *  1. GET ?applicableVertical=gastronomy → includes `delivery` and `wifi`,
 *     excludes `heating` and `balcony` (accommodation-only).
 *  2. GET (no filter) → all amenities returned; response items must NOT have
 *     a `name` field (T-001 dropped the `name` column; only `slug` must be present).
 *  3. The total with gastronomy filter is strictly fewer than the unfiltered total
 *     (confirms the filter actually reduces the result set).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';
import { closeDatabase, initializeDatabase } from '../../../src/utils/database.js';
import { validateApiEnv } from '../../../src/utils/env.js';

/** Response shape returned by createPublicListRoute list handlers. */
interface ListResponse<T> {
    success: boolean;
    data: {
        items: T[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/** Minimal shape we assert on for each amenity item. */
interface AmenityItem {
    slug: string;
    name?: unknown; // must be absent after T-001
    [key: string]: unknown;
}

const BASE = '/api/v1/public/amenities';

describe('GET /api/v1/public/amenities — vertical filter content assertions (SPEC-266 T-012)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        await initializeDatabase();
        app = initApp();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    it('(1) gastronomy filter — includes delivery and wifi', async () => {
        const res = await app.request(`${BASE}?applicableVertical=gastronomy&pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<AmenityItem>;
        expect(body.success).toBe(true);

        const slugs = body.data.items.map((i) => i.slug);

        // Gastronomy-only amenity — must be present
        expect(slugs).toContain('delivery');
        // Shared-core amenity (accommodation + gastronomy + experience) — must be present
        expect(slugs).toContain('wifi');
    });

    it('(1) gastronomy filter — excludes accommodation-only amenities', async () => {
        const res = await app.request(`${BASE}?applicableVertical=gastronomy&pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<AmenityItem>;
        const slugs = body.data.items.map((i) => i.slug);

        // Accommodation-only amenities — must NOT appear in gastronomy results
        expect(slugs).not.toContain('heating');
        expect(slugs).not.toContain('balcony');
    });

    it('(2) no filter — response items must NOT have a `name` field (T-001 column drop)', async () => {
        const res = await app.request(`${BASE}?pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<AmenityItem>;
        expect(body.success).toBe(true);
        expect(body.data.items.length).toBeGreaterThan(0);

        // Every item must have a slug
        for (const item of body.data.items) {
            expect(typeof item.slug).toBe('string');
            expect(item.slug.length).toBeGreaterThan(0);
        }

        // No item must carry a `name` field — the column was dropped in T-001
        const itemsWithName = body.data.items.filter((i) => 'name' in i && i.name !== undefined);
        expect(itemsWithName).toHaveLength(0);
    });

    it('(3) gastronomy filter returns fewer items than the unfiltered catalog', async () => {
        const [resAll, resGastronomy] = await Promise.all([
            app.request(`${BASE}?pageSize=1`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            }),
            app.request(`${BASE}?applicableVertical=gastronomy&pageSize=1`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            })
        ]);

        expect(resAll.status).toBe(200);
        expect(resGastronomy.status).toBe(200);

        const bodyAll = (await resAll.json()) as ListResponse<AmenityItem>;
        const bodyGastronomy = (await resGastronomy.json()) as ListResponse<AmenityItem>;

        const totalAll = bodyAll.data.pagination.total;
        const totalGastronomy = bodyGastronomy.data.pagination.total;

        expect(totalGastronomy).toBeGreaterThan(0);
        expect(totalGastronomy).toBeLessThan(totalAll);
    });
});
