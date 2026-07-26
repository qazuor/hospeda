/**
 * Removal guard for the unified public search endpoint.
 *
 * The global site-search feature was cut from the product: the web page that
 * consumed it and the `GET /api/v1/public/search` handler behind it were both
 * deleted, together with its request/response schemas in `@repo/schemas`.
 *
 * The suite that used to cover the endpoint opened with a "should be registered
 * and not return 404" case, so deleting it outright would have left nothing
 * watching the mount point. This file inverts that assertion: the route must
 * stay unmounted, and any future `app.route('/api/v1/public/search', ...)` in
 * `src/routes/index.ts` fails here instead of silently resurrecting a feature
 * the owner removed on purpose.
 *
 * Exercised through the real app (`initApp`) — the same harness the sibling
 * route tests use — so the assertion is on the actual router, not a stub.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

const REMOVED_PATH = '/api/v1/public/search';

describe('GET /api/v1/public/search (removed — global site search cut)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    it('is not mounted — returns 404', async () => {
        const app = initApp();

        const res = await app.request(`${REMOVED_PATH}?q=co`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        // A mounted route would answer 200 (results) or 400 (validation), never
        // 404. 404 is the only status that proves nothing is listening here.
        expect(res.status).toBe(404);
    });

    it('is not mounted without a query string either', async () => {
        const app = initApp();

        const res = await app.request(REMOVED_PATH, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(404);
    });

    it('is not advertised in the public cache-endpoint allowlist', async () => {
        const { PUBLIC_CACHE_ENDPOINTS } = await import('../../src/middlewares/cache.constants');

        expect(PUBLIC_CACHE_ENDPOINTS).not.toContain(REMOVED_PATH);
    });
});
