/**
 * Tests for GET /api/v1/public/points-of-interest/slug/:slug
 *
 * Covers: route registration, public access, underscore-slug format
 * acceptance (HOS-113 slugs are the i18n key and allow underscores, unlike
 * attraction's hyphen-only slugs), and response shape. Mirrors
 * `test/routes/gastronomy/public/getBySlug.test.ts`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/points-of-interest/slug';

describe('GET /api/v1/public/points-of-interest/slug/:slug', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/some_test_slug`, {
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
            const res = await app.request(`${BASE}/any_slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -------------------------------------------------------------------------
    // Slug format (underscore-inclusive — HOS-113 OQ-2)
    // -------------------------------------------------------------------------

    describe('Slug Format', () => {
        it('should accept underscore-separated slugs', async () => {
            const res = await app.request(`${BASE}/playa_banco_pelay`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });

        it('should accept hyphenated slugs', async () => {
            const res = await app.request(`${BASE}/some-poi-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });

        it('should accept single-word slugs', async () => {
            const res = await app.request(`${BASE}/autodromo`, {
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
            const res = await app.request(`${BASE}/test_slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });
    });
});
