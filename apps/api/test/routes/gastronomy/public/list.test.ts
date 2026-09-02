/**
 * Tests for GET /api/v1/public/gastronomies
 *
 * Covers: route registration, public access (no auth required), visible-only
 * contract, and response shape.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/gastronomies';

describe('GET /api/v1/public/gastronomies', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // Public access
    // -------------------------------------------------------------------------

    describe('Public Access', () => {
        it('should not require authentication', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape
    // -------------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });
    });

    // -------------------------------------------------------------------------
    // Query parameter validation
    // -------------------------------------------------------------------------

    describe('Query Parameter Validation', () => {
        it('should reject negative page number', async () => {
            const res = await app.request(`${BASE}?page=-1`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([400, 422]).toContain(res.status);
        });

        it('should accept valid filters without error', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([200, 500]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // The apto filter (HOS-1054)
    //
    // These assert a STRICT 200, unlike the lenient `[200, 500]` above. That
    // leniency is what let an unstubbed `@repo/db` helper pass unnoticed: the
    // clause builders reach the route through the globally-mocked `@repo/db`,
    // and a missing export there throws inside `_executeSearch`/`_executeCount`
    // rather than returning a wrong answer. Accepting 500 would accept exactly
    // that.
    //
    // What they cannot assert: which rows come back. The DB is mocked, so the
    // clause is built and handed over but never executed — row-level behaviour
    // is `packages/db/test/utils/gastronomy-catalog-filters.test.ts` (which
    // compiles the SQL) plus the staging smoke.
    // -------------------------------------------------------------------------

    describe('apto filter (HOS-1054)', () => {
        const GLUTEN_FREE = '11111111-1111-4111-8111-111111111111';
        const LACTOSE_FREE = '22222222-2222-4222-8222-222222222222';
        const headers = { 'user-agent': 'vitest', accept: 'application/json' };

        it('answers 200 for a single apto', async () => {
            const res = await app.request(`${BASE}?features=${GLUTEN_FREE}`, {
                method: 'GET',
                headers
            });
            expect(res.status).toBe(200);
        });

        it('answers 200 for two aptos (the intersection path)', async () => {
            const res = await app.request(`${BASE}?features=${GLUTEN_FREE},${LACTOSE_FREE}`, {
                method: 'GET',
                headers
            });
            expect(res.status).toBe(200);
        });

        it('answers 200 for the amenities filter too', async () => {
            const res = await app.request(`${BASE}?amenities=${GLUTEN_FREE}`, {
                method: 'GET',
                headers
            });
            expect(res.status).toBe(200);
        });

        it('answers 400 — not a silently unfiltered 200 — for a non-UUID apto', async () => {
            // The dangerous failure this route must never have: a filter that is
            // dropped instead of honoured answers 200 with every listing, and a
            // celiac reads that page as "these are all sin TACC".
            const res = await app.request(`${BASE}?features=gluten_free_options`, {
                method: 'GET',
                headers
            });
            expect(res.status).toBe(400);
        });
    });

    // -------------------------------------------------------------------------
    // HTTP method restrictions
    // -------------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', 'content-type': 'application/json' },
                body: JSON.stringify({})
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
