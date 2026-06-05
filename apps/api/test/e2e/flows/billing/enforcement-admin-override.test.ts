/**
 * SPEC-145 T-012 (e2e half) — Admin entitlement override: immediate cache effect
 *
 * Validates that the admin grant/revoke routes clear the entitlement cache
 * immediately so the customer's next request reflects the change WITHOUT any
 * manual cache-clear in the test. This is the key assertion: the routes
 * themselves (not the test harness) are responsible for cache invalidation.
 *
 * Routes under test:
 *   POST /api/v1/admin/billing/customer-entitlements/grant
 *   POST /api/v1/admin/billing/customer-entitlements/revoke
 *
 * Flow (happy-path tests):
 *   1. Customer on owner-basico plan (lacks VIEW_ADVANCED_STATS) hits the
 *      gated route → 403 ENTITLEMENT_REQUIRED.
 *   2. Admin grants view_advanced_stats via the REAL POST /grant route → 201.
 *      Customer hits the gated route immediately → NOT 403 ENTITLEMENT_REQUIRED.
 *      (No manual clearEntitlementCache() call between grant and assert —
 *       that is exactly what the test proves: the grant route cleared the cache.)
 *   3. Admin revokes via the REAL POST /revoke route → 201.
 *      Customer hits the gated route immediately → 403 ENTITLEMENT_REQUIRED.
 *      (Same: no manual cache clear in test code — the revoke route cleared it.)
 *
 * Note on method choice for revoke:
 *   Revoke uses POST (not DELETE) because the route-factory skips JSON body
 *   parsing for DELETE methods (`shouldParseBody = !(method === 'delete')`),
 *   which would cause Zod to always receive {} and return 400. POST body-carrying
 *   mutations are unambiguous and match the pattern used by customer-addons.ts.
 *
 * Sad path test:
 *   4. Grant with an unknown entitlementKey → 400.
 *
 * Actor construction:
 *   - Admin actor: createMockAdminActor with explicit permission override
 *     including ACCESS_API_ADMIN + BILLING_READ_ALL + BILLING_MANAGE.
 *     createMockAdminActor's default list does NOT include ACCESS_API_ADMIN —
 *     same pattern as admin-billing-ops.test.ts.
 *   - Customer actor: USER role with CONVERSATION_VIEW_OWN so the
 *     VIEW_ADVANCED_STATS gated route's permission guard passes before the
 *     entitlement check fires.
 *
 * Fixture strategy (mirrors enforcement-gates.test.ts):
 *   - Plan rows are re-created in every beforeEach (testDb.clean() wipes them).
 *   - Fresh user + billing customer + active subscription per test.
 *   - clearEntitlementCache(customerId) is called ONCE in beforeEach setup
 *     (after subscription creation) to start each test with a cold cache.
 *     After that, NO further cache-clear calls occur in the test body for the
 *     grant-path or revoke-path assertions.
 *
 * @module test/e2e/flows/billing/enforcement-admin-override
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// Same pattern as enforcement-gates.test.ts — the billing instance initialises
// a MercadoPago adapter at construction time even though these tests do not
// exercise checkout/webhook flows. Without the stub the adapter constructor
// reaches for live MP credentials and throws.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — enforcement-admin-override.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor, createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// ---------------------------------------------------------------------------
// MP stub (required even though no checkout/webhook path is exercised)
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants
//
// Copied as string literals so we avoid importing from @repo/billing —
// the vi.mock intercept is file-scoped. String values keep plan fixture
// creation free from any mock entanglement.
// ---------------------------------------------------------------------------
const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats',
    VIEW_ADVANCED_STATS: 'view_advanced_stats'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Customer actor for the VIEW_ADVANCED_STATS gated route.
 * Needs CONVERSATION_VIEW_OWN so the route-level permission guard passes
 * before the entitlement gate fires.
 */
function makeStatsActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.CONVERSATION_VIEW_OWN
        ],
        userId
    );
}

/**
 * Admin actor with the permissions required to call the billing admin routes.
 *
 * createMockAdminActor's default permission list does NOT include
 * ACCESS_API_ADMIN. The explicit override matches the pattern established by
 * admin-billing-ops.test.ts:156-172 and spec-164-admin-billing-authz.test.ts.
 *
 * Permissions required:
 *   - ACCESS_API_ADMIN      — the admin route tier permission guard
 *   - BILLING_READ_ALL      — adminBillingAuthMiddleware base read gate
 *   - BILLING_MANAGE        — the per-route `isMoneyMove` gate in
 *                             adminBillingAuthMiddleware (path includes
 *                             '/entitlements') + createAdminRoute
 *                             requiredPermissions: [BILLING_MANAGE]
 */
function makeAdminActor(adminUserId: string): Actor {
    return createMockAdminActor({
        id: adminUserId,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_READ_ALL,
            PermissionEnum.BILLING_MANAGE
        ]
    });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert a response is a 403 ENTITLEMENT_REQUIRED gate block.
 */
async function expectEntitlementBlock(res: Response): Promise<void> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/**
 * Assert the gate passed (response is NOT 403 ENTITLEMENT_REQUIRED).
 */
async function expectGatePassed(res: Response): Promise<void> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Gate should have passed but got 403 ENTITLEMENT_REQUIRED'
        ).not.toBe('ENTITLEMENT_REQUIRED');
    }
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-012 (e2e) — admin entitlement override with immediate cache effect', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Happy path: grant → 201 → cache cleared → gated route passes immediately;
    //             revoke → 201 → cache cleared → gated route blocks again.
    //
    // Both paths are tested via the REAL HTTP POST routes. No manual cache
    // clears occur after setup — the routes themselves handle cache invalidation.
    // This is the contract being tested.
    // =========================================================================

    it('grant lifts gate immediately (no manual cache clear between grant and assert)', async () => {
        mpStub.config.reset();

        // ── Arrange: owner-basico plan (lacks VIEW_ADVANCED_STATS) ─────────────
        const ownerBasico = await createTestPlan({
            name: `Override-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS]
            // VIEW_ADVANCED_STATS intentionally absent
        });

        const customerUser = await createTestUser({
            email: `override-customer-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: customerUser.id,
            email: customerUser.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerBasico.planId,
            status: 'active'
        });
        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const adminUser = await createTestUser({
            email: `override-admin-${randomUUID().slice(0, 8)}@example.com`
        });

        const customerClient = new E2EApiClient(app, makeStatsActor(customerUser.id));
        const adminClient = new E2EApiClient(app, makeAdminActor(adminUser.id));

        const gatedRoute = '/api/v1/protected/accommodations/my/favorites-breakdown';

        // ── Step 1: confirm gate is BLOCKING before any grant ──────────────────
        const before = await customerClient.get(gatedRoute);
        await expectEntitlementBlock(before);

        // ── Step 2: admin grants VIEW_ADVANCED_STATS via the REAL POST route ───
        // The grant route calls clearEntitlementCache(customerId) internally.
        // NO manual cache clear is called here — this is the key assertion.
        const grantRes = await adminClient.post(
            '/api/v1/admin/billing/customer-entitlements/grant',
            {
                customerId: customer.customerId,
                entitlementKey: E.VIEW_ADVANCED_STATS
            }
        );

        // POST /grant uses createAdminRoute which returns 201 Created for POST.
        expect(grantRes.status, `Grant route returned ${grantRes.status} — expected 201`).toBe(201);
        const grantBody = (await grantRes.json()) as {
            success: boolean;
            data: { entitlementKey: string };
        };
        expect(grantBody.success).toBe(true);
        expect(grantBody.data.entitlementKey).toBe(E.VIEW_ADVANCED_STATS);

        // ── Step 3: gated route PASSES immediately after grant ─────────────────
        // NO clearEntitlementCache() call between grant and this request.
        // The grant route cleared the cache; this request loads fresh entitlements
        // that now include VIEW_ADVANCED_STATS. This IS the key assertion.
        const afterGrant = await customerClient.get(gatedRoute);
        await expectGatePassed(afterGrant);
        expect(
            afterGrant.status,
            'Expected 200 after grant — entitlement gate should have passed'
        ).toBe(200);
        const afterGrantBody = (await afterGrant.json()) as {
            success: boolean;
            data: unknown[];
        };
        expect(afterGrantBody.success).toBe(true);
        expect(Array.isArray(afterGrantBody.data)).toBe(true);
    });

    it('revoke restores block immediately (real POST /revoke route — no manual cache clear after revoke)', async () => {
        mpStub.config.reset();

        // ── Arrange: owner-basico plan (lacks VIEW_ADVANCED_STATS) ─────────────
        const ownerBasico = await createTestPlan({
            name: `Override-Revoke-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS]
        });

        const customerUser = await createTestUser({
            email: `override-revoke-cust-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: customerUser.id,
            email: customerUser.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerBasico.planId,
            status: 'active'
        });
        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const adminUser = await createTestUser({
            email: `override-revoke-admin-${randomUUID().slice(0, 8)}@example.com`
        });

        const customerClient = new E2EApiClient(app, makeStatsActor(customerUser.id));
        const adminClient = new E2EApiClient(app, makeAdminActor(adminUser.id));

        const gatedRoute = '/api/v1/protected/accommodations/my/favorites-breakdown';

        // ── Step 1: confirm gate is BLOCKING before grant ──────────────────────
        const before = await customerClient.get(gatedRoute);
        await expectEntitlementBlock(before);

        // ── Step 2: admin grants VIEW_ADVANCED_STATS via the REAL POST route ───
        // The grant route calls clearEntitlementCache(customerId) internally.
        // NO manual cache clear after this point.
        const grantRes = await adminClient.post(
            '/api/v1/admin/billing/customer-entitlements/grant',
            {
                customerId: customer.customerId,
                entitlementKey: E.VIEW_ADVANCED_STATS
            }
        );
        expect(grantRes.status, `Grant route returned ${grantRes.status} — expected 201`).toBe(201);

        // Gate passes after grant (no manual cache clear — grant route cleared it).
        const afterGrant = await customerClient.get(gatedRoute);
        await expectGatePassed(afterGrant);
        expect(afterGrant.status).toBe(200);

        // ── Step 3: admin revokes VIEW_ADVANCED_STATS via the REAL POST route ──
        // The revoke route calls clearEntitlementCache(customerId) internally.
        // NO manual cache clear after this — that is exactly what the test proves.
        const revokeRes = await adminClient.post(
            '/api/v1/admin/billing/customer-entitlements/revoke',
            {
                customerId: customer.customerId,
                entitlementKey: E.VIEW_ADVANCED_STATS
            }
        );
        expect(revokeRes.status, `Revoke route returned ${revokeRes.status} — expected 201`).toBe(
            201
        );

        // ── Step 4: gate blocks again immediately after revoke ─────────────────
        // No clearEntitlementCache() call between revoke and this request.
        // The revoke route cleared the cache; this is the key assertion.
        const afterRevoke = await customerClient.get(gatedRoute);
        await expectEntitlementBlock(afterRevoke);
    });

    // =========================================================================
    // Sad path: unknown entitlement key → 400
    // =========================================================================

    it('grant with an unknown entitlementKey → 400', async () => {
        mpStub.config.reset();

        // Minimal setup: just need an admin actor.
        const adminUser = await createTestUser({
            email: `override-admin-sad-${randomUUID().slice(0, 8)}@example.com`
        });
        const adminClient = new E2EApiClient(app, makeAdminActor(adminUser.id));

        // The Zod schema on GrantEntitlementBodySchema validates entitlementKey
        // against isEntitlementKey(). An unknown string must be rejected before
        // reaching the billing adapter.
        const res = await adminClient.post('/api/v1/admin/billing/customer-entitlements/grant', {
            customerId: randomUUID(), // valid UUID format, does not need to exist
            entitlementKey: 'this_is_not_a_real_entitlement_key'
        });

        expect(res.status, `expected 400 but got ${res.status}`).toBe(400);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(false);
    });

    // =========================================================================
    // Sad path: unknown customerId → 404
    // =========================================================================

    it('grant with a non-existent customerId → 404', async () => {
        mpStub.config.reset();

        // Minimal setup: admin actor only — no billing customer created.
        const adminUser = await createTestUser({
            email: `override-admin-nocust-${randomUUID().slice(0, 8)}@example.com`
        });
        const adminClient = new E2EApiClient(app, makeAdminActor(adminUser.id));

        // A random UUID that was never registered as a billing customer.
        // The grant route validates existence via billing.customers.get() and
        // must return 404 rather than propagating to the billing adapter.
        const res = await adminClient.post('/api/v1/admin/billing/customer-entitlements/grant', {
            customerId: randomUUID(),
            entitlementKey: E.VIEW_ADVANCED_STATS
        });

        expect(res.status, `expected 404 but got ${res.status}`).toBe(404);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(false);
    });
});
