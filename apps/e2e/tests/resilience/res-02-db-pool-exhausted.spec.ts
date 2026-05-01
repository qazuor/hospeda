/**
 * RES-02 — DB connection pool exhausted → 503, never 500.
 *
 * Actors: Many concurrent anonymous requests against a public read
 *         endpoint until the pool saturates.
 * Tags: @p0 @resilience @cross-app
 *
 * Preconditions:
 *   - Public listing endpoint mounted at `/api/v1/public/accommodations`.
 *
 * What this validates:
 *  1. Under heavy concurrency, NO request returns 500 (uncaught crash).
 *  2. Pool-saturated requests respond with 503 / 429 / 408 — codes that
 *     the load balancer / web client can interpret as transient.
 *  3. The system continues to serve requests after the burst (the pool
 *     drains, no permanent damage).
 *
 * Why this is observable in CI:
 *   The pool size in `docker-compose.e2e.yml` Postgres is small (default
 *   100), and Hono+pg-pool's default per-process pool is ~10. Firing
 *   100+ requests in parallel is enough to occasionally exhaust the
 *   pool without actually hurting throughput.
 *
 * Caveat:
 *   On very fast hardware the pool may never saturate within a 100-request
 *   burst. The test then asserts only "no 5xx" — a softer but still
 *   meaningful contract.
 *
 * @see SPEC-092 spec.md § RES-02
 */

import { expect, test } from '@playwright/test';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('RES-02: DB pool exhausted returns 503, not 500 @p0 @resilience @cross-app', () => {
    test('100 concurrent reads: no 500s, post-burst still serves traffic', async ({ page }) => {
        const burstSize = 100;
        const url = `${API_URL}/api/v1/public/accommodations?pageSize=10`;

        const tasks: Promise<{ status: number }>[] = [];
        for (let i = 0; i < burstSize; i++) {
            tasks.push(page.request.get(url).then((res) => ({ status: res.status() })));
        }

        const results = await Promise.all(tasks);

        // ── 1. No 500-class crashes ───────────────────────────────────────
        const fiveHundreds = results.filter((r) => r.status >= 500 && r.status !== 503);
        expect(
            fiveHundreds.length,
            `expected zero 5xx (other than 503), got ${fiveHundreds.length} of ${burstSize}`
        ).toBe(0);

        // ── 2. Pool-saturated responses use a transient class ─────────────
        const transient = results.filter((r) => [408, 429, 503].includes(r.status));
        const ok = results.filter((r) => r.status >= 200 && r.status < 300);
        // Either everything succeeded, or at least some saturated requests
        // returned the transient code. Reject the case where saturated
        // requests would have returned an arbitrary 4xx.
        expect(
            ok.length + transient.length,
            `every request must be 2xx or transient (got ${ok.length} ok + ${transient.length} transient of ${burstSize})`
        ).toBe(burstSize);

        // ── 3. Post-burst sanity: pool drains and serves traffic ─────────
        const postBurst = await page.request.get(url);
        expect(
            postBurst.status() < 500,
            `post-burst request must succeed or return transient (got ${postBurst.status()})`
        ).toBe(true);
    });
});
