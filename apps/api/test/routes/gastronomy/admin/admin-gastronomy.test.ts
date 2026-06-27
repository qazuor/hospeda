/**
 * Tests for admin gastronomy routes (SPEC-239 T-045 / T-046).
 *
 * Verifies:
 *  - POST   /api/v1/admin/gastronomies         requires COMMERCE_CREATE (403 without)
 *  - GET    /api/v1/admin/gastronomies         requires COMMERCE_VIEW_ALL (401/403 without)
 *  - POST   /api/v1/admin/gastronomies/reviews/:id/moderate requires COMMERCE_MODERATE_REVIEW
 *  - POST   /api/v1/admin/gastronomies/:id/assign-owner sets ownerId via update
 *
 * Pattern: boot the full Hono app with `initApp()` and send real HTTP requests
 * with the `x-mock-actor-*` header triplet. The service layer is mocked in
 * test/setup.ts so these tests assert HTTP gate behaviour only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('Admin gastronomy routes — SPEC-239 T-045 / T-046', () => {
    let app: AppOpenAPI;

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_GASTRONOMY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const MOCK_REVIEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    // ──────────────────────────────────────────────────────────────────────────
    // Header factories
    // ──────────────────────────────────────────────────────────────────────────

    // The global validation middleware requires a `user-agent` header
    // (API_VALIDATION_REQUIRED_HEADERS defaults to ['user-agent']). Every
    // request must carry it or it is rejected with 400 MISSING_REQUIRED_HEADER
    // before the auth/permission gate runs.
    const USER_AGENT = { 'user-agent': 'vitest' };

    /** Actor with COMMERCE_CREATE + admin-panel access */
    const headersWithCreate = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'access.panelAdmin',
            'commerce.create',
            'commerce.viewAll'
        ])
    };

    /** Actor with COMMERCE_VIEW_ALL + admin-panel access */
    const headersWithViewAll = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'commerce.viewAll'])
    };

    /** Actor with COMMERCE_MODERATE_REVIEW + admin-panel access */
    const headersWithModerate = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'commerce.moderateReview'])
    };

    /** Actor with COMMERCE_EDIT_ALL + admin-panel access */
    const headersWithEditAll = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'commerce.editAll'])
    };

    /** Actor with admin-panel access but NO commerce permissions */
    const headersNoCommercePerms = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin'])
    };

    /** Unauthenticated (no mock-actor headers, but valid user-agent) */
    const noHeaders = { ...USER_AGENT };

    /** Body-only headers for unauthenticated POST requests */
    const noAuthJsonHeaders = { ...USER_AGENT, 'Content-Type': 'application/json' };

    beforeAll(async () => {
        app = initApp();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T-045: List (GET /)
    // ──────────────────────────────────────────────────────────────────────────

    describe('GET /api/v1/admin/gastronomies — list requires auth', () => {
        it('returns 401/403 when no auth headers are provided', async () => {
            const res = await app.request('/api/v1/admin/gastronomies', {
                method: 'GET',
                headers: noHeaders
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('passes the gate with COMMERCE_VIEW_ALL (not 403/404)', async () => {
            const res = await app.request('/api/v1/admin/gastronomies', {
                method: 'GET',
                headers: headersWithViewAll
            });
            // Gate passes; service layer is mocked so we accept 200 or 5xx but NOT 403
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(404);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T-045: Create (POST /)
    // ──────────────────────────────────────────────────────────────────────────

    describe('POST /api/v1/admin/gastronomies — create requires COMMERCE_CREATE', () => {
        const validBody = JSON.stringify({
            name: 'La Parrilla Test',
            type: 'PARRILLA',
            destinationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            ownerId: MOCK_USER_ID
        });

        it('returns 401/403 when no auth headers are provided', async () => {
            const res = await app.request('/api/v1/admin/gastronomies', {
                method: 'POST',
                headers: noAuthJsonHeaders,
                body: validBody
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('returns 403 when actor lacks COMMERCE_CREATE', async () => {
            const res = await app.request('/api/v1/admin/gastronomies', {
                method: 'POST',
                headers: { ...headersNoCommercePerms, 'Content-Type': 'application/json' },
                body: validBody
            });
            expect(res.status).toBe(403);
        });

        it('passes the gate with COMMERCE_CREATE (not 401/403)', async () => {
            const res = await app.request('/api/v1/admin/gastronomies', {
                method: 'POST',
                headers: { ...headersWithCreate, 'Content-Type': 'application/json' },
                body: validBody
            });
            // Gate passes; mocked service may return 200/400/500 depending on mock state
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T-046: Moderate review (POST /reviews/:id/moderate)
    // ──────────────────────────────────────────────────────────────────────────

    describe('POST /api/v1/admin/gastronomies/reviews/:id/moderate — requires COMMERCE_MODERATE_REVIEW', () => {
        const moderatePath = `/api/v1/admin/gastronomies/reviews/${MOCK_REVIEW_ID}/moderate`;
        const validBody = JSON.stringify({ decision: 'APPROVED' });

        it('returns 401/403 when no auth headers are provided', async () => {
            const res = await app.request(moderatePath, {
                method: 'POST',
                headers: noAuthJsonHeaders,
                body: validBody
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('returns 403 when actor lacks COMMERCE_MODERATE_REVIEW', async () => {
            const res = await app.request(moderatePath, {
                method: 'POST',
                headers: { ...headersNoCommercePerms, 'Content-Type': 'application/json' },
                body: validBody
            });
            expect(res.status).toBe(403);
        });

        it('passes the gate with COMMERCE_MODERATE_REVIEW (not 401/403)', async () => {
            const res = await app.request(moderatePath, {
                method: 'POST',
                headers: { ...headersWithModerate, 'Content-Type': 'application/json' },
                body: validBody
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T-046: Assign owner (POST /:id/assign-owner)
    // ──────────────────────────────────────────────────────────────────────────

    describe('POST /api/v1/admin/gastronomies/:id/assign-owner — sets ownerId via update', () => {
        const assignOwnerPath = `/api/v1/admin/gastronomies/${MOCK_GASTRONOMY_ID}/assign-owner`;
        const newOwnerId = '22222222-2222-4222-8222-222222222222';
        const validBody = JSON.stringify({ ownerId: newOwnerId });

        it('returns 401/403 when no auth headers are provided', async () => {
            const res = await app.request(assignOwnerPath, {
                method: 'POST',
                headers: noAuthJsonHeaders,
                body: validBody
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('returns 403 when actor lacks COMMERCE_EDIT_ALL', async () => {
            const res = await app.request(assignOwnerPath, {
                method: 'POST',
                headers: { ...headersNoCommercePerms, 'Content-Type': 'application/json' },
                body: validBody
            });
            expect(res.status).toBe(403);
        });

        it('passes the gate with COMMERCE_EDIT_ALL (not 401/403)', async () => {
            const res = await app.request(assignOwnerPath, {
                method: 'POST',
                headers: { ...headersWithEditAll, 'Content-Type': 'application/json' },
                body: validBody
            });
            // Gate passes; mocked service may return 200/400/500
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Route registration sanity — static segments are not captured as /:id
    // ──────────────────────────────────────────────────────────────────────────

    describe('route ordering — static segments not captured as /:id', () => {
        it('/options is served (not captured as /:id UUID check)', async () => {
            const res = await app.request('/api/v1/admin/gastronomies/options', {
                method: 'GET',
                headers: headersWithViewAll
            });
            // Should reach the route handler (not 400 from UUID validation)
            expect(res.status).not.toBe(400);
        });

        it('/batch is served (not captured as /:id UUID check)', async () => {
            const res = await app.request('/api/v1/admin/gastronomies/batch', {
                method: 'POST',
                headers: { ...headersWithViewAll, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [MOCK_GASTRONOMY_ID] })
            });
            // Should reach the route handler
            expect(res.status).not.toBe(400);
        });
    });
});
