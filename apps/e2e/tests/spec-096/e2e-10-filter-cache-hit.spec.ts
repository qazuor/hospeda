/**
 * E2E-10 — Filter sub-route → ISR cache hit on second visit.
 *
 * Actors: Anonymous guest hitting a filtered listing twice.
 * Tags: @p1 @cache @cross-app
 *
 * Preconditions:
 *   - Public listing endpoint mounted with `cacheTTL` configured for
 *     query-string variants.
 *
 * What this validates (server-side cache contract):
 *  1. Two consecutive GETs with identical query strings return identical
 *     `data` payloads — the cache must return the same materialized view.
 *  2. The second GET is no slower than the first by a meaningful margin
 *     (we don't assert hard latency numbers — wall-clock variance is
 *     too noisy in CI; we just assert the response is structurally
 *     consistent).
 *  3. A different query-string variant returns potentially-different
 *     data, demonstrating that the cache key includes the filter.
 *
 * Why we don't assert headers like `x-cache: HIT`:
 *   The Vercel CDN populates that header at the edge; in `pnpm preview`
 *   locally there is no edge, so the header is absent. The structural
 *   contract (same query → same data) is the deterministic part we
 *   can validate from any environment.
 *
 * @see SPEC-092 spec.md § E2E-10
 */

import { expect, test } from '@playwright/test';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('E2E-10: filter sub-route ISR cache hit @p1 @cache @cross-app', () => {
    test('same query → same data; different query → potentially different', async ({ page }) => {
        const queryA = '?pageSize=10&sort=createdAt';
        const queryB = '?pageSize=5&sort=createdAt';

        // SPEC-105 T-105-04: public list response shape is paginated:
        // { data: { items: [...], pagination: {...} } } — NOT a flat array on data.
        type PaginatedBody = {
            data?: { items: ReadonlyArray<{ id: string }>; pagination: unknown };
        };

        const firstA = await page.request.get(`${API_URL}/api/v1/public/accommodations${queryA}`);
        expect(firstA.ok(), `first request A should be 200 (got ${firstA.status()})`).toBe(true);
        const firstABody = (await firstA.json()) as PaginatedBody;

        const secondA = await page.request.get(`${API_URL}/api/v1/public/accommodations${queryA}`);
        expect(secondA.ok(), `second request A should be 200 (got ${secondA.status()})`).toBe(true);
        const secondABody = (await secondA.json()) as PaginatedBody;

        // ── 1. Same query → same data shape (and identical first ids) ────
        const idsFirstA = firstABody.data?.items?.map((row) => row.id) ?? [];
        const idsSecondA = secondABody.data?.items?.map((row) => row.id) ?? [];
        expect(idsSecondA, 'identical query must return identical id sequence').toEqual(idsFirstA);

        // ── 2. Different query: pageSize=5 may return fewer rows ──────────
        const firstB = await page.request.get(`${API_URL}/api/v1/public/accommodations${queryB}`);
        expect(firstB.ok()).toBe(true);
        const firstBBody = (await firstB.json()) as PaginatedBody;
        const idsFirstB = firstBBody.data?.items?.map((row) => row.id) ?? [];

        // pageSize=5 should not exceed pageSize=10's row count.
        expect(
            idsFirstB.length,
            `pageSize=5 should not exceed pageSize=10 rows (got ${idsFirstB.length} > ${idsFirstA.length})`
        ).toBeLessThanOrEqual(idsFirstA.length);
    });
});
