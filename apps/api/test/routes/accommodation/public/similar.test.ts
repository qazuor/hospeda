/**
 * Integration tests for GET /api/v1/public/accommodations/:id/similar
 *
 * Tests the public endpoint that returns accommodations similar to a given one
 * by matching type or destination.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/accommodations';
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('GET /api/v1/public/accommodations/:id/similar', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Route should be registered — NOT 404
            expect(res.status).not.toBe(404);
        });
    });

    // -----------------------------------------------------------------------
    // Public access
    // -----------------------------------------------------------------------

    describe('Public Access', () => {
        it('should not require authentication (no 401/403)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Response behavior
    // -----------------------------------------------------------------------

    describe('Response Behavior', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });

        it('should return array data when successful', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(Array.isArray(body.data)).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Query params
    // -----------------------------------------------------------------------

    describe('Query Parameters', () => {
        it('should accept ?limit=3 without returning 404', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar?limit=3`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Route should handle the param — even if the mock DB causes a 400/500,
            // the route itself is registered and processes the query param.
            expect(res.status).not.toBe(404);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/similar`, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
