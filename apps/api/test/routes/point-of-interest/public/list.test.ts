/**
 * Tests for GET /api/v1/public/points-of-interest
 *
 * Covers: route registration, public access (no auth required), and
 * response shape. Mirrors `test/routes/gastronomy/public/list.test.ts`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/points-of-interest';

describe('GET /api/v1/public/points-of-interest', () => {
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

        it('should accept a valid type filter without error', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10&type=BEACH`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([200, 500]).toContain(res.status);
        });

        it('should reject an invalid type enum value', async () => {
            const res = await app.request(`${BASE}?type=NOT_A_REAL_TYPE`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([400, 422]).toContain(res.status);
        });

        // HOS-142 G-6: the proximity-search POI-picker autocomplete relies on
        // `q` (free-text) + `sortBy=displayWeight`/`isFeatured` (featured-first
        // ordering) actually reaching the search — accept them without a
        // validation error (the DB-dependent 200 vs 500 split mirrors the
        // other query-param tests above, which don't have a live DB either).
        it('should accept a `q` free-text search param without a validation error', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10&q=plaza`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([200, 500]).toContain(res.status);
        });

        it('should accept sortBy=displayWeight&sortOrder=desc without a validation error', async () => {
            const res = await app.request(
                `${BASE}?page=1&pageSize=10&sortBy=displayWeight&sortOrder=desc`,
                {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                }
            );
            expect([200, 500]).toContain(res.status);
        });

        it('should accept isFeatured=true without a validation error', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10&isFeatured=true`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([200, 500]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // HTTP method restrictions
    // -------------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests (no admin/protected tier — NG-5)', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', 'content-type': 'application/json' },
                body: JSON.stringify({})
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
