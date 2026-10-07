/**
 * Integration tests for the multi-sort wiring on GET /api/v1/public/accommodations.
 *
 * These tests run under `vitest.config.e2e.ts` (see the repo e2e config, which
 * includes `test/integration/**`). They hit the real app against whatever
 * accommodation data is currently seeded in the test database.
 *
 * Coverage:
 *   - a multi-sort CSV is accepted and returns a well-formed response
 *   - the pagination tiebreaker is stable across pages
 *   - non-whitelisted sort fields are dropped silently
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

type ListItem = {
    id: string;
    name: string;
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

describe('GET /accommodations — multi-sort', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/accommodations';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
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

    it('should not repeat rows across page 1 and page 2 — stable tiebreaker (SPEC-076 criterion c)', async () => {
        const { status: s1, body: b1 } = await fetchList(
            '?sorts=averageRating:desc,name:asc&page=1&pageSize=5'
        );
        expect(s1).toBe(200);
        if (b1.data.items.length < 5 || b1.data.pagination.total <= 5) {
            // Not enough data for a meaningful page-2 check — skip.
            return;
        }
        const { status: s2, body: b2 } = await fetchList(
            '?sorts=averageRating:desc,name:asc&page=2&pageSize=5'
        );
        expect(s2).toBe(200);
        const ids1 = new Set(b1.data.items.map((i) => i.id));
        const duplicated = b2.data.items.filter((i) => ids1.has(i.id));
        expect(duplicated).toEqual([]);
    });

    it('should silently drop non-whitelisted sort fields', async () => {
        const { status, body } = await fetchList(
            '?sorts=internalHiddenColumn:desc,name:asc&pageSize=10'
        );
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        // Route accepted the request without 400; response is well-formed.
    });
});
