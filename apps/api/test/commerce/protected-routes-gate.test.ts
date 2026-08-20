/**
 * HTTP gate tests for the owner self-service commerce routes (HOS-166 §6.3,
 * §7.2) — verifies the routes are actually mounted at
 * `/api/v1/protected/commerce` and that the permission gate is wired
 * correctly. Mirrors `test/commerce/start-subscription.test.ts` (the admin
 * route's own gate test) — deeper business logic (ownership check,
 * completeness gate, ownerId forcing) is covered by
 * `test/routes/commerce/protected/{create,start-subscription}.test.ts`.
 *
 * The test environment has no real database, so a request that passes the
 * gate is expected to fail deeper in the stack (404/422/500) — those are NOT
 * permission-gate errors. This file asserts ONLY the gate: 401/403 without
 * the right permission, not-403/not-404 with it.
 *
 * ## HOS-687 — the create routes lost their permission gate
 *
 * The two create routes now declare NO `requiredPermissions`: they are how an
 * account BECOMES a commerce owner, so requiring the owner's own permission
 * made the role unreachable. What stays enforced here is AUTHENTICATION, and
 * it stays enforced by the FACTORY (AC-8), never by a check inside the
 * handler. The start-subscription route below is untouched: it acts on a
 * listing that must already exist and still requires `COMMERCE_EDIT_OWN`.
 *
 * The 2xx half of AC-27 — a create that actually succeeds for a
 * permission-less account — is asserted in
 * `test/commerce/owner-create-open-gate.test.ts`, which mocks the service so a
 * full 201 is reachable without a database.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('Owner commerce routes — permission gate (HOS-166)', () => {
    let app: AppOpenAPI;

    const USER_AGENT = { 'user-agent': 'vitest' };
    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const noHeaders = { ...USER_AGENT };

    beforeAll(() => {
        app = initApp();
    });

    describe('POST /api/v1/protected/commerce/listings/gastronomy (create)', () => {
        const PATH = '/api/v1/protected/commerce/listings/gastronomy';
        const headersWithCreate = {
            ...USER_AGENT,
            'x-mock-actor-id': MOCK_USER_ID,
            'x-mock-actor-role': 'COMMERCE_OWNER',
            'x-mock-actor-permissions': JSON.stringify(['commerce.create'])
        };
        const headersNoCommercePerms = {
            ...USER_AGENT,
            'x-mock-actor-id': MOCK_USER_ID,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': JSON.stringify([])
        };

        // HOS-589 AC-8 — REGRESSION criterion. Anonymous is refused by the route
        // FACTORY (`createProtectedRoute` → `protectedAuthMiddleware`), which is
        // why the answer is 401 and arrives before the body is even validated.
        // It exists to catch someone replacing the factory's auth with an
        // in-handler check while stripping the permission gates.
        it('rejects an anonymous caller with 401, from the factory (AC-8)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: { ...noHeaders, 'content-type': 'application/json' },
                // A well-formed body: the refusal must come from authentication,
                // not from validation happening to fire first.
                body: JSON.stringify({
                    name: 'La Parrilla del Puerto',
                    summary: 'A riverside parrilla with fresh grilled fish and steak.',
                    description:
                        'La Parrilla del Puerto has served the waterfront for over a decade.',
                    type: 'RESTAURANT',
                    destinationId: '00000000-0000-4000-a000-000000000002'
                })
            });
            expect(res.status).toBe(401);
        });

        // HOS-589 AC-27 — the ROUTE half of the pair. The service predicate is
        // asserted separately in
        // `packages/service-core/test/services/commerce/commerce.permissions.test.ts`,
        // because both gates answer 403 from the caller's side and fixing one
        // alone would read exactly like fixing both.
        it('no longer refuses an account holding NO commerce permission (AC-27)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: { ...headersNoCommercePerms, 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'La Parrilla del Puerto',
                    summary: 'A riverside parrilla with fresh grilled fish and steak.',
                    description:
                        'La Parrilla del Puerto has served the waterfront for over a decade.',
                    type: 'RESTAURANT',
                    destinationId: '00000000-0000-4000-a000-000000000002'
                })
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });

        it('passes the gate with COMMERCE_CREATE (not 401/403)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: { ...headersWithCreate, 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'La Parrilla del Puerto',
                    summary: 'A riverside parrilla with fresh grilled fish and steak.',
                    description:
                        'La Parrilla del Puerto has served the waterfront for over a decade.',
                    type: 'RESTAURANT'
                })
            });
            // Gate passes; downstream the mocked DB/service may 404/500 — the
            // key assertion is the permission gate itself, not the full write path.
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    describe('POST /api/v1/protected/commerce/listings/experience (create)', () => {
        const PATH = '/api/v1/protected/commerce/listings/experience';
        const headersWithCreate = {
            ...USER_AGENT,
            'x-mock-actor-id': MOCK_USER_ID,
            'x-mock-actor-role': 'COMMERCE_OWNER',
            'x-mock-actor-permissions': JSON.stringify(['commerce.create'])
        };

        // AC-8 regression, experience vertical.
        it('rejects an anonymous caller with 401, from the factory (AC-8)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: { ...noHeaders, 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'Kayak tour on the Uruguay river',
                    summary: 'A guided two-hour kayak tour along the riverside.',
                    description: 'Explore the Uruguay river coastline by kayak with a local guide.',
                    type: 'TOUR_GUIDE',
                    priceFrom: 1500000,
                    priceUnit: 'per_person',
                    isPriceOnRequest: false,
                    destinationId: '00000000-0000-4000-a000-000000000002'
                })
            });
            expect(res.status).toBe(401);
        });

        // AC-27, route half, experience vertical.
        it('no longer refuses an account holding NO commerce permission (AC-27)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: {
                    ...USER_AGENT,
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-permissions': JSON.stringify([]),
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'Kayak tour on the Uruguay river',
                    summary: 'A guided two-hour kayak tour along the riverside.',
                    description: 'Explore the Uruguay river coastline by kayak with a local guide.',
                    type: 'TOUR_GUIDE',
                    priceFrom: 1500000,
                    priceUnit: 'per_person',
                    isPriceOnRequest: false,
                    destinationId: '00000000-0000-4000-a000-000000000002'
                })
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });

        it('passes the gate with COMMERCE_CREATE (not 401/403)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: { ...headersWithCreate, 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: 'Kayak tour on the Uruguay river',
                    summary: 'A guided two-hour kayak tour along the riverside.',
                    description: 'Explore the Uruguay river coastline by kayak with a local guide.',
                    type: 'TOUR_GUIDE',
                    priceFrom: 1500000,
                    priceUnit: 'per_person',
                    isPriceOnRequest: false
                })
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    describe('POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription', () => {
        const PATH = `/api/v1/protected/commerce/listings/gastronomy/${MOCK_ENTITY_ID}/start-subscription`;
        const headersWithEditOwn = {
            ...USER_AGENT,
            'x-mock-actor-id': MOCK_USER_ID,
            'x-mock-actor-role': 'COMMERCE_OWNER',
            'x-mock-actor-permissions': JSON.stringify(['commerce.editOwn']),
            'x-idempotency-key': 'test-idem-key-1'
        };
        const headersNoCommercePerms = {
            ...USER_AGENT,
            'x-mock-actor-id': MOCK_USER_ID,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': JSON.stringify([]),
            'x-idempotency-key': 'test-idem-key-2'
        };

        it('returns 400/401/403 when unauthenticated', async () => {
            const res = await app.request(PATH, { method: 'POST', headers: noHeaders });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('returns 403 when authenticated but missing COMMERCE_EDIT_OWN', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: headersNoCommercePerms
            });
            expect(res.status).toBe(403);
        });

        it('passes the gate with COMMERCE_EDIT_OWN (not 401/403 from the permission gate)', async () => {
            const res = await app.request(PATH, { method: 'POST', headers: headersWithEditOwn });
            // Gate passes; downstream the mocked DB has no listing at
            // MOCK_ENTITY_ID (404) or billing is unconfigured (503) — the key
            // assertion is the permission gate, not the full checkout flow.
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });

        it('rejects an unknown entityType at the schema boundary (not 403)', async () => {
            const res = await app.request(
                `/api/v1/protected/commerce/listings/unknown/${MOCK_ENTITY_ID}/start-subscription`,
                { method: 'POST', headers: headersWithEditOwn }
            );
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('requires X-Idempotency-Key (400 without it, once the permission gate passes)', async () => {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: {
                    ...USER_AGENT,
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': 'COMMERCE_OWNER',
                    'x-mock-actor-permissions': JSON.stringify(['commerce.editOwn'])
                    // no x-idempotency-key
                }
            });
            expect(res.status).toBe(400);
        });

        it('returns exactly 403 (never 400) when missing COMMERCE_EDIT_OWN AND missing X-Idempotency-Key — proves auth runs BEFORE idempotency', async () => {
            // Regression lock for the middleware ordering asserted in
            // `start-subscription.ts`'s router docstring: `protectedAuthMiddleware`
            // must run BEFORE `idempotencyKeyMiddleware`. If that ordering ever
            // regresses (idempotency running first), this request — which fails
            // BOTH checks — would surface 400 (IDEMPOTENCY_KEY_REQUIRED) instead
            // of 403, silently letting an unauthorized caller trigger an
            // idempotency-table write before ever being rejected.
            const res = await app.request(PATH, {
                method: 'POST',
                headers: {
                    ...USER_AGENT,
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-permissions': JSON.stringify([])
                    // no x-idempotency-key AND no COMMERCE_EDIT_OWN
                }
            });
            expect(res.status).toBe(403);
            expect(res.status).not.toBe(400);
        });
    });
});
