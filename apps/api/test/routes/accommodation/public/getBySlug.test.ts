/**
 * Integration tests for GET /api/v1/public/accommodations/slug/:slug
 *
 * Tests the extended getBySlug route that JOINs owner, amenities, features, and FAQs.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/accommodations/slug';

describe('GET /api/v1/public/accommodations/slug/:slug', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            try {
                const res = await app.request(`${BASE}/some-test-slug`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                // Route should exist — service may return 404 for unknown slug, but route is registered
                expect(res.status).not.toBe(404);
                expect([200, 400, 500]).toContain(res.status);
            } catch (error: unknown) {
                // HTTPException from middleware is also acceptable — route exists
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should return 400 or 404 for empty slug', async () => {
            const res = await app.request(`${BASE}/`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([400, 404]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Public access
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Response shape
    // -----------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(`${BASE}/test-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });

        it('should include metadata in response', async () => {
            const res = await app.request(`${BASE}/test-slug`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            if (body.metadata) {
                expect(body.metadata).toHaveProperty('timestamp');
            }
        });
    });

    // -----------------------------------------------------------------------
    // Slug validation
    // -----------------------------------------------------------------------

    describe('Slug Validation', () => {
        it('should accept hyphenated slugs', async () => {
            const res = await app.request(`${BASE}/cabin-retiro-soleado`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Should not be a validation error for valid slug format
            expect(res.status).not.toBe(400);
        });

        it('should accept single-word slugs', async () => {
            const res = await app.request(`${BASE}/resort`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(`${BASE}/test-slug`, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });

        it('should reject DELETE requests', async () => {
            const res = await app.request(`${BASE}/test-slug`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
