/**
 * Tests for GET /api/v1/public/gastronomies/slug/:slug
 *
 * Covers: route registration, public access, slug format acceptance, and
 * response shape.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/gastronomies/slug';

describe('GET /api/v1/public/gastronomies/slug/:slug', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/some-test-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
            expect([200, 400, 500]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // Public access
    // -------------------------------------------------------------------------

    describe('Public Access', () => {
        it('should not require authentication', async () => {
            const res = await app.request(`${BASE}/any-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -------------------------------------------------------------------------
    // Slug format
    // -------------------------------------------------------------------------

    describe('Slug Format', () => {
        it('should accept hyphenated slugs', async () => {
            const res = await app.request(`${BASE}/la-parrilla-del-centro`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });

        it('should accept single-word slugs', async () => {
            const res = await app.request(`${BASE}/parrilla`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape
    // -------------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(`${BASE}/test-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });
    });
});
