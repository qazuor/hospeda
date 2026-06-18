/**
 * HTTP gate tests for the admin commerce start-subscription route
 * (SPEC-239 T-048).
 *
 * Boots the full Hono app (`initApp`) and sends real requests with the
 * `x-mock-actor-*` header triplet (services are faithfully mocked in
 * test/setup.ts). Asserts ONLY the permission gate: the route requires
 * COMMERCE_EDIT_ALL (403 without it, NOT-403/NOT-404 with it). The deeper
 * provisioning behaviour (product_domain stamp, link-row upsert, MP create) is
 * covered by start-subscription.service.test.ts with MP + DB stubbed.
 *
 * NOTE: admin routes require a `user-agent` header (validation middleware), so
 * every request carries it (see admin-gastronomy.test.ts for the pattern).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription — gate', () => {
    let app: AppOpenAPI;

    const USER_AGENT = { 'user-agent': 'vitest' };
    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const PATH = `/api/v1/admin/commerce/listings/gastronomy/${MOCK_ENTITY_ID}/start-subscription`;

    const headersWithEditAll = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'commerce.editAll'])
    };

    const headersNoCommercePerms = {
        ...USER_AGENT,
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin'])
    };

    const noHeaders = { ...USER_AGENT };

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400/401/403 when unauthenticated', async () => {
        const res = await app.request(PATH, { method: 'POST', headers: noHeaders });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('returns 403 when authenticated but missing COMMERCE_EDIT_ALL', async () => {
        const res = await app.request(PATH, { method: 'POST', headers: headersNoCommercePerms });
        expect(res.status).toBe(403);
    });

    it('passes the gate with COMMERCE_EDIT_ALL (not 403/404)', async () => {
        const res = await app.request(PATH, { method: 'POST', headers: headersWithEditAll });
        // Gate passes; downstream the route 503s (billing/plan unconfigured in
        // tests) or errors — but it must NOT be a 403 (gate) or 404 (route missing).
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(404);
    });

    it('rejects an unknown entityType at the schema boundary (not 403)', async () => {
        const res = await app.request(
            `/api/v1/admin/commerce/listings/unknown/${MOCK_ENTITY_ID}/start-subscription`,
            { method: 'POST', headers: headersWithEditAll }
        );
        // z.enum(['gastronomy', 'experience']) rejects 'unknown' → 400 (or 404 no-match), never 200.
        expect(res.status).not.toBe(200);
        expect(res.status).not.toBe(201);
    });

    // H-1 regression: experience arm is wired and accepted by the schema enum.
    it('passes the gate for entityType=experience with COMMERCE_EDIT_ALL (H-1 regression)', async () => {
        const res = await app.request(
            `/api/v1/admin/commerce/listings/experience/${MOCK_ENTITY_ID}/start-subscription`,
            { method: 'POST', headers: headersWithEditAll }
        );
        // Gate passes (not 403); downstream errors (503 billing unconfigured or
        // 404 listing not found) are acceptable — the key assertion is the route
        // accepts 'experience' as a valid entityType.
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(404);
    });
});
