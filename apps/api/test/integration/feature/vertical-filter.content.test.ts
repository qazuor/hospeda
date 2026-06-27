/**
 * Content-level integration test for the `?applicableVertical=` filter on
 * GET /api/v1/public/features (SPEC-266 T-012).
 *
 * Requires a real seeded database. Run against the worktree DB:
 *
 *   HOSPEDA_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5436/worktree_hospeda2 \
 *     pnpm --filter hospeda-api test:e2e:single \
 *     --reporter=verbose test/integration/feature/vertical-filter.content.test.ts
 *
 * Three assertions validated here:
 *  1. GET ?applicableVertical=experience → includes `kid_friendly` and
 *     `disability_accessible` (shared-core); excludes `river_front` and
 *     `adults_only_area` (accommodation-only).
 *  2. GET (no filter) → response items must NOT have a `name` field
 *     (T-001 dropped the `name` column; only `slug` must be present).
 *  3. The total with experience filter is strictly fewer than the unfiltered total.
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

/** Minimal shape we assert on for each feature item. */
interface FeatureItem {
    slug: string;
    name?: unknown; // must be absent after T-001
    [key: string]: unknown;
}

const BASE = '/api/v1/public/features';

describe('GET /api/v1/public/features — vertical filter content assertions (SPEC-266 T-012)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        await initializeDatabase();
        app = initApp();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    it('(1) experience filter — includes kid_friendly and disability_accessible', async () => {
        const res = await app.request(`${BASE}?applicableVertical=experience&pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<FeatureItem>;
        expect(body.success).toBe(true);

        const slugs = body.data.items.map((i) => i.slug);

        // Experience-only feature — must be present
        expect(slugs).toContain('kid_friendly');
        // Shared-core feature (accommodation + gastronomy + experience) — must be present
        expect(slugs).toContain('disability_accessible');
    });

    it('(1) experience filter — excludes accommodation-only features', async () => {
        const res = await app.request(`${BASE}?applicableVertical=experience&pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<FeatureItem>;
        const slugs = body.data.items.map((i) => i.slug);

        // Accommodation-only features — must NOT appear in experience results
        expect(slugs).not.toContain('river_front');
        expect(slugs).not.toContain('adults_only_area');
    });

    it('(2) no filter — response items must NOT have a `name` field (T-001 column drop)', async () => {
        const res = await app.request(`${BASE}?pageSize=100`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);

        const body = (await res.json()) as ListResponse<FeatureItem>;
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

    it('(3) experience filter returns fewer items than the unfiltered catalog', async () => {
        const [resAll, resExperience] = await Promise.all([
            app.request(`${BASE}?pageSize=1`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            }),
            app.request(`${BASE}?applicableVertical=experience&pageSize=1`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            })
        ]);

        expect(resAll.status).toBe(200);
        expect(resExperience.status).toBe(200);

        const bodyAll = (await resAll.json()) as ListResponse<FeatureItem>;
        const bodyExperience = (await resExperience.json()) as ListResponse<FeatureItem>;

        const totalAll = bodyAll.data.pagination.total;
        const totalExperience = bodyExperience.data.pagination.total;

        expect(totalExperience).toBeGreaterThan(0);
        expect(totalExperience).toBeLessThan(totalAll);
    });
});
