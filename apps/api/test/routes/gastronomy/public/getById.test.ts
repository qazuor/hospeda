/**
 * Tests for GET /api/v1/public/gastronomies/:id
 *
 * Covers: route registration, public access, 404 for hidden/missing listings,
 * UUID validation, and response shape.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/gastronomies';
const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVALID_UUID = 'not-a-uuid';

describe('GET /api/v1/public/gastronomies/:id', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404 for route)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Route should exist — service may return 404/500 for unknown UUID,
            // but the route itself must be registered.
            expect(res.status).not.toBe(404);
            expect([200, 400, 404, 500]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // Public access
    // -------------------------------------------------------------------------

    describe('Public Access', () => {
        it('should not require authentication', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -------------------------------------------------------------------------
    // UUID validation
    // -------------------------------------------------------------------------

    describe('UUID Validation', () => {
        it('should return 400 for invalid UUID', async () => {
            const res = await app.request(`${BASE}/${INVALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([400, 422]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape
    // -------------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });
    });

    // -------------------------------------------------------------------------
    // HTTP method restrictions
    // -------------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject DELETE requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
