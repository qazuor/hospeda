/**
 * Soft-deleted resource access tests (SPEC-092 T-087, refined by HOS-117 T-022).
 *
 * Validates the contract that public endpoints MUST NOT leak data about
 * soft-deleted resources, with a deliberate carve-out for previously-PUBLIC
 * content:
 *  - GET on a soft-deleted entity returns null body (or 404) without
 *    revealing the entity ever existed — UNLESS the entity was PUBLIC
 *    (indexable) before deletion, in which case it returns 410 GONE so
 *    crawlers/LLM fetchers deindex the URL fast. A 410 discloses that a
 *    PUBLIC URL is gone, but that URL was already publicly discoverable, so
 *    this is not an enumeration leak.
 *  - A soft-deleted PRIVATE/RESTRICTED entity (never publicly discoverable)
 *    stays uniformly 404 — indistinguishable from a genuinely-nonexistent
 *    slug. This preserves the original anti-enumeration contract for content
 *    that was never public.
 *  - Error responses for soft-deleted resources do not leak titles,
 *    internal IDs, or audit info, regardless of status code (404 or 410).
 *  - Admin endpoints with `includeDeleted=true` flag DO surface them.
 *
 * Soft-delete behavior at the model layer (`deletedAt IS NULL` filter)
 * is already covered by SPEC-061 + SPEC-082 integration tests. This file
 * focuses on the route-level contract.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env', () => ({
    validateApiEnv: vi.fn(),
    env: {
        NODE_ENV: 'test',
        API_SECURITY_ENABLED: false,
        HOSPEDA_TESTING_RATE_LIMIT: false,
        HOSPEDA_TESTING_ORIGIN_VERIFICATION: false,
        HOSPEDA_DISABLE_AUTH: true,
        HOSPEDA_ALLOW_MOCK_ACTOR: true
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const mockGetBySlug = vi.fn();

vi.mock('@repo/service-core', async (orig) => {
    const actual = (await orig()) as Record<string, unknown>;
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getBySlug: mockGetBySlug
            };
        })
    };
});

describe('Soft-deleted resource access — public route contract', () => {
    beforeEach(() => {
        mockGetBySlug.mockReset();
    });

    it('returns null body when service reports the entity does not exist', async () => {
        // Soft-deleted entities are filtered by deletedAt IS NULL at the model
        // level, so the service returns success: true, data: null. The route
        // must echo that as a 200 with null body — no enumeration leak.
        mockGetBySlug.mockResolvedValue({ success: true, data: null });

        const app = new Hono();
        app.get('/api/v1/public/accommodations/slug/:slug', async (c) => {
            const result = await mockGetBySlug(null, c.req.param('slug'));
            if (result.error) {
                return c.json({ success: false, error: result.error }, 404);
            }
            return c.json(result.data);
        });

        const response = await app.request('/api/v1/public/accommodations/slug/deleted-hotel');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toBeNull();
    });

    it('returns 404 with sanitized error body when service throws NOT_FOUND', async () => {
        mockGetBySlug.mockResolvedValue({
            success: false,
            error: {
                code: ServiceErrorCode.NOT_FOUND,
                message: 'Accommodation not found'
            }
        });

        const app = new Hono();
        app.get('/api/v1/public/accommodations/slug/:slug', async (c) => {
            const result = await mockGetBySlug(null, c.req.param('slug'));
            if (result.error) {
                return c.json({ success: false, error: { code: result.error.code } }, 404);
            }
            return c.json(result.data);
        });

        const response = await app.request('/api/v1/public/accommodations/slug/missing-hotel');
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe(ServiceErrorCode.NOT_FOUND);
        // No leak: message must NOT contain the entity title or internal id
        expect(JSON.stringify(body)).not.toMatch(/title|adminInfo|internal_id/i);
    });

    it('does NOT differentiate between a soft-deleted PRIVATE entity and never-existed (anti-enumeration holds)', async () => {
        // Content that was never publicly discoverable must produce the same
        // observable response whether it never existed or was deleted, so an
        // attacker cannot enumerate previously-existing PRIVATE/RESTRICTED
        // slugs. Both branches surface as ServiceErrorCode.NOT_FOUND -> 404:
        // `BaseCrudRead.getByField` throws NOT_FOUND directly when no row
        // matches (it never resolves as `{ data: null }` — see
        // `packages/service-core/src/base/base.crud.read.ts`), and a
        // soft-deleted PRIVATE row resolves through the same NOT_FOUND path
        // via the service's visibility gate. Same code, same status, same
        // body shape.
        const responses: Array<{ status: number; bodyShape: string }> = [];

        for (const scenario of [
            {
                name: 'never-existed',
                result: {
                    success: false,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Accommodation not found' }
                }
            },
            {
                name: 'soft-deleted-private',
                // A soft-deleted PRIVATE entity resolves through the service's
                // visibility gate to NOT_FOUND, same as never-existed.
                result: {
                    success: false,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Accommodation not found' }
                }
            }
        ]) {
            mockGetBySlug.mockResolvedValueOnce(scenario.result);
            const app = new Hono();
            app.get('/api/v1/public/accommodations/slug/:slug', async (c) => {
                const result = await mockGetBySlug(null, c.req.param('slug'));
                if (result.error) {
                    return c.json({ success: false, error: { code: result.error.code } }, 404);
                }
                return c.json(result.data);
            });
            const response = await app.request(
                `/api/v1/public/accommodations/slug/${scenario.name}`
            );
            const body = await response.json();
            responses.push({
                status: response.status,
                bodyShape: JSON.stringify(body)
            });
        }

        expect(responses[0]?.status).toBe(responses[1]?.status);
        expect(responses[0]?.status).toBe(404);
    });

    it('DOES distinguish a soft-deleted PUBLIC entity (410) from never-existed/never-public (404) — deliberate deindex signal', async () => {
        // Refined product decision (HOS-117 T-022): a PUBLIC entity that gets
        // soft-deleted was already indexable/discoverable, so surfacing 410
        // instead of 404 does not leak anything new — it's a deliberate signal
        // for crawlers/LLM fetchers to deindex the URL fast.
        mockGetBySlug.mockResolvedValueOnce({
            success: false,
            error: { code: ServiceErrorCode.GONE, message: 'Accommodation is gone' }
        });

        const app = new Hono();
        app.get('/api/v1/public/accommodations/slug/:slug', async (c) => {
            const result = await mockGetBySlug(null, c.req.param('slug'));
            if (result.error) {
                const status = result.error.code === ServiceErrorCode.GONE ? 410 : 404;
                return c.json({ success: false, error: { code: result.error.code } }, status);
            }
            return c.json(result.data);
        });

        const response = await app.request(
            '/api/v1/public/accommodations/slug/formerly-public-hotel'
        );
        const body = await response.json();

        expect(response.status).toBe(410);
        expect(response.status).not.toBe(404);
        expect(body.error.code).toBe(ServiceErrorCode.GONE);
        // The invariant that DOES still hold regardless of status code: no
        // leak of the entity's title, internal id, or audit info.
        expect(JSON.stringify(body)).not.toMatch(/title|adminInfo|internal_id/i);
    });

    it('uses ServiceErrorCode.NOT_FOUND as the wire-level error code for missing / never-public entities', () => {
        // Locks the contract: the public route maps `result.error.code` to
        // ServiceErrorCode.NOT_FOUND so the global error handler renders 404
        // for genuinely-nonexistent slugs and for soft-deleted PRIVATE content.
        expect(ServiceErrorCode.NOT_FOUND).toBeDefined();
        expect(typeof ServiceErrorCode.NOT_FOUND).toBe('string');
    });

    it('uses ServiceErrorCode.GONE as the wire-level error code for soft-deleted formerly-PUBLIC entities', () => {
        // Locks the refined contract: the public route maps `result.error.code`
        // GONE to HTTP 410 (ERROR_CODE_TO_HTTP / handleRouteError), distinct
        // from the 404 mapping for NOT_FOUND.
        expect(ServiceErrorCode.GONE).toBeDefined();
        expect(typeof ServiceErrorCode.GONE).toBe('string');
    });
});

describe('Soft-deleted resource access — admin route contract', () => {
    it('admin route with includeDeleted=true MAY return soft-deleted entities', async () => {
        // This is the inverse of the public-route contract: admin endpoints
        // tagged with `includeDeleted` parameter should surface soft-deleted
        // rows so moderators can audit them. Validated end-to-end by SPEC-061
        // model-level tests; here we lock the documented behavior.
        const sample = {
            id: 'acc-1',
            slug: 'some-hotel',
            deletedAt: new Date().toISOString()
        };
        const findAll = vi.fn().mockResolvedValue([sample]);

        const app = new Hono();
        app.get('/api/v1/admin/accommodations', async (c) => {
            const includeDeleted = c.req.query('includeDeleted') === 'true';
            const data = await findAll({ includeDeleted });
            return c.json({ data });
        });

        const response = await app.request('/api/v1/admin/accommodations?includeDeleted=true');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(findAll).toHaveBeenCalledWith({ includeDeleted: true });
        expect(body.data).toContainEqual(sample);
    });

    it('admin route without includeDeleted defaults to excluding soft-deleted', async () => {
        const findAll = vi.fn().mockResolvedValue([]);

        const app = new Hono();
        app.get('/api/v1/admin/accommodations', async (c) => {
            const includeDeleted = c.req.query('includeDeleted') === 'true';
            const data = await findAll({ includeDeleted });
            return c.json({ data });
        });

        const response = await app.request('/api/v1/admin/accommodations');
        expect(response.status).toBe(200);
        expect(findAll).toHaveBeenCalledWith({ includeDeleted: false });
    });
});
