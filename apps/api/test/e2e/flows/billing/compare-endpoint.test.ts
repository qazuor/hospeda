/**
 * SPEC-288 T-005 — Integration tests for POST /api/v1/protected/accommodations/compare
 *
 * Validates the entitlement and limit gates on the accommodation comparison
 * endpoint, plus happy-path response ordering and silent exclusion of
 * non-viewable items.
 *
 * Middleware chain on the route (all run BEFORE OpenAPI body validation):
 *   protectedAuthMiddleware → entitlementMiddleware → setCompareCount → gateComparator
 *
 * Gate logic in gateComparator:
 *   1. Does the actor have `can_compare_accommodations`?  No  → 403 ENTITLEMENT_REQUIRED
 *   2. Is the reported count >= `max_compare_items`?      Yes → 403 LIMIT_REACHED
 *   3. Otherwise → gate passes, OpenAPI body validation runs
 *
 * How setCompareCount compensates for checkLimit's strict-`<` semantics:
 *   checkLimit() uses `currentCount < maxAllowed` (models "I hold N, may I add one
 *   more?"). setCompareCount reports `Math.max(0, ids.length - 1)` so that the gate
 *   correctly enforces "at most max_compare_items items":
 *
 *     count = ids.length - 1
 *     gate passes when (ids.length - 1) < max  ⟺  ids.length <= max
 *
 *   Examples with production plan values:
 *     Plus (max=2): ids.length=2 → count=1, 1<2=true  → pass
 *                   ids.length=3 → count=2, 2<2=false → LIMIT_REACHED
 *     VIP  (max=4): ids.length=4 → count=3, 3<4=true  → pass
 *                   ids.length=5 → count=4, 4<4=false → LIMIT_REACHED
 *     Edge (ids=[]): count=Math.max(0,-1)=0, 0<2=true  → gate passes, schema 400
 *     Edge (ids=[1]): count=Math.max(0,0)=0, 0<2=true  → gate passes, schema 400
 *
 * Test cases:
 *   TC1 — tourist-free (no can_compare_accommodations) → 403 ENTITLEMENT_REQUIRED
 *   TC2 — tourist-plus (max=2) with 3 ids → 403 LIMIT_REACHED
 *   TC3 — tourist-vip (max=4) with 5 ids → 403 LIMIT_REACHED
 *   TC4 — tourist-plus (max=2) with exactly 2 viewable ids → 200, ordered
 *   TC5 — tourist-vip (max=4) with exactly 4 viewable ids → 200, ordered
 *   TC6 — tourist-plus with { ids: [] } or single UUID → 400 VALIDATION_ERROR
 *          (gate passes because count ≤ limit; OpenAPI schema min-2 rejects)
 *   TC7 — tourist-plus (max=2) with 1 viewable + 1 soft-deleted id → 200, 1 item
 *
 * Fixture strategy:
 *   - Plans are created in every beforeEach; testDb.clean() wipes billing_plans
 *     so re-seeding is mandatory per test.
 *   - Accommodations are inserted directly via Drizzle inside each test that
 *     needs them; the service reads them transparently.
 *   - clearEntitlementCache(customerId) is called before each request that
 *     reads from the entitlement middleware to prevent TTL artefacts.
 *
 * @module test/e2e/flows/billing/compare-endpoint
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// MP stub — must hoist before any @repo/billing import.
// The billing instance wires a MercadoPago adapter at construction time even
// though this test file does not exercise checkout or webhook flows. Without
// the stub the adapter constructor reaches for live MP credentials and throws.
// ---------------------------------------------------------------------------
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
                    'mp-stub adapter not initialized — compare-endpoint.test.ts must wire stubRef before the first request'
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
// MP stub wiring
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants
//
// Using string literals (not EntitlementKey / LimitKey enum imports) so these
// constants are free from the vi.mock intercept applied to @repo/billing above.
// Mirrors the convention in enforcement-limits.test.ts and enforcement-gates.test.ts.
// ---------------------------------------------------------------------------

const E = {
    CAN_COMPARE_ACCOMMODATIONS: 'can_compare_accommodations'
} as const;

const L = {
    MAX_COMPARE_ITEMS: 'max_compare_items'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Standard tourist actor for the compare endpoint.
 *
 * The route declares no `requiredPermissions` beyond authentication (the
 * entitlement gate is the only business rule). ACCESS_API_PUBLIC +
 * ACCESS_API_PRIVATE is the baseline set for a tourist USER.
 */
function makeTouristActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCESS_API_PRIVATE],
        userId
    );
}

// ---------------------------------------------------------------------------
// Accommodation seeding helpers
// ---------------------------------------------------------------------------

/**
 * Seed a minimal destination row required by the accommodations FK.
 * Returns the generated destination UUID.
 */
async function seedDestination(): Promise<string> {
    const destId = randomUUID();
    await testDb
        .getDb()
        .insert(destinations)
        .values({
            id: destId,
            destinationType: 'CITY',
            path: `/compare-test-dest-${destId}`,
            slug: `compare-test-dest-${destId}`,
            name: `Compare Test Dest ${destId}`,
            summary: 'Destination for compare endpoint tests',
            description: 'Destination seeded by compare-endpoint.test.ts',
            location: { country: 'AR', state: 'ER', city: 'CDU' }
        } as typeof destinations.$inferInsert);
    return destId;
}

/**
 * Seed a viewable (ACTIVE, PUBLIC, not soft-deleted) accommodation.
 * Defaults apply: lifecycleState='ACTIVE', visibility='PUBLIC',
 * ownerSuspended=false, planRestricted=false, deletedAt=null.
 *
 * Returns the generated accommodation UUID (the DB default).
 */
async function seedViewableAccommodation(ownerId: string, destinationId: string): Promise<string> {
    const id = randomUUID();
    await testDb
        .getDb()
        .insert(accommodations)
        .values({
            id,
            slug: `compare-acc-${id.slice(0, 8)}`,
            name: `Compare Test Accommodation ${id.slice(0, 8)}`,
            summary: 'Viewable accommodation for compare endpoint test',
            type: 'APARTMENT',
            description: 'Factory-inserted for compare-endpoint.test.ts',
            ownerId,
            destinationId
        } as typeof accommodations.$inferInsert);
    return id;
}

/**
 * Seed a soft-deleted accommodation (deletedAt set to now).
 * checkCanView throws NOT_FOUND for soft-deleted rows regardless of actor —
 * this is an absolute block (not bypassed even for the owner).
 *
 * Returns the generated accommodation UUID.
 */
async function seedSoftDeletedAccommodation(
    ownerId: string,
    destinationId: string
): Promise<string> {
    const id = randomUUID();
    await testDb
        .getDb()
        .insert(accommodations)
        .values({
            id,
            slug: `deleted-acc-${id.slice(0, 8)}`,
            name: `Deleted Accommodation ${id.slice(0, 8)}`,
            summary: 'Soft-deleted accommodation — must be excluded from compare response',
            type: 'APARTMENT',
            description: 'Factory-inserted soft-deleted for compare-endpoint.test.ts',
            ownerId,
            destinationId,
            deletedAt: new Date()
        } as typeof accommodations.$inferInsert);
    return id;
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a response is a 403 ENTITLEMENT_REQUIRED gate block.
 */
async function expectEntitlementRequired(res: Response): Promise<void> {
    expect(res.status, `expected 403 ENTITLEMENT_REQUIRED but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/**
 * Assert that a response is a 403 LIMIT_REACHED gate block.
 */
async function expectLimitReached(res: Response): Promise<void> {
    expect(res.status, `expected 403 LIMIT_REACHED but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LIMIT_REACHED');
}

// ---------------------------------------------------------------------------
// Compare endpoint path constant
// ---------------------------------------------------------------------------

const COMPARE_PATH = '/api/v1/protected/accommodations/compare';

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-288 T-005 — POST /api/v1/protected/accommodations/compare gates', () => {
    let app: ReturnType<typeof initApp>;

    // -----------------------------------------------------------------------
    // Plan ID variables — seeded in every beforeEach because testDb.clean()
    // in afterEach truncates billing_plans between tests.
    //
    // setCompareCount reports ids.length - 1 (clamped to 0) so that
    // checkLimit's strict `<` correctly enforces "at most max_compare_items":
    //
    //   count = Math.max(0, ids.length - 1)
    //   gate passes when count < max_compare_items  ⟺  ids.length <= max_compare_items
    //
    // Three plans mirror production billing tiers:
    //   - touristFreePlanId    — no can_compare_accommodations (TC1)
    //   - touristPlusPlanId    — max_compare_items=2 (TC2, TC4, TC6, TC7)
    //   - touristVipPlanId     — max_compare_items=4 (TC3, TC5)
    // -----------------------------------------------------------------------

    /** No can_compare_accommodations entitlement — TC1 */
    let touristFreePlanId: string;
    /** Entitlement + max_compare_items=2 (production Plus value) — TC2, TC4, TC6, TC7 */
    let touristPlusPlanId: string;
    /** Entitlement + max_compare_items=4 (production VIP value) — TC3, TC5 */
    let touristVipPlanId: string;

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

        // TC1: tourist-free — NO can_compare_accommodations entitlement
        const touristFree = await createTestPlan({
            name: `Compare-TouristFree-${randomUUID().slice(0, 8)}`,
            entitlements: ['save_favorites', 'write_reviews', 'read_reviews']
        });
        touristFreePlanId = touristFree.planId;

        // TC2/TC4/TC6/TC7: tourist-plus — max=2 (matches production TOURIST_PLUS_PLAN)
        // setCompareCount reports ids.length-1:
        //   2 ids → count=1, 1<2=true → pass (TC4/TC7)
        //   3 ids → count=2, 2<2=false → LIMIT_REACHED (TC2)
        //   0 ids → count=0, 0<2=true → pass → schema 400 (TC6a)
        //   1 id  → count=0, 0<2=true → pass → schema 400 (TC6b)
        const touristPlus = await createTestPlan({
            name: `Compare-Plus-${randomUUID().slice(0, 8)}`,
            entitlements: [
                'save_favorites',
                'write_reviews',
                'read_reviews',
                E.CAN_COMPARE_ACCOMMODATIONS
            ],
            limits: { [L.MAX_COMPARE_ITEMS]: 2 }
        });
        touristPlusPlanId = touristPlus.planId;

        // TC3/TC5: tourist-vip — max=4 (matches production TOURIST_VIP_PLAN)
        // setCompareCount reports ids.length-1:
        //   4 ids → count=3, 3<4=true → pass (TC5)
        //   5 ids → count=4, 4<4=false → LIMIT_REACHED (TC3)
        const touristVip = await createTestPlan({
            name: `Compare-Vip-${randomUUID().slice(0, 8)}`,
            entitlements: [
                'save_favorites',
                'write_reviews',
                'read_reviews',
                'ad_free',
                E.CAN_COMPARE_ACCOMMODATIONS
            ],
            limits: { [L.MAX_COMPARE_ITEMS]: 4 }
        });
        touristVipPlanId = touristVip.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // TC1 — Entitlement gate: tourist-free → ENTITLEMENT_REQUIRED
    //
    // The entitlement check in gateComparator fires before the limit check and
    // before OpenAPI body validation. Any two valid UUID strings satisfy
    // `setCompareCount`; the gate then fires and the service layer is never hit.
    // =========================================================================

    it('TC1 — tourist-free (no can_compare_accommodations) → 403 ENTITLEMENT_REQUIRED', async () => {
        // Arrange: user + active subscription on the NO-ENTITLEMENT free plan
        const user = await createTestUser({
            email: `compare-tc1-free-${randomUUID().slice(0, 8)}@example.com`
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

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act — two valid UUIDs; the gate fires before the service touches the DB
        const res = await client.post(COMPARE_PATH, {
            ids: [randomUUID(), randomUUID()]
        });

        // Assert
        await expectEntitlementRequired(res);
    });

    // =========================================================================
    // TC2 — Limit gate: tourist-plus (max=2) with 3 ids → LIMIT_REACHED
    //
    // setCompareCount: count = Math.max(0, 3-1) = 2
    // checkLimit: 2 < 2 = false → LIMIT_REACHED
    // =========================================================================

    it('TC2 — tourist-plus (max_compare_items=2) with 3 ids → 403 LIMIT_REACHED', async () => {
        // Arrange: Plus user (max=2); 3 ids → count=2, 2<2=false → LIMIT_REACHED
        const user = await createTestUser({
            email: `compare-tc2-plus-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: touristPlusPlanId,
            status: 'active'
        });
        clearEntitlementCache(customer.customerId);

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act — 3 ids exceeds Plus cap of 2
        const res = await client.post(COMPARE_PATH, {
            ids: [randomUUID(), randomUUID(), randomUUID()]
        });

        // Assert
        await expectLimitReached(res);
    });

    // =========================================================================
    // TC3 — Limit gate: tourist-vip (max=4) with 5 ids → LIMIT_REACHED
    //
    // setCompareCount: count = Math.max(0, 5-1) = 4
    // checkLimit: 4 < 4 = false → LIMIT_REACHED
    // =========================================================================

    it('TC3 — tourist-vip (max_compare_items=4) with 5 ids → 403 LIMIT_REACHED', async () => {
        // Arrange: VIP user (max=4); 5 ids → count=4, 4<4=false → LIMIT_REACHED
        const user = await createTestUser({
            email: `compare-tc3-vip-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: touristVipPlanId,
            status: 'active'
        });
        clearEntitlementCache(customer.customerId);

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act — 5 ids exceeds VIP cap of 4
        const res = await client.post(COMPARE_PATH, {
            ids: [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]
        });

        // Assert
        await expectLimitReached(res);
    });

    // =========================================================================
    // TC4 — Happy path (tourist-plus, max=2): exactly 2 viewable ids → 200
    //
    // setCompareCount: count = Math.max(0, 2-1) = 1
    // checkLimit: 1 < 2 = true → gate passes
    //
    // Verifies the handler runs and response items match the input order.
    // =========================================================================

    it('TC4 — tourist-plus happy path with exactly 2 viewable ids → 200, items ordered', async () => {
        // Arrange: Plus user (max=2); 2 ids → count=1, 1<2=true → gate passes
        const user = await createTestUser({
            email: `compare-tc4-plus-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: touristPlusPlanId,
            status: 'active'
        });
        clearEntitlementCache(customer.customerId);

        // Seed destination + 2 viewable accommodations (ACTIVE, PUBLIC by default)
        const destId = await seedDestination();
        const accId1 = await seedViewableAccommodation(user.id, destId);
        const accId2 = await seedViewableAccommodation(user.id, destId);

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act
        const res = await client.post(COMPARE_PATH, {
            ids: [accId1, accId2]
        });

        // Assert
        expect(res.status, `expected 200 but got ${res.status}`).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { items: Array<{ id: string }> };
        };
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(2);
        expect(body.data.items[0].id).toBe(accId1);
        expect(body.data.items[1].id).toBe(accId2);
    });

    // =========================================================================
    // TC5 — Happy path (tourist-vip, max=4): exactly 4 viewable ids → 200
    //
    // setCompareCount: count = Math.max(0, 4-1) = 3
    // checkLimit: 3 < 4 = true → gate passes
    // =========================================================================

    it('TC5 — tourist-vip happy path with exactly 4 viewable ids → 200, items ordered', async () => {
        // Arrange: VIP user (max=4); 4 ids → count=3, 3<4=true → gate passes
        const user = await createTestUser({
            email: `compare-tc5-vip-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: touristVipPlanId,
            status: 'active'
        });
        clearEntitlementCache(customer.customerId);

        const destId = await seedDestination();
        const accId1 = await seedViewableAccommodation(user.id, destId);
        const accId2 = await seedViewableAccommodation(user.id, destId);
        const accId3 = await seedViewableAccommodation(user.id, destId);
        const accId4 = await seedViewableAccommodation(user.id, destId);

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act
        const res = await client.post(COMPARE_PATH, {
            ids: [accId1, accId2, accId3, accId4]
        });

        // Assert
        expect(res.status, `expected 200 but got ${res.status}`).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { items: Array<{ id: string }> };
        };
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(4);
        expect(body.data.items[0].id).toBe(accId1);
        expect(body.data.items[1].id).toBe(accId2);
        expect(body.data.items[2].id).toBe(accId3);
        expect(body.data.items[3].id).toBe(accId4);
    });

    // =========================================================================
    // TC6 — Schema validation: tourist-plus with empty or single-id array → 400
    //
    // ORDERING NOTE: the middleware chain fires BEFORE OpenAPI body validation.
    // For a tourist-FREE user, { ids: [] } → setCompareCount sets count=0 →
    // gateComparator checks entitlement first → 403 ENTITLEMENT_REQUIRED (not 400).
    // For a tourist-PLUS user, the entitlement check passes and the limit check
    // passes (0 < 2), so OpenAPI validation fires and min(2) rejects.
    //
    // Edge counts with Plus (max=2):
    //   { ids: [] }    → count = Math.max(0, -1) = 0 → 0<2=true → gate passes → 400
    //   { ids: [uuid] } → count = Math.max(0,  0) = 0 → 0<2=true → gate passes → 400
    //
    // Both sub-cases use the Plus user to exercise the 400 schema-rejection path.
    // =========================================================================

    describe('TC6 — Schema validation (tourist-plus, gate passes, schema rejects)', () => {
        it('TC6a — { ids: [] } (empty array, below min=2) → 400 VALIDATION_ERROR', async () => {
            // Arrange: Plus user (max=2); count=Math.max(0,-1)=0 → 0<2=true → gate passes
            const user = await createTestUser({
                email: `compare-tc6a-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristPlusPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeTouristActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Act — empty ids array; count=0 < max_compare_items=2 → gate passes
            const res = await client.post(COMPARE_PATH, { ids: [] });

            // Assert — OpenAPI schema min(2) fires
            expect(res.status, `expected 400 but got ${res.status}`).toBe(400);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('TC6b — { ids: [singleUUID] } (one id, below min=2) → 400 VALIDATION_ERROR', async () => {
            // Arrange: Plus user (max=2); count=Math.max(0,0)=0 → 0<2=true → gate passes
            const user = await createTestUser({
                email: `compare-tc6b-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristPlusPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeTouristActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Act — single id; count=0 < max_compare_items=2 → gate passes
            const res = await client.post(COMPARE_PATH, { ids: [randomUUID()] });

            // Assert — OpenAPI schema min(2) fires
            expect(res.status, `expected 400 but got ${res.status}`).toBe(400);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // =========================================================================
    // TC7 — Silent exclusion: tourist-plus (max=2) with 1 viewable + 1 soft-deleted → 200, 1 item
    //
    // setCompareCount: count = Math.max(0, 2-1) = 1
    // checkLimit: 1 < 2 = true → gate passes
    //
    // checkCanView throws NOT_FOUND for soft-deleted rows regardless of actor —
    // the service catches the error silently and omits the item from the response.
    // The return is still 200 OK (not a partial-error status).
    // =========================================================================

    it('TC7 — tourist-plus with 1 viewable + 1 soft-deleted → 200, only viewable item returned', async () => {
        // Arrange: Plus user (max=2); 2 ids → count=1, 1<2=true → gate passes
        const user = await createTestUser({
            email: `compare-tc7-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: touristPlusPlanId,
            status: 'active'
        });
        clearEntitlementCache(customer.customerId);

        const destId = await seedDestination();
        const viewableId = await seedViewableAccommodation(user.id, destId);
        const deletedId = await seedSoftDeletedAccommodation(user.id, destId);

        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Act — 2 ids (within Plus cap=2); one is soft-deleted and will be omitted
        const res = await client.post(COMPARE_PATH, {
            ids: [viewableId, deletedId]
        });

        // Assert — 200 OK; only the viewable accommodation is in the response
        expect(res.status, `expected 200 but got ${res.status}`).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { items: Array<{ id: string }> };
        };
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0].id).toBe(viewableId);
    });
});
