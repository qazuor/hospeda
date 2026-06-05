/**
 * SPEC-145 T-007 + T-016 — Staff billing bypass (INV-6)
 *
 * Validates that platform staff roles (SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER)
 * bypass ALL billing entitlement and limit gates unconditionally — they receive the
 * unlimited entitlement set via {@link buildStaffUnlimitedResult} before any
 * billing-customer or plan lookup runs.
 *
 * The bypass is defined in {@link entitlementMiddleware} at
 * `apps/api/src/middlewares/entitlement.ts:~526-542`. The check fires before
 * `billingEnabled`, before the customer-keyed cache, and before any QZPay call.
 *
 * Test strategy:
 *   Two actors, one gated route (`GET /accommodations/my/favorites-breakdown`
 *   requires VIEW_ADVANCED_STATS), opposite outcomes:
 *
 *   1. tourist-free actor (USER role, lacks VIEW_ADVANCED_STATS) → 403 ENTITLEMENT_REQUIRED.
 *   2. EDITOR actor (staff role, no billing customer row) → NOT 403 ENTITLEMENT_REQUIRED.
 *      The route passes the entitlement gate and returns 200 with the breakdown array.
 *
 *   Additionally, one limit test: the MAX_ACCOMMODATIONS cap (1) applies to the
 *   USER/owner-basico actor but the EDITOR actor has -1 (unlimited) and therefore
 *   POST /accommodations/draft with 1 existing row does NOT produce LIMIT_REACHED.
 *
 * Fixture strategy (mirrors enforcement-gates.test.ts):
 *   - Plan rows are re-created in every beforeEach (testDb.clean() wipes billing_plans).
 *   - A fresh user + billing customer + subscription is made per test.
 *   - Staff actor has NO billing customer row — the bypass fires before any customer lookup.
 *   - clearEntitlementCache is called before requests to prevent stale TTL artefacts.
 *
 * @module test/e2e/flows/billing/enforcement-staff-bypass
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
                    'mp-stub adapter not initialized — enforcement-staff-bypass.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, destinations } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor } from '../../../helpers/auth.js';
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
// the vi.mock intercept is file-scoped and the billing module is mocked
// for the MP adapter. Using string values directly keeps plan fixture
// creation free from any mock entanglement.
// ---------------------------------------------------------------------------
const E = {
    WRITE_REVIEWS: 'write_reviews',
    SAVE_FAVORITES: 'save_favorites',
    READ_REVIEWS: 'read_reviews',
    CAN_VIEW_RECOMMENDATIONS: 'can_view_recommendations',
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats'
} as const;

// ---------------------------------------------------------------------------
// Limit key strings
// ---------------------------------------------------------------------------
const L = {
    MAX_ACCOMMODATIONS: 'max_accommodations'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Tourist-free USER actor for the gated VIEW_ADVANCED_STATS route.
 * Needs CONVERSATION_VIEW_OWN so the route-level permission guard passes
 * before the entitlement gate fires. Without it the route returns a
 * 403 FORBIDDEN (different code), not 403 ENTITLEMENT_REQUIRED.
 */
function makeTouristStatsActor(userId: string): Actor {
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
 * EDITOR staff actor for the same gated route.
 *
 * EDITOR is one of the four roles in STAFF_BILLING_BYPASS_ROLES
 * (entitlement.ts:302-307). The bypass runs before any billing-customer or
 * plan lookup, so no billing customer row is needed for this actor.
 *
 * CONVERSATION_VIEW_OWN is included so the route-level permission guard
 * passes exactly as for the tourist actor — the only variable is the role
 * (USER vs EDITOR), which drives the staff-bypass decision.
 */
function makeEditorStaffActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.EDITOR,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.CONVERSATION_VIEW_OWN
        ],
        userId
    );
}

/**
 * USER actor for accommodation creation limit tests.
 * Needs ACCOMMODATION_CREATE so the route-level permission guard passes.
 */
function makeAccommodationCreateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_CREATE
        ],
        userId
    );
}

/**
 * EDITOR staff actor for the accommodation create route.
 * Same permission set as makeAccommodationCreateActor, but role=EDITOR
 * triggers the staff bypass in entitlementMiddleware.
 */
function makeEditorAccommodationCreateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.EDITOR,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_CREATE
        ],
        userId
    );
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
 * Assert that a response is NOT a 403 ENTITLEMENT_REQUIRED gate block.
 * The gate passed — any other status is acceptable.
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

/**
 * Assert that a response is NOT a 403 LIMIT_REACHED block.
 */
async function expectLimitGatePassed(res: Response): Promise<void> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Limit gate should have passed but got 403 LIMIT_REACHED'
        ).not.toBe('LIMIT_REACHED');
    }
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-007/T-016 — staff billing bypass (INV-6)', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan IDs — seeded in every beforeEach so they survive the
    // per-test afterEach → testDb.clean() truncation cycle.
    let touristFreePlanId: string;
    let ownerBasicoPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // tourist-free: has WRITE_REVIEWS/SAVE_FAVORITES but NOT VIEW_ADVANCED_STATS
        const touristFree = await createTestPlan({
            name: `Bypass-TouristFree-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.WRITE_REVIEWS,
                E.SAVE_FAVORITES,
                E.READ_REVIEWS,
                E.CAN_VIEW_RECOMMENDATIONS
            ]
        });
        touristFreePlanId = touristFree.planId;

        // owner-basico: PUBLISH + EDIT + VIEW_BASIC, MAX_ACCOMMODATIONS=1
        // Used for the limit bypass test: a USER on this plan hits LIMIT_REACHED
        // at cap=1, but an EDITOR bypasses it entirely.
        const ownerBasico = await createTestPlan({
            name: `Bypass-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS],
            limits: { [L.MAX_ACCOMMODATIONS]: 1 }
        });
        ownerBasicoPlanId = ownerBasico.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Entitlement gate bypass
    //
    // Route: GET /api/v1/protected/accommodations/my/favorites-breakdown
    // Requires VIEW_ADVANCED_STATS.
    // tourist-free USER plan lacks VIEW_ADVANCED_STATS → 403 ENTITLEMENT_REQUIRED.
    // EDITOR role → staff bypass → unlimited entitlements → gate passes → 200.
    // =========================================================================

    describe('Entitlement gate — VIEW_ADVANCED_STATS', () => {
        it('USER on tourist-free plan → 403 ENTITLEMENT_REQUIRED (confirms the gate is wired)', async () => {
            // Arrange: USER + tourist-free subscription (no VIEW_ADVANCED_STATS)
            const user = await createTestUser({
                email: `bypass-tourist-ent-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristFreePlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeTouristStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Act
            const res = await client.get('/api/v1/protected/accommodations/my/favorites-breakdown');

            // Assert: gate fired as expected for a non-staff actor without the entitlement.
            await expectEntitlementBlock(res);
        });

        it('EDITOR (staff) with no billing customer → NOT 403 ENTITLEMENT_REQUIRED → 200 (bypass active)', async () => {
            // Arrange: EDITOR actor with NO billing customer row.
            // The staff bypass in entitlementMiddleware fires before any customer lookup,
            // granting unlimited entitlements. VIEW_ADVANCED_STATS is included.
            const editorUser = await createTestUser({
                email: `bypass-editor-ent-${randomUUID().slice(0, 8)}@example.com`
            });
            // Deliberately: no createTestBillingCustomer() call. Staff bypass is
            // unconditional — it must not require a customer row to be present.

            const actor = makeEditorStaffActor(editorUser.id);
            const client = new E2EApiClient(app, actor);

            // Act
            const res = await client.get('/api/v1/protected/accommodations/my/favorites-breakdown');

            // Assert: gate passed (not 403 ENTITLEMENT_REQUIRED).
            await expectGatePassed(res);

            // The handler runs with an EDITOR that has no accommodation data —
            // returns 200 with an empty breakdown array.
            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean; data: unknown[] };
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });
    });

    // =========================================================================
    // Limit gate bypass
    //
    // Route: POST /api/v1/protected/accommodations/draft
    // Limit: MAX_ACCOMMODATIONS = 1 (owner-basico plan).
    //
    // USER on owner-basico with 1 existing accommodation row → 403 LIMIT_REACHED.
    // EDITOR (staff) with 1 existing accommodation row → limit gate bypassed → not LIMIT_REACHED.
    // =========================================================================

    describe('Limit gate — MAX_ACCOMMODATIONS', () => {
        it('USER on owner-basico at cap (1 row) → 403 LIMIT_REACHED (confirms the gate is wired)', async () => {
            // Arrange: USER + owner-basico subscription (MAX_ACCOMMODATIONS=1) + 1 existing row
            const user = await createTestUser({
                email: `bypass-user-lim-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerBasicoPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // Seed a destination so the accommodation FK can be satisfied.
            const destId = randomUUID();
            await testDb
                .getDb()
                .insert(destinations)
                .values({
                    id: destId,
                    destinationType: 'CITY',
                    path: `/test-dest-bypass-${destId}`,
                    slug: `test-dest-bypass-${destId}`,
                    name: `Bypass Limit Test Dest ${destId}`,
                    summary: 'Bypass limit test destination',
                    description: 'Bypass limit test destination description',
                    location: { country: 'AR', state: 'ER', city: 'CDU' }
                } as typeof destinations.$inferInsert);

            // Factory-insert 1 accommodation at the cap.
            await testDb
                .getDb()
                .insert(accommodations)
                .values({
                    slug: `bypass-lim-test-${randomUUID().slice(0, 8)}`,
                    name: 'At-cap accommodation',
                    summary: 'At-cap for bypass limit test',
                    type: 'APARTMENT',
                    description: 'Factory-inserted for bypass limit test',
                    ownerId: user.id,
                    destinationId: destId
                } as typeof accommodations.$inferInsert);

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Act: (N+1)th attempt → must be blocked for a USER at cap.
            const res = await client.post('/api/v1/protected/accommodations/draft', {
                name: 'Should be blocked at cap',
                summary: 'Bypass limit test',
                type: 'APARTMENT',
                destinationId: destId
            });

            // Assert: limit gate fired.
            expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('LIMIT_REACHED');
        });

        it('EDITOR (staff) with 1 existing accommodation (at normal cap) → limit gate bypassed → NOT 403 LIMIT_REACHED', async () => {
            // Arrange: EDITOR actor with NO billing customer row.
            // Staff bypass grants MAX_ACCOMMODATIONS=-1 (unlimited) before
            // the count-enforcement middleware even reads the limits Map.
            const editorUser = await createTestUser({
                email: `bypass-editor-lim-${randomUUID().slice(0, 8)}@example.com`
            });
            // No createTestBillingCustomer() — bypass is unconditional.

            // Seed a destination for the accommodation FK.
            const destId = randomUUID();
            await testDb
                .getDb()
                .insert(destinations)
                .values({
                    id: destId,
                    destinationType: 'CITY',
                    path: `/test-dest-edlim-${destId}`,
                    slug: `test-dest-edlim-${destId}`,
                    name: `Bypass Editor Limit Dest ${destId}`,
                    summary: 'Bypass editor limit test destination',
                    description: 'Bypass editor limit test destination description',
                    location: { country: 'AR', state: 'ER', city: 'CDU' }
                } as typeof destinations.$inferInsert);

            // Factory-insert 1 accommodation with ownerId=editorUser.id
            // (mirrors the "at cap" scenario but for the EDITOR's user id).
            await testDb
                .getDb()
                .insert(accommodations)
                .values({
                    slug: `bypass-ed-lim-test-${randomUUID().slice(0, 8)}`,
                    name: 'Editor at cap accommodation',
                    summary: 'At-cap for EDITOR bypass test',
                    type: 'APARTMENT',
                    description: 'Factory-inserted for EDITOR bypass limit test',
                    ownerId: editorUser.id,
                    destinationId: destId
                } as typeof accommodations.$inferInsert);

            const actor = makeEditorAccommodationCreateActor(editorUser.id);
            const client = new E2EApiClient(app, actor);

            // Act: same "N+1" attempt — must NOT be blocked for staff.
            const res = await client.post('/api/v1/protected/accommodations/draft', {
                name: 'Staff bypass — not blocked at cap',
                summary: 'Bypass limit test for staff',
                type: 'APARTMENT',
                destinationId: destId
            });

            // Assert: limit gate did NOT fire.
            await expectLimitGatePassed(res);
        });
    });
});
