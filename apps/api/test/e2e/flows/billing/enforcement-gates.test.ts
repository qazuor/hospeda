/**
 * SPEC-145 T-012 + T-013 — Entitlement enforcement gates: BLOCK and ALLOW
 *
 * Validates every wired entitlement gate (committed in SPEC-145) through the REAL
 * middleware stack end-to-end. No mocking of `requireEntitlement` or the entitlement
 * middleware — the point is to exercise the full chain:
 *
 *   request → actorMiddleware → billingCustomerMiddleware → entitlementMiddleware
 *           → requireEntitlement(key) → handler (only reached on ALLOW)
 *
 * Gates under test (one BLOCK + one ALLOW pair per gate):
 *
 *  1. PUBLISH_ACCOMMODATIONS
 *     - Route: POST /api/v1/protected/accommodations/draft (createDraft)
 *     - Route: POST /api/v1/protected/host-onboarding/start
 *     - BLOCK plan:  tourist-free (has WRITE_REVIEWS, lacks PUBLISH_ACCOMMODATIONS)
 *     - ALLOW plan:  owner-basico (has PUBLISH_ACCOMMODATIONS)
 *
 *  2. EDIT_ACCOMMODATION_INFO
 *     - Route: PUT  /api/v1/protected/accommodations/:id (update)
 *     - Route: PATCH /api/v1/protected/accommodations/:id (patch)
 *     - Route: POST /api/v1/protected/accommodations/:id/faqs (addFaq)
 *     - BLOCK plan:  tourist-free (lacks EDIT_ACCOMMODATION_INFO)
 *     - ALLOW plan:  owner-basico (has EDIT_ACCOMMODATION_INFO)
 *
 *  3. CREATE_PROMOTIONS
 *     - Route: POST  /api/v1/protected/owner-promotions (create)
 *     - Route: PATCH /api/v1/protected/owner-promotions/:id (patch)
 *     - BLOCK plan:  owner-basico (has PUBLISH/EDIT but NOT CREATE_PROMOTIONS)
 *     - ALLOW plan:  owner-pro (has CREATE_PROMOTIONS)
 *
 *  4. WRITE_REVIEWS
 *     - Route: POST /api/v1/protected/accommodations/:id/reviews (accom review)
 *     - Route: POST /api/v1/protected/destinations/:id/reviews (dest review)
 *     - BLOCK plan:  owner-basico (owner plan — lacks WRITE_REVIEWS)
 *     - ALLOW plan:  tourist-free (has WRITE_REVIEWS)
 *
 *  5. VIEW_ADVANCED_STATS
 *     - Route: GET /api/v1/protected/accommodations/my/favorites-breakdown
 *     - Route: GET /api/v1/protected/accommodations/my/market-comparison
 *     - BLOCK plan:  owner-basico (VIEW_BASIC_STATS only, no VIEW_ADVANCED_STATS)
 *     - ALLOW plan:  owner-pro (has VIEW_ADVANCED_STATS)
 *
 *  6. VIEW_BASIC_STATS
 *     - Route: GET /api/v1/protected/conversations/me/response-rate
 *     - Route: GET /api/v1/protected/conversations/me/monthly-inquiries
 *     - BLOCK plan:  tourist-free (lacks VIEW_BASIC_STATS)
 *     - ALLOW plan:  owner-basico (has VIEW_BASIC_STATS)
 *
 * Fixture strategy:
 *   - ALL plan rows are created in the outer `beforeEach` so they survive the
 *     per-test `afterEach → testDb.clean()` truncation cycle. Each test that
 *     needs a specific plan accesses the shared planId variables.
 *   - A fresh user + billing customer + subscription is created per test so
 *     each test operates on an isolated actor with a clean entitlement cache.
 *   - For mutating BLOCK routes: pin that the relevant table row count is
 *     unchanged (DB mutation never happened).
 *   - For mutating ALLOW routes: assert the gate did NOT fire (status ≠ 403
 *     ENTITLEMENT_REQUIRED). The service may return 4xx for missing FK/resource
 *     since we pass random UUIDs — that is post-gate behaviour and acceptable.
 *   - For read ALLOW routes: assert 200 + response shape (these are safe to run
 *     with an actor that has zero data; the endpoints are gap-filled or return []).
 *
 * @module test/e2e/flows/billing/enforcement-gates
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter. The billing instance
// initializes a MercadoPago adapter at construction time even though these
// tests do not exercise a checkout/webhook path — without the stub the
// adapter constructor reaches for live MP credentials and throws.
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
                    'mp-stub adapter not initialized — enforcement-gates.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, ownerPromotions } from '@repo/db';
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

// Initialize MP stub once; reset per test via mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants
//
// Copied as string literals so we avoid importing from @repo/billing in the
// test body — the vi.mock intercept is file-scoped and the billing module is
// mocked for the MP adapter. Using the string values directly keeps plan
// fixture creation free from any mock entanglement.
// ---------------------------------------------------------------------------
const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats',
    VIEW_ADVANCED_STATS: 'view_advanced_stats',
    CREATE_PROMOTIONS: 'create_promotions',
    WRITE_REVIEWS: 'write_reviews',
    SAVE_FAVORITES: 'save_favorites',
    READ_REVIEWS: 'read_reviews',
    CAN_VIEW_RECOMMENDATIONS: 'can_view_recommendations'
} as const;

// ---------------------------------------------------------------------------
// Permission helpers
//
// Each actor needs the correct PermissionEnum flags so the route-level
// permission guard passes BEFORE the entitlement gate fires. Without the
// route-level permission, the route returns 403 FORBIDDEN (different code)
// rather than 403 ENTITLEMENT_REQUIRED, which would give a false block reading.
// ---------------------------------------------------------------------------

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

function makeAccommodationUpdateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            // ACCOMMODATION_UPDATE_ANY bypasses the ownership check so any user can
            // update any accommodation in tests without seeding an ownership row.
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ],
        userId
    );
}

function makeOwnerPromotionActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.OWNER_PROMOTION_CREATE,
            PermissionEnum.OWNER_PROMOTION_UPDATE
        ],
        userId
    );
}

function makeReviewActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
            PermissionEnum.DESTINATION_REVIEW_CREATE
        ],
        userId
    );
}

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

// ---------------------------------------------------------------------------
// Minimal valid request body fixtures
// Only fields required by the relevant Zod schema are provided.
// ---------------------------------------------------------------------------

const REVIEW_BODY = {
    rating: {
        cleanliness: 4,
        hospitality: 4,
        services: 4,
        accuracy: 4,
        communication: 4,
        location: 4
    }
};

const DESTINATION_REVIEW_BODY = {
    rating: {
        landscape: 4,
        attractions: 4,
        accessibility: 4,
        safety: 4,
        cleanliness: 4,
        hospitality: 4,
        culturalOffer: 4,
        gastronomy: 4,
        affordability: 4,
        nightlife: 4,
        infrastructure: 4,
        environmentalCare: 4,
        wifiAvailability: 4,
        shopping: 4
    }
};

const PROMOTION_BODY = {
    title: 'Test Promotion Gate',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: new Date(Date.now() + 86400000).toISOString()
};

const FAQ_BODY = {
    question: 'What is the check-in time at this property?',
    answer: 'Check-in is available from 2pm onwards.',
    category: null
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert a response is a 403 ENTITLEMENT_REQUIRED gate block.
 *
 * The global `createErrorHandler` maps ServiceError(ENTITLEMENT_REQUIRED)
 * to `{ success: false, error: { code: 'ENTITLEMENT_REQUIRED', ... } }`.
 */
async function expectEntitlementBlock(res: Response): Promise<void> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/**
 * Assert that a response is NOT a 403 ENTITLEMENT_REQUIRED gate block.
 * The gate passed — any other status is acceptable (service may return 404, etc.).
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

describe('SPEC-145 T-012 + T-013 — enforcement gates BLOCK/ALLOW', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan IDs — populated by outer beforeEach, consumed per test.
    // Plans are re-created each test because testDb.clean() wipes billing_plans.
    let touristFreePlanId: string;
    let ownerBasicoPlanId: string;
    let ownerProPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    // Plans are seeded in EVERY beforeEach so they survive the per-test
    // testDb.clean() truncation that runs in afterEach. Creating them here
    // (outer scope) means every test has fresh billing_plans rows to read.
    beforeEach(async () => {
        mpStub.config.reset();

        // tourist-free: WRITE_REVIEWS, no host entitlements
        const touristFree = await createTestPlan({
            name: `Gate-TouristFree-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.WRITE_REVIEWS,
                E.SAVE_FAVORITES,
                E.READ_REVIEWS,
                E.CAN_VIEW_RECOMMENDATIONS
            ]
        });
        touristFreePlanId = touristFree.planId;

        // owner-basico: PUBLISH + EDIT + VIEW_BASIC, no CREATE_PROMOTIONS / VIEW_ADVANCED
        const ownerBasico = await createTestPlan({
            name: `Gate-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS]
        });
        ownerBasicoPlanId = ownerBasico.planId;

        // owner-pro: owner-basico + VIEW_ADVANCED + CREATE_PROMOTIONS
        const ownerPro = await createTestPlan({
            name: `Gate-OwnerPro-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.PUBLISH_ACCOMMODATIONS,
                E.EDIT_ACCOMMODATION_INFO,
                E.VIEW_BASIC_STATS,
                E.VIEW_ADVANCED_STATS,
                E.CREATE_PROMOTIONS
            ]
        });
        ownerProPlanId = ownerPro.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Gate 1: PUBLISH_ACCOMMODATIONS
    // =========================================================================

    describe('Gate 1: PUBLISH_ACCOMMODATIONS', () => {
        it('BLOCK — tourist plan → POST /accommodations/draft → 403 ENTITLEMENT_REQUIRED, no accommodation row created', async () => {
            const user = await createTestUser({
                email: `g1-block-draft-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const countBefore = (await testDb.getDb().select().from(accommodations)).length;

            const res = await client.post('/api/v1/protected/accommodations/draft', {
                name: 'Gate Test Draft',
                summary: 'Minimal summary for gate block test',
                type: 'APARTMENT',
                destinationId: randomUUID()
            });

            await expectEntitlementBlock(res);
            const countAfter = (await testDb.getDb().select().from(accommodations)).length;
            expect(countAfter).toBe(countBefore);
        });

        it('BLOCK — tourist plan → POST /host-onboarding/start → 403 ENTITLEMENT_REQUIRED, no accommodation row created', async () => {
            const user = await createTestUser({
                email: `g1-block-onb-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const countBefore = (await testDb.getDb().select().from(accommodations)).length;

            const res = await client.post('/api/v1/protected/host-onboarding/start', {
                name: 'Gate Test Onboarding',
                summary: 'Minimal summary for gate block test',
                type: 'APARTMENT',
                destinationId: randomUUID()
            });

            await expectEntitlementBlock(res);
            const countAfter = (await testDb.getDb().select().from(accommodations)).length;
            expect(countAfter).toBe(countBefore);
        });

        it('ALLOW — owner-basico plan → POST /accommodations/draft → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g1-allow-draft-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Gate passes → handler runs. We use a random destinationId; the service
            // may return 422/404 due to FK constraint — that is post-gate behaviour.
            const res = await client.post('/api/v1/protected/accommodations/draft', {
                name: 'Gate Allow Draft',
                summary: 'Minimal summary for gate allow test',
                type: 'APARTMENT',
                destinationId: randomUUID()
            });

            await expectGatePassed(res);
        });

        it('ALLOW — owner-basico plan → POST /host-onboarding/start → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g1-allow-onb-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationCreateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post('/api/v1/protected/host-onboarding/start', {
                name: 'Gate Allow Onboarding',
                summary: 'Minimal summary for gate allow test',
                type: 'APARTMENT',
                destinationId: randomUUID()
            });

            await expectGatePassed(res);
        });
    });

    // =========================================================================
    // Gate 2: EDIT_ACCOMMODATION_INFO
    // =========================================================================

    describe('Gate 2: EDIT_ACCOMMODATION_INFO', () => {
        it('BLOCK — tourist plan → PUT /accommodations/:id → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g2-block-put-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationUpdateActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Gate fires before handler; any UUID is fine as the target id.
            const res = await client.put(`/api/v1/protected/accommodations/${randomUUID()}`, {
                name: 'Should not be written'
            });

            await expectEntitlementBlock(res);
        });

        it('BLOCK — tourist plan → PATCH /accommodations/:id → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g2-block-patch-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationUpdateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.patch(`/api/v1/protected/accommodations/${randomUUID()}`, {
                name: 'Should not be written'
            });

            await expectEntitlementBlock(res);
        });

        it('BLOCK — tourist plan → POST /accommodations/:id/faqs → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g2-block-faq-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationUpdateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post(
                `/api/v1/protected/accommodations/${randomUUID()}/faqs`,
                FAQ_BODY
            );

            await expectEntitlementBlock(res);
        });

        it('ALLOW — owner-basico plan → PATCH /accommodations/:id → gate passed (404 from handler, not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g2-allow-patch-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationUpdateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.patch(`/api/v1/protected/accommodations/${randomUUID()}`, {
                name: 'Gate passed — service handles not found'
            });

            // Gate passed — entitlement check allowed the request through.
            // Service may return any non-ENTITLEMENT_REQUIRED error for a random UUID.
            await expectGatePassed(res);
        });

        it('ALLOW — owner-basico plan → POST /accommodations/:id/faqs → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g2-allow-faq-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeAccommodationUpdateActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post(
                `/api/v1/protected/accommodations/${randomUUID()}/faqs`,
                FAQ_BODY
            );

            await expectGatePassed(res);
        });
    });

    // =========================================================================
    // Gate 3: CREATE_PROMOTIONS
    // =========================================================================

    describe('Gate 3: CREATE_PROMOTIONS', () => {
        it('BLOCK — owner-basico plan → POST /owner-promotions → 403 ENTITLEMENT_REQUIRED, no promotion row created', async () => {
            const user = await createTestUser({
                email: `g3-block-post-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            const countBefore = (await testDb.getDb().select().from(ownerPromotions)).length;

            const res = await client.post('/api/v1/protected/owner-promotions', {
                ...PROMOTION_BODY,
                ownerId: user.id
            });

            await expectEntitlementBlock(res);
            const countAfter = (await testDb.getDb().select().from(ownerPromotions)).length;
            expect(countAfter).toBe(countBefore);
        });

        it('BLOCK — owner-basico plan → PATCH /owner-promotions/:id → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g3-block-patch-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.patch(`/api/v1/protected/owner-promotions/${randomUUID()}`, {
                title: 'Should not be updated'
            });

            await expectEntitlementBlock(res);
        });

        it('ALLOW — owner-pro plan → POST /owner-promotions → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g3-allow-post-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post('/api/v1/protected/owner-promotions', {
                ...PROMOTION_BODY,
                ownerId: user.id
            });

            await expectGatePassed(res);
        });

        it('ALLOW — owner-pro plan → PATCH /owner-promotions/:id → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g3-allow-patch-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeOwnerPromotionActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.patch(`/api/v1/protected/owner-promotions/${randomUUID()}`, {
                title: 'Gate passed — service handles not found'
            });

            await expectGatePassed(res);
        });
    });

    // =========================================================================
    // Gate 4: WRITE_REVIEWS
    //
    // Owner decision (2026-06-05): hosts (owner/complex plans) intentionally
    // cannot write reviews — blocking all host tiers from WRITE_REVIEWS is a
    // conflict-of-interest policy (hosts must not review competitors). Hosts
    // keep RESPOND_REVIEWS instead. This is NOT a bug; it is a product decision
    // recorded in spec.md Revision History and docs/billing/endpoint-gate-matrix.md.
    // =========================================================================

    describe('Gate 4: WRITE_REVIEWS', () => {
        it('BLOCK — owner-basico plan → POST /accommodations/:id/reviews → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g4-block-accom-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeReviewActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post(
                `/api/v1/protected/accommodations/${randomUUID()}/reviews`,
                REVIEW_BODY
            );

            // Gate fires before any handler execution — no DB mutation possible.
            await expectEntitlementBlock(res);
        });

        it('BLOCK — owner-basico plan → POST /destinations/:id/reviews → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g4-block-dest-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeReviewActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post(
                `/api/v1/protected/destinations/${randomUUID()}/reviews`,
                DESTINATION_REVIEW_BODY
            );

            // Gate fires before any handler execution — no DB mutation possible.
            await expectEntitlementBlock(res);
        });

        it('ALLOW — tourist-free plan → POST /accommodations/:id/reviews → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g4-allow-accom-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeReviewActor(user.id);
            const client = new E2EApiClient(app, actor);

            // Gate passes. Random accommodationId → service returns NOT_FOUND.
            const res = await client.post(
                `/api/v1/protected/accommodations/${randomUUID()}/reviews`,
                REVIEW_BODY
            );

            // Gate passed — the route reached the handler (no ENTITLEMENT_REQUIRED gate block).
            // The service may return a non-2xx for the random ID; that is acceptable post-gate behavior.
            await expectGatePassed(res);
        });

        it('ALLOW — tourist-free plan → POST /destinations/:id/reviews → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g4-allow-dest-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeReviewActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.post(
                `/api/v1/protected/destinations/${randomUUID()}/reviews`,
                DESTINATION_REVIEW_BODY
            );

            // Gate passed — the route reached the handler (no ENTITLEMENT_REQUIRED gate block).
            // The service may return a non-2xx for the random ID; that is acceptable post-gate behavior.
            await expectGatePassed(res);
        });
    });

    // =========================================================================
    // Gate 5: VIEW_ADVANCED_STATS
    // =========================================================================

    describe('Gate 5: VIEW_ADVANCED_STATS', () => {
        it('BLOCK — owner-basico plan → GET /accommodations/my/favorites-breakdown → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g5-block-fav-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/accommodations/my/favorites-breakdown');
            await expectEntitlementBlock(res);
        });

        it('BLOCK — owner-basico plan → GET /accommodations/my/market-comparison → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g5-block-mkt-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/accommodations/my/market-comparison');
            await expectEntitlementBlock(res);
        });

        it('ALLOW — owner-pro plan → GET /accommodations/my/favorites-breakdown → 200 with breakdown array', async () => {
            const user = await createTestUser({
                email: `g5-allow-fav-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/accommodations/my/favorites-breakdown');

            // Gate passed — 200 with array payload (empty for a fresh user with no listings).
            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean; data: unknown[] };
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('ALLOW — owner-pro plan → GET /accommodations/my/market-comparison → gate passed (not 403 ENTITLEMENT_REQUIRED)', async () => {
            const user = await createTestUser({
                email: `g5-allow-mkt-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: ownerProPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            // The market-comparison service requires ACCOMMODATION_VIEW_ALL internally.
            // We include it so the handler can succeed and return 200 with comparisons.
            const actor = createMockActor(
                RoleEnum.USER,
                [
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.ACCOMMODATION_VIEW_ALL
                ],
                user.id
            );
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/accommodations/my/market-comparison');

            // Gate passed (entitlement check allowed the request through).
            await expectGatePassed(res);
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                success: boolean;
                data: { comparisons: unknown[] };
            };
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data.comparisons)).toBe(true);
        });
    });

    // =========================================================================
    // Gate 6: VIEW_BASIC_STATS
    // =========================================================================

    describe('Gate 6: VIEW_BASIC_STATS', () => {
        it('BLOCK — tourist-free plan → GET /conversations/me/response-rate → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g6-block-rr-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/conversations/me/response-rate');
            await expectEntitlementBlock(res);
        });

        it('BLOCK — tourist-free plan → GET /conversations/me/monthly-inquiries → 403 ENTITLEMENT_REQUIRED', async () => {
            const user = await createTestUser({
                email: `g6-block-mi-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/conversations/me/monthly-inquiries');
            await expectEntitlementBlock(res);
        });

        it('ALLOW — owner-basico plan → GET /conversations/me/response-rate → 200 with KPI payload', async () => {
            const user = await createTestUser({
                email: `g6-allow-rr-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/conversations/me/response-rate');

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                success: boolean;
                data: { responseRatePct: number; avgResponseTimeMinutes: number | null };
            };
            expect(body.success).toBe(true);
            expect(typeof body.data.responseRatePct).toBe('number');
        });

        it('ALLOW — owner-basico plan → GET /conversations/me/monthly-inquiries → 200 with months array', async () => {
            const user = await createTestUser({
                email: `g6-allow-mi-${randomUUID().slice(0, 8)}@example.com`
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

            const actor = makeStatsActor(user.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get('/api/v1/protected/conversations/me/monthly-inquiries');

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                success: boolean;
                data: { months: Array<{ month: string; count: number }> };
            };
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data.months)).toBe(true);
            // Gap-filled server-side; default 6-month window produces exactly 6 entries.
            expect(body.data.months.length).toBe(6);
        });
    });
});
