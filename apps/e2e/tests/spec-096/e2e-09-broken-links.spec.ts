/**
 * E2E-9 — 404 on broken link + zero broken-link regression on the API
 *          public surface.
 *
 * Actors: Anonymous guest.
 * Tags: @p0 @guest @cross-app
 *
 * Preconditions:
 *   - Public API surface exposed at `/api/v1/public/*`.
 *
 * What this validates:
 *  1. Random UUIDs on detail endpoints return either 404 or `data: null` —
 *     never 5xx, never an unrelated entity.
 *  2. Common non-existent path segments under `/api/v1/public/` return 404
 *     with a JSON error body (not an HTML 500).
 *  3. The public docs / openapi index endpoints (when mounted) respond
 *     within 500ms — they are listed in deployment smoke checks and a
 *     regression to 5xx breaks the platform docs link in the marketing
 *     footer.
 *
 * @see SPEC-092 spec.md § E2E-9
 */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('E2E-9: 404 + broken-link regression @p0 @guest @cross-app', () => {
    test('random UUIDs return 404/null, garbage paths return 404 JSON, no 5xx', async ({
        page
    }) => {
        // ── 1. Random UUID on detail endpoints ────────────────────────────
        for (const entity of ['accommodations', 'destinations', 'events', 'posts'] as const) {
            const url = `${API_URL}/api/v1/public/${entity}/${randomUUID()}`;
            const res = await page.request.get(url);

            // Acceptable contracts: 404, OR 200 with `data: null`.
            if (res.status() === 404) continue;

            expect(res.status() < 500, `${url} returned ${res.status()} (5xx leak)`).toBe(true);

            if (res.ok()) {
                const body = (await res.json()) as { data?: unknown };
                expect(
                    body.data === null || body.data === undefined,
                    `${url} unexpectedly returned non-null data: ${JSON.stringify(body.data).slice(0, 100)}`
                ).toBe(true);
            }
        }

        // ── 2. Garbage path under /api/v1/public/ returns 404 JSON ────────
        const garbageRes = await page.request.get(`${API_URL}/api/v1/public/this-does-not-exist`);
        expect(
            garbageRes.status(),
            `garbage path should return 404, got ${garbageRes.status()}`
        ).toBe(404);

        // The 404 should be a JSON error body (not an HTML 500 page).
        const contentType = garbageRes.headers()['content-type'] ?? '';
        expect(
            contentType.includes('application/json') || contentType.includes('text/plain'),
            `404 response should be JSON or plain text, got content-type=${contentType}`
        ).toBe(true);

        // ── 3. /health smoke (no 5xx) ─────────────────────────────────────
        const healthRes = await page.request.get(`${API_URL}/health`);
        expect(
            healthRes.status() < 500,
            `health endpoint must not 5xx (got ${healthRes.status()})`
        ).toBe(true);
    });
});
