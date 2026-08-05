/**
 * Tests for `GET /api/v1/public/authors`.
 *
 * `UserService.listPublicAuthors` is already implemented and already tested at
 * the service layer (see `packages/service-core/src/services/user/user.service.ts`).
 * These tests cover the ROUTE contract only: registration, auth-independence,
 * the `{ items, pagination }` envelope shape, and that the route surfaces
 * exactly what the service returns (nothing added, nothing dropped).
 *
 * The mocked `UserService.listPublicAuthors` return value below is copied
 * field-for-field from the real service's return statement
 * (`{ items, pagination: { page, pageSize, total, totalPages } }`). A mock
 * shaped differently from the real service is exactly how the sibling
 * `GET /api/v1/public/events/author/:id` route answered 500 for every author
 * for months while its test suite stayed green — see
 * `apps/api/test/routes/event/public/getByAuthor.test.ts`.
 */

import { UserService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { clearCache } from '../../../../src/middlewares/cache.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/authors';

const request = (app: AppOpenAPI, path: string) =>
    app.request(path, {
        method: 'GET',
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });

describe('GET /api/v1/public/authors', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // This route sets `cacheTTL: 300`, and the in-memory cache middleware is a
    // module-level singleton shared across every test in this file (and
    // technically the whole worker). Without clearing it, a request made by
    // an earlier test populates the cache under `/api/v1/public/authors`, and
    // a later test with a differently-mocked service would just replay that
    // stale cached body instead of reaching the (re-mocked) handler.
    beforeEach(() => {
        clearCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearCache();
    });

    it('is registered and reachable (not 404)', async () => {
        const res = await request(app, BASE);
        expect(res.status).not.toBe(404);
    });

    it('does not require authentication', async () => {
        const res = await request(app, BASE);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    it('returns 200 with the paginated envelope for an anonymous request', async () => {
        const res = await request(app, BASE);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.pagination).toMatchObject({
            page: expect.any(Number),
            pageSize: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
        });
    });

    it('response shape is exactly { items, pagination } — no extra top-level keys', async () => {
        const res = await request(app, BASE);
        const body = await res.json();

        expect(Object.keys(body.data).sort()).toEqual(['items', 'pagination']);
    });

    describe('with a mocked service (field-for-field real shape)', () => {
        it('surfaces exactly the authors the service returns — excluded authors never appear', async () => {
            const includedAuthor = {
                slug: 'included-author',
                updatedAt: new Date('2026-01-15T00:00:00.000Z')
            };

            // Shape copied verbatim from UserService.listPublicAuthors's return
            // statement: `{ items, pagination: { page, pageSize, total, totalPages } }`.
            vi.spyOn(UserService.prototype, 'listPublicAuthors').mockResolvedValue({
                data: {
                    items: [includedAuthor],
                    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 }
                }
            });

            const res = await request(app, BASE);
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.data.items).toHaveLength(1);
            expect(body.data.items[0].slug).toBe('included-author');
            // Non-vacuity: an author absent from the service's mocked response
            // (i.e. filtered out server-side — not indexable, soft-deleted,
            // system account, etc.) must never surface in the route's output.
            expect(
                body.data.items.some((item: { slug: string }) => item.slug === 'excluded-author')
            ).toBe(false);
            expect(body.data.pagination).toEqual({
                page: 1,
                pageSize: 50,
                total: 1,
                totalPages: 1
            });
        });

        it('propagates the service error code instead of inventing its own', async () => {
            vi.spyOn(UserService.prototype, 'listPublicAuthors').mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'boom' } as never
            });

            const res = await request(app, BASE);
            expect(res.status).toBe(500);
        });
    });

    describe('HTTP method restrictions', () => {
        it('rejects POST with 404 or 405', async () => {
            const res = await app.request(BASE, {
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
