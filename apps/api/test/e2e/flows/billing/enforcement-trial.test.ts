/**
 * SPEC-145 T-019 (spec T-145-15) — Trial entitlement grant and expiry at route level
 *
 * Validates that:
 * 1. A TRIALING subscription grants its plan's entitlements at the route level.
 * 2. Trial expiry via blockExpiredTrials() blocks access IMMEDIATELY. The block
 *    surfaces as 402 TRIAL_EXPIRED (from trialMiddleware) rather than 403
 *    ENTITLEMENT_REQUIRED — see "Cache-clear gap" note below.
 *
 * Scenarios:
 *
 * 1. TRIAL GRANT
 *    - Customer with a TRIALING subscription on owner-pro (has VIEW_ADVANCED_STATS).
 *    - Factory-created via createTestSubscription({ status: 'trialing' }) — the
 *      entitlement middleware accepts 'trialing' as an active status
 *      (entitlement.ts:167-169 / SPEC-143 T-143-24).
 *    - Gated route GET /accommodations/my/favorites-breakdown → 200 (trial grants
 *      the plan's entitlements at the route level).
 *
 * 2. TRIAL EXPIRY (SPEC-217 AC-1.1 — read-only contract)
 *    - Drive trial expiry through the REAL path:
 *        TrialService.blockExpiredTrials()
 *        → qzpay billing.subscriptions.cancel (immediate)
 *        → clearEntitlementCache(customerId)   [trial.service.ts — n(sub.customerId)]
 *    - Gated route GET → 403 ENTITLEMENT_REQUIRED IMMEDIATELY (no manual cache clear).
 *      Under the new read-only contract trialMiddleware passes GET through; the
 *      entitlement cache was cleared by blockExpiredTrials so the gate sees no
 *      VIEW_ADVANCED_STATS and returns 403.
 *
 * SPEC-217 read-only contract (replaces old "402 on all methods"):
 *   trialMiddleware now only blocks MUTATING requests (POST/PUT/PATCH/DELETE) with
 *   402 TRIAL_EXPIRED. GET/HEAD pass through so the host can still read their data.
 *   This mirrors the expired paid-subscription behaviour (read-only, not full lockout).
 *   The post-expiry GET to a gated route therefore sees 403 ENTITLEMENT_REQUIRED
 *   from the entitlement gate rather than 402 TRIAL_EXPIRED from trial middleware.
 *
 * Real paths used:
 *
 *   TRIAL GRANT:
 *     createTestSubscription({ status: 'trialing' })
 *     → billing_subscriptions row with status='trialing'
 *     → billingCustomerMiddleware loads customer + entitlement middleware reads
 *       trialing sub → includes its plan's entitlements
 *     → requireEntitlement(VIEW_ADVANCED_STATS) passes
 *
 *   TRIAL EXPIRY:
 *     seedExpiredTrialingSubscription (trialEnd in the past via UPDATE)
 *     → TrialService.blockExpiredTrials()
 *       → billing.subscriptions.cancel(id) [via qzpay-core, status → 'canceled']
 *       → n(subscription.customerId)  [clearEntitlementCache — trial.service.ts]
 *     → billingCustomerMiddleware on next request sees 'canceled' sub
 *     → entitlement loader returns tourist-free fallback (no VIEW_ADVANCED_STATS)
 *     → requireEntitlement fires → 403 ENTITLEMENT_REQUIRED
 *
 * NOTE on TRIAL_PLAN_NAME:
 *   trial.service.ts:103 hard-codes 'owner-basico' as the trial plan slug/name.
 *   blockExpiredTrials() cancels via the subscription's stored planId (UUID), NOT
 *   by name — so the cancellation path works regardless of name. The name only
 *   matters for startTrial (which we don't call here). We seed the plan under the
 *   canonical name anyway for consistency with trial-lifecycle.test.ts.
 *
 * @module test/e2e/flows/billing/enforcement-trial
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// The billing instance initialises the adapter at construction time even though
// the trial flow itself never reaches MP. Without the stub the adapter constructor
// reaches for live MP credentials and throws during billing init.
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
                    'mp-stub adapter not initialized — enforcement-trial.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptions, eq } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { TrialService } from '../../../../src/services/trial.service.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Plan name constants (mirrors trial-lifecycle.test.ts)
// ---------------------------------------------------------------------------

/**
 * Hard-coded by trial.service.ts:103. startTrial() looks up the plan by this
 * exact name. We seed under this name even though blockExpiredTrials() uses the
 * subscriptionId (not the name) for its cancel path.
 */
const TRIAL_PLAN_NAME = 'owner-basico';

/** Trial length in days (OWNER_TRIAL_DAYS = 14 from @repo/billing constants). */
const TRIAL_DAYS = 14;

// ---------------------------------------------------------------------------
// Entitlement key string constants
// Copied as literals to avoid mock entanglement with @repo/billing.
// ---------------------------------------------------------------------------
const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats',
    VIEW_ADVANCED_STATS: 'view_advanced_stats',
    CREATE_PROMOTIONS: 'create_promotions'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Stats actor for the VIEW_ADVANCED_STATS gated route.
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

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a response is blocked after trial expiry (read-only contract).
 *
 * SPEC-217 AC-1.1: trial middleware is now READ-ONLY.
 *
 * After blockExpiredTrials() cancels the subscription AND the request is a
 * GET (read), the new behavior is:
 *   - trialMiddleware passes GET through (isReadOnlyRequest = true → no 402).
 *   - The entitlement cache IS cleared (trial.service.ts calls n(customerId)).
 *   - entitlementMiddleware loads the now-empty entitlement set for the
 *     canceled subscription → requireEntitlement(VIEW_ADVANCED_STATS) fires 403.
 *   - Post-expiry GET → 403 ENTITLEMENT_REQUIRED.
 *
 * The old behavior was 402 TRIAL_EXPIRED on all methods. Under the new
 * read-only contract, mutating methods (POST/PUT/PATCH/DELETE) still receive
 * 402 TRIAL_EXPIRED from trialMiddleware. Read methods (GET/HEAD) pass through
 * and hit the entitlement gate which returns 403.
 *
 * This change was introduced by SPEC-217 AC-1.1 to match the expired
 * paid-subscription behaviour (read-only, not full lockout).
 */
async function expectTrialExpiredBlock(res: Response): Promise<void> {
    // GET request after expiry: trialMiddleware passes through (read-only),
    // entitlement gate fires 403 ENTITLEMENT_REQUIRED.
    expect(
        res.status,
        `expected 403 (ENTITLEMENT_REQUIRED after trial expiry, GET read-only passthrough) but got ${res.status}`
    ).toBe(403);
    const body = (await res.clone().json()) as { error?: { code?: string } };
    expect(body?.error?.code, 'expected ENTITLEMENT_REQUIRED code in 403 response').toBe(
        'ENTITLEMENT_REQUIRED'
    );
}

/** Assert the entitlement gate passed (NOT 403 ENTITLEMENT_REQUIRED). */
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

describe('SPEC-145 T-019 — trial entitlement grant and expire at route level', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan id — seeded in beforeEach.
    let trialPlanId: string;

    // Gated route under test (requires VIEW_ADVANCED_STATS).
    const GATED_ROUTE = '/api/v1/protected/accommodations/my/favorites-breakdown';

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

        // Trial plan seeded with VIEW_ADVANCED_STATS so the gated route is
        // accessible during the trial. The name MUST be 'owner-basico' so
        // startTrial() finds it — though we don't call startTrial here,
        // keeping the name canonical mirrors trial-lifecycle.test.ts and
        // avoids confusion when comparing the two suites.
        const trialPlan = await createTestPlan({
            name: TRIAL_PLAN_NAME,
            description: 'Owner trial plan (seed for SPEC-145 T-019)',
            entitlements: [
                E.PUBLISH_ACCOMMODATIONS,
                E.EDIT_ACCOMMODATION_INFO,
                E.VIEW_BASIC_STATS,
                E.VIEW_ADVANCED_STATS,
                E.CREATE_PROMOTIONS
            ],
            limits: { max_accommodations: 1 },
            metadata: {
                slug: TRIAL_PLAN_NAME,
                category: 'test-trial',
                isDefault: false,
                sortOrder: 1,
                trialDays: TRIAL_DAYS,
                hasTrial: true
            }
        });
        trialPlanId = trialPlan.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // The full 2-phase lifecycle in a single test:
    //
    //   Phase 1: TRIALING → gated route 200 (trial grants plan entitlements)
    //   Phase 2: EXPIRY   → gated route 403 (cache cleared by blockExpiredTrials)
    // =========================================================================

    it('trial grant: trialing sub grants entitlements at route level; expiry immediately revokes (no manual cache clear)', async () => {
        // ── Arrange: user + customer + ACTIVE trialing subscription ──────────

        const user = await createTestUser({
            email: `trial-enforce-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        // Phase 1: create a trialing sub with trialEnd in the future (~14 days).
        // We use createTestSubscription with status='trialing' and set trialEnd
        // to a future date by UPDATE so the entitlement middleware's active-status
        // filter accepts it AND blockExpiredTrials' filter (trialEnd <= now) skips it.
        const activeTrial = await createTestSubscription({
            customerId: customer.customerId,
            planId: trialPlanId,
            status: 'trialing',
            metadata: { source: 'test-trial-enforce-active' }
        });

        // Set trialEnd 14 days from now (future — NOT expired).
        const futureTrial = new Date();
        futureTrial.setDate(futureTrial.getDate() + TRIAL_DAYS);
        const trialStart = new Date();
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ trialStart, trialEnd: futureTrial })
            .where(eq(billingSubscriptions.id, activeTrial.subscriptionId));

        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const statsActor = makeStatsActor(user.id);
        const statsClient = new E2EApiClient(app, statsActor);

        // ── Phase 1: trialing sub GRANTS VIEW_ADVANCED_STATS → 200 ───────────
        //
        // The entitlement middleware (entitlement.ts:167-169) treats 'trialing'
        // as an active status and loads the plan's entitlements. The gated route
        // requires VIEW_ADVANCED_STATS; with the trial sub active the gate passes.
        const duringTrialRes = await statsClient.get(GATED_ROUTE);
        await expectGatePassed(duringTrialRes);
        expect(
            duringTrialRes.status,
            `Expected 200 during trial but got ${duringTrialRes.status}`
        ).toBe(200);

        // ── Phase 2: expire the trial → gate BLOCKS immediately ───────────────
        //
        // To expire: set trialEnd to the past and invoke blockExpiredTrials().
        // The TrialService.blockExpiredTrials() path:
        //   1. Queries billing_subscriptions WHERE status='trialing' AND trialEnd <= now
        //   2. Calls billing.subscriptions.cancel(id) — qzpay-core flips status → 'canceled'
        //   3. Calls n(subscription.customerId) [clearEntitlementCache alias]
        //
        // CACHE CLEAR NOTE: blockExpiredTrials DOES call clearEntitlementCache
        // (confirmed by trial-lifecycle.test.ts T-143-25 cache-size delta assertion).
        // This test does NOT call clearEntitlementCache manually between expiry and
        // the assertion. If the cache-clear is ever removed from the expiry path,
        // the post-expiry 403 assertion will fail, surfacing the gap.

        // Update trialEnd to 1 day in the past so blockExpiredTrials picks it up.
        const pastTrial = new Date();
        pastTrial.setDate(pastTrial.getDate() - 1);
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ trialEnd: pastTrial })
            .where(eq(billingSubscriptions.id, activeTrial.subscriptionId));

        // Invoke blockExpiredTrials via TrialService (same entry point as the
        // production cron — apps/api/src/cron/jobs/trial-expiry.ts:133).
        const billing = getQZPayBilling();
        if (!billing) {
            throw new Error('Billing instance not initialized — check the @repo/billing mock');
        }
        const trialService = new TrialService(billing);
        const blockedCount = await trialService.blockExpiredTrials();

        // Exactly one trial blocked (the one we just expired).
        expect(blockedCount, 'blockExpiredTrials should have blocked 1 trial').toBe(1);

        // Verify subscription is now cancelled (qzpay-core US spelling).
        const subRows = await testDb
            .getDb()
            .select({ status: billingSubscriptions.status })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, activeTrial.subscriptionId));
        expect(subRows[0]?.status, 'subscription should be canceled after trial expiry').toBe(
            'canceled'
        );

        // ── Gate BLOCKS immediately — NO manual cache clear ───────────────────
        // blockExpiredTrials called clearEntitlementCache(customerId) internally
        // (via the `n` alias in trial.service.ts).
        //
        // SPEC-217 AC-1.1 READ-ONLY CONTRACT:
        // The request is a GET (read-only). Under the new trialMiddleware contract,
        // expired trials do NOT block GET/HEAD — only mutating methods (POST/PUT/
        // PATCH/DELETE) receive 402 TRIAL_EXPIRED. The GET passes through trial
        // middleware and reaches the entitlement gate.
        //
        // Because blockExpiredTrials DID call clearEntitlementCache, the
        // entitlement middleware sees a fresh (empty) entitlement set for the
        // now-canceled subscription. VIEW_ADVANCED_STATS is no longer present
        // → requireEntitlement fires 403 ENTITLEMENT_REQUIRED.
        //
        // This is NOT a cache problem — the cache IS cleared. The 403 is the
        // correct post-expiry observable behavior for a GET to a gated route
        // under the new read-only trial contract.
        const afterExpiryRes = await statsClient.get(GATED_ROUTE);
        await expectTrialExpiredBlock(afterExpiryRes);
    });
});
