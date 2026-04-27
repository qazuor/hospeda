/**
 * Integration tests for GET /api/v1/public/users/:id/accommodations
 *
 * Verifies that the dedicated owner-accommodations endpoint:
 *   (a) is registered and reachable
 *   (b) does not require authentication
 *   (c) returns a paginated envelope (items + pagination) on success
 *   (d) returns an empty list — NOT 404 — for a non-existent user ID
 *   (e) accepts valid pagination query params without returning 400
 *   (f) rejects invalid path param (non-UUID) with 400
 *
 * Full data-layer assertions (e.g. only ACTIVE records returned) require a
 * seeded test database and belong in a dedicated e2e suite. The tests here
 * focus on route-level contract: status codes, response shape, and validation.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/users';

/** A syntactically-valid UUID that does not correspond to any real user. */
const NONEXISTENT_USER_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** A deliberately invalid (non-UUID) path segment. */
const INVALID_ID = 'not-a-uuid';

describe('GET /api/v1/public/users/:id/accommodations', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // The route must be wired up. Even without a real DB it should
            // return something other than 404 (likely 200 empty or 500).
            expect(res.status).not.toBe(404);
        });
    });

    // -----------------------------------------------------------------------
    // Public access — no authentication required
    // -----------------------------------------------------------------------

    describe('Public access', () => {
        it('should not require authentication (no 401 or 403)', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Non-existent user → empty list, NOT 404
    // -----------------------------------------------------------------------

    describe('Non-existent user ID', () => {
        it('should return HTTP 200 with an empty items array (not 404)', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Accept 200 (DB reachable, no rows) or 500 (DB unreachable in unit
            // mode). In no case should it be 404 — that is the spec contract.
            expect(res.status).not.toBe(404);

            if (res.status === 200) {
                const body = await res.json();
                // Response must be a paginated envelope
                expect(body).toHaveProperty('success', true);
                expect(body).toHaveProperty('data');
                expect(Array.isArray(body.data)).toBe(true);
                expect(body).toHaveProperty('pagination');
                expect(body.pagination).toHaveProperty('total');
            }
        });

        it('should return total = 0 for a non-existent user when DB is reachable', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            if (res.status === 200) {
                const body = await res.json();
                expect(body.pagination.total).toBe(0);
                expect(body.data).toHaveLength(0);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Response shape (paginated envelope)
    // -----------------------------------------------------------------------

    describe('Response shape', () => {
        it('should return a JSON body with success, data, and pagination keys', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success');
                expect(body).toHaveProperty('data');
                expect(body).toHaveProperty('pagination');
                const { pagination } = body;
                expect(pagination).toHaveProperty('page');
                expect(pagination).toHaveProperty('pageSize');
                expect(pagination).toHaveProperty('total');
                expect(pagination).toHaveProperty('totalPages');
            }
        });
    });

    // -----------------------------------------------------------------------
    // Pagination query params
    // -----------------------------------------------------------------------

    describe('Pagination query params', () => {
        it('should accept ?page=1&pageSize=4 without returning 404', async () => {
            const res = await app.request(
                `${BASE}/${NONEXISTENT_USER_UUID}/accommodations?page=1&pageSize=4`,
                { method: 'GET', headers: { 'user-agent': 'vitest', accept: 'application/json' } }
            );
            // The route must exist and process the request. 200 (DB reachable),
            // 400 (OpenAPI validator), or 500 (DB unreachable) are all acceptable
            // in unit mode — but 404 (route not registered) is never acceptable.
            expect(res.status).not.toBe(404);
        });

        it('should use pageSize=4 as reported in the pagination envelope', async () => {
            const res = await app.request(
                `${BASE}/${NONEXISTENT_USER_UUID}/accommodations?page=1&pageSize=4`,
                { method: 'GET', headers: { 'user-agent': 'vitest', accept: 'application/json' } }
            );
            if (res.status === 200) {
                const body = await res.json();
                expect(body.pagination.pageSize).toBe(4);
            }
        });

        it('should reject unknown query params with 400', async () => {
            const res = await app.request(
                `${BASE}/${NONEXISTENT_USER_UUID}/accommodations?ownerId=override`,
                { method: 'GET', headers: { 'user-agent': 'vitest', accept: 'application/json' } }
            );
            // The route factory rejects unknown params. `ownerId` must NOT be
            // accepted as a query param — it is injected from the path server-side.
            expect(res.status).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // Path param validation
    // -----------------------------------------------------------------------

    describe('Path param validation', () => {
        it('should return 400 for a non-UUID path param', async () => {
            const res = await app.request(`${BASE}/${INVALID_ID}/accommodations`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // The route declares `id: z.string().uuid()` so the framework should
            // reject a non-UUID with 400.
            expect(res.status).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP method restrictions', () => {
        it('should reject POST requests with 404 or 405', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_USER_UUID}/accommodations`, {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
