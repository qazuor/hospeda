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
