/**
 * Integration tests for GET /api/v1/public/posts/slug/:slug
 *
 * Mirrors the accommodation/gastronomy public getBySlug route test pattern
 * (route registration, public access, response shape, HTTP method
 * restrictions), plus the HOS-117 T-022 GONE (410) regression: a
 * soft-deleted post must be deindexed via HTTP 410, distinct from a
 * genuinely-nonexistent slug (404).
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/posts/slug';

// ---------------------------------------------------------------------------
// HOS-117 T-022 — GONE (410) regression. Only the service layer is mocked,
// and only for a single magic slug — every other slug delegates to the real
// (unmocked) implementation so the rest of this file's assertions (which
// rely on real DB-backed behavior) are unaffected. The real route +
// error-handling middleware (handleRouteError / ERROR_CODE_TO_HTTP) still
// runs, so this asserts the real GONE -> 410 wiring, not just the
// service-level throw.
// ---------------------------------------------------------------------------
const GONE_SLUG = 'hos-117-soft-deleted-post';

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PostService: class MockPostService extends actual.PostService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof actual.PostService>) {
                super(...args);
            }

            override async getBySlug(
                ...args: Parameters<typeof actual.PostService.prototype.getBySlug>
            ): ReturnType<typeof actual.PostService.prototype.getBySlug> {
                if (args[1] === GONE_SLUG) {
                    return {
                        error: { code: ServiceErrorCode.GONE, message: 'Post is gone' }
                    } as Awaited<ReturnType<typeof actual.PostService.prototype.getBySlug>>;
                }
                return super.getBySlug(...args);
            }
        }
    };
});

describe('GET /api/v1/public/posts/slug/:slug', () => {
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

    // -------------------------------------------------------------------------
    // HTTP method restrictions
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Soft-delete GONE (410) — HOS-117 T-022
    // -------------------------------------------------------------------------

    describe('Soft-deleted post (GONE)', () => {
        it('returns 410 when the service reports GONE for a soft-deleted slug', async () => {
            const res = await app.request(`${BASE}/${GONE_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(410);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe(ServiceErrorCode.GONE);
        });
    });
});
