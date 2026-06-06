/**
 * Plan downgrade scheduling — happy path (SPEC-143 T-143-12 sub-commit 1).
 *
 * Validates the deferred-apply leg of the plan downgrade flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/change-plan
 *      { newPlanId, billingInterval: 'monthly' }   (target price < current)
 *
 * → plan-change.ts handler detects downgrade (normalized newPrice < currentPrice)
 * → scheduleSubscriptionDowngrade in subscription-downgrade.service.ts:
 *     . resolves current sub + currentPlan + targetPlan via billing.*
 *     . verifies target price is strictly lower (NOT_A_DOWNGRADE otherwise)
 *     . writes a QZPayScheduledPlanChange JSONB onto the local sub:
 *       { newPlanId, newPriceId, applyAt: currentPeriodEnd, status: 'pending',
 *         attemptCount: 0, targetTransactionAmountMajor, metadata: {...} }
 * → handler returns 200 { status: 'scheduled', subscriptionId,
 *                         previousPlanId, newPlanId, effectiveAt }
 * ```
 *
 * IMPORTANT contracts pinned by this test:
 *
 *   1. The LOCAL subscription's `plan_id` and `status` are UNCHANGED at
 *      this leg. The cron `apply-scheduled-plan-changes` (covered by
 *      T-143-13) is responsible for the actual mutation when
 *      `applyAt` is reached.
 *   2. NO billing_checkouts row is created. NO payment adapter call is
 *      made. The downgrade is a pure local state change followed by a
 *      future cron-driven commit.
 *   3. The user keeps the current plan's entitlements for the rest of
 *      the billing cycle. T-143-12 sub-commit 3 covers the entitlement-
 *      load invariant explicitly.
 *
 * @module test/e2e/flows/billing/plan-downgrade
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// vi.mock is also hoisted. The factory closes over `stubRef` and returns the
// current adapter every time `createMercadoPagoAdapter` is invoked. This lets
// the QZPay billing middleware lazy-initialize against the stub instead of a
// real MP adapter that would try to reach the network. Even though the
// downgrade scheduling flow does NOT call the payment adapter, the
// middleware initializes it eagerly at app boot — the stub is still
// required to keep that initialization path off the network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — plan-downgrade.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    getEntitlementCacheStats
} from '../../../../src/middlewares/entitlement.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestPlan,
    createTestPrice,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref that the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-12 — plan downgrade scheduling', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let seed: TestBillingPlansSeed;
    let expensiveSubscriptionId: string;
    let expensiveCustomerId: string;

    beforeAll(async () => {
        await testDb.setup();
        // Clear any cached real adapter that another file may have built.
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // Each test starts clean: seed plans, create a user + billing
        // customer linked by external_id, build an authenticated client,
        // and seed an ACTIVE monthly subscription on the EXPENSIVE plan
        // (mirroring T-143-11's cheap-sub setup but for the downgrade
        // direction). The downgrade flow does not require
        // providerCustomerIds.mercadopago — the scheduling path is purely
        // a local DB write — but the field is kept populated for
        // consistency with the upgrade test suite.
        seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `plan-downgrade-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        expensiveCustomerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId: expensiveCustomerId,
            planId: seed.expensive.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-factory-plan-downgrade' }
        });
        expensiveSubscriptionId = sub.subscriptionId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('returns 200 scheduled and writes scheduledPlanChange without mutating plan_id for an active expensive-plan user downgrading to cheap', async () => {
        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'monthly'
        });

        // ASSERT — response shape (PlanChangeAppliedResponseSchema variant
        // with status='scheduled'). The legacy synchronous 'active' status
        // is unreachable now that SPEC-141 D7 moved the downgrade behind
        // the cron; only 'scheduled' is emitted for downgrades.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly status: 'scheduled';
                readonly subscriptionId: string;
                readonly previousPlanId: string;
                readonly newPlanId: string;
                readonly effectiveAt: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('scheduled');
        expect(body.data.subscriptionId).toBe(expensiveSubscriptionId);
        expect(body.data.previousPlanId).toBe(seed.expensive.planId);
        expect(body.data.newPlanId).toBe(seed.cheap.planId);
        // effectiveAt is the sub's currentPeriodEnd (ISO 8601).
        expect(body.data.effectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — DB invariant: the sub's plan_id is UNCHANGED at this
        // leg. The cron `apply-scheduled-plan-changes` (T-143-13) is
        // responsible for flipping plan_id when applyAt is reached. The
        // user keeps the expensive plan's entitlements until then.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs).toHaveLength(1);
        const row = subs[0];
        expect(row).toBeDefined();
        expect(row?.planId).toBe(seed.expensive.planId);
        expect(row?.status).toBe('active');

        // ASSERT — scheduledPlanChange JSONB carries the full schedule
        // payload. Every field is read later by the cron to drive the
        // actual changePlan + MP propagate, so the shape is part of the
        // public contract between this leg and T-143-13.
        const scheduledPlanChange = row?.scheduledPlanChange as Record<string, unknown> | null;
        expect(scheduledPlanChange).toBeTruthy();
        expect(scheduledPlanChange?.newPlanId).toBe(seed.cheap.planId);
        expect(scheduledPlanChange?.newPriceId).toBe(seed.cheap.monthlyPriceId);
        // applyAt mirrors currentPeriodEnd in the response.effectiveAt.
        expect(scheduledPlanChange?.applyAt).toBe(body.data.effectiveAt);
        expect(scheduledPlanChange?.status).toBe('pending');
        expect(scheduledPlanChange?.attemptCount).toBe(0);
        // Cheap monthly price is 100_000 centavos → 1000 major units.
        // The cron forwards this value as-is to
        // paymentAdapter.subscriptions.update; pin the conversion so a
        // refactor that forgets the /100 surfaces as a test diff.
        expect(scheduledPlanChange?.targetTransactionAmountMajor).toBe(1000);
        const scheduledMeta = scheduledPlanChange?.metadata as Record<string, unknown> | undefined;
        expect(scheduledMeta?.source).toBe('plan-change-downgrade');
        expect(scheduledMeta?.previousPlanId).toBe(seed.expensive.planId);
        // requestedAt is an ISO timestamp captured at request time. We
        // only check it parses; the exact value depends on `Date.now()`.
        expect(scheduledPlanChange?.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — NO billing_checkouts row was created. The downgrade
        // path is purely a local state change; the user does not pay
        // upfront (they already paid for the current cycle, and the
        // cheaper next-cycle charge happens via the existing
        // preapproval cadence).
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // ASSERT — NO payment adapter calls. The downgrade scheduling
        // flow never touches MP. The cron later invokes
        // paymentAdapter.subscriptions.update when applyAt fires.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.update')).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Error paths — sub-commit 2
    //
    // The plan-change handler + scheduleSubscriptionDowngrade service
    // surface four distinct error branches reachable through the downgrade
    // flow. Each test pins one branch end-to-end and asserts no schedule
    // is written to the local sub and no adapter call is made when the
    // failure is detected.
    //
    // Reminder: the active expensive-plan subscription is seeded by the
    // file-level beforeEach (expensiveSubscriptionId in scope), so each
    // test below starts from a clean state and only mutates what it needs.
    // -----------------------------------------------------------------------

    it('returns 400 when the user requests to change to the same plan', async () => {
        // ACT: pass the SAME planId the user is already on. The handler
        // short-circuits at line 213-217 (plan-change.ts) BEFORE the
        // downgrade service is invoked, so this is a handler-level 400,
        // not the service's 422 SAME_PLAN (which would only fire if the
        // handler had let the request through).
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(400);

        // ASSERT — sub unchanged: no scheduled change written.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        expect(subs[0]?.scheduledPlanChange).toBeNull();

        // ASSERT — no side effects on checkouts or adapter.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.update')).toHaveLength(0);
    });

    it('returns 404 when the target plan does not exist', async () => {
        // ACT: well-formed UUID that does not match any row in
        // billing_plans. billing.plans.get() returns null and the handler
        // throws 404 at line 197-202 — before deciding upgrade vs
        // downgrade.
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: randomUUID(),
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(404);

        // ASSERT — sub unchanged.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        expect(subs[0]?.scheduledPlanChange).toBeNull();
    });

    it('returns 400 when the target plan has no price for the requested interval', async () => {
        // ARRANGE: ad-hoc plan with ONLY an annual price. Request a
        // monthly downgrade against it — the handler at line 233-242
        // filters targetPlan.prices by interval and surfaces 400 when
        // nothing matches.
        //
        // Mirrors the upgrade no-price test: the handler's price filter
        // is upstream of the downgrade service, so this 400 is the
        // observable behavior. The service-level 404 NO_MATCHING_PRICE
        // would require an `active: false` price row to reach — left to
        // a follow-up if matching contracts change.
        const annualOnlyPlan = await createTestPlan({
            name: 'Plan Without Monthly Price (downgrade)',
            metadata: { slug: 'annual-only-downgrade', category: 'test-error-path' }
        });
        await createTestPrice({
            planId: annualOnlyPlan.planId,
            unitAmount: 800_000,
            billingInterval: 'year'
        });
        // Deliberately NO monthly price on annualOnlyPlan.

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: annualOnlyPlan.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(400);

        // ASSERT — sub unchanged.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        expect(subs[0]?.scheduledPlanChange).toBeNull();
    });

    it('returns 422 when the target price is not strictly lower than the current price (NOT_A_DOWNGRADE)', async () => {
        // ARRANGE: ad-hoc plan with a MONTHLY price equal to the current
        // (expensive) plan's monthly price. The handler's isUpgrade check
        // compares NORMALIZED prices (unitAmount / intervalCount). Equal
        // normalized prices → isUpgrade is false (strictly-greater) →
        // route falls into the DOWNGRADE branch and dispatches to
        // scheduleSubscriptionDowngrade. The service's defensive guard
        // (subscription-downgrade.service.ts:193) then throws
        // NOT_A_DOWNGRADE because target.unitAmount >= current.unitAmount,
        // mapped to HTTP 422 by mapDowngradeErrorToHttp.
        //
        // This is the symmetric trap of T-143-11's NOT_AN_UPGRADE: forcing
        // the service-level guard requires a price the handler will route
        // into the wrong branch from the user's intent.
        const equalPricePlan = await createTestPlan({
            name: 'Plan With Equal Monthly Price',
            metadata: { slug: 'equal-monthly-downgrade', category: 'test-error-path' }
        });
        // expensive baseline monthly is 500_000 centavos (seed-helpers.ts).
        // Set this ad-hoc plan's monthly to the same value so the
        // normalized comparison routes to the downgrade branch.
        await createTestPrice({
            planId: equalPricePlan.planId,
            unitAmount: 500_000,
            billingInterval: 'month'
        });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: equalPricePlan.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(422);

        // ASSERT — sub unchanged. The service guard fires BEFORE writing
        // any scheduledPlanChange, so the local row is pristine.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        expect(subs[0]?.scheduledPlanChange).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Entitlements unchanged after scheduling — sub-commit 3
    //
    // Pin the contract that scheduling a downgrade does NOT alter the
    // user's entitlements: the local sub.plan_id is unchanged, so the
    // entitlement middleware's loadEntitlements (which keys off the
    // active sub's plan_id, NOT scheduledPlanChange.newPlanId) still
    // surfaces the CURRENT (expensive) plan's entitlements. The cron
    // `apply-scheduled-plan-changes` (T-143-13) is the only thing that
    // commits the plan flip AND should invalidate the cache then.
    //
    // The mini-app probe pattern is identical to upgrade sub-commit 4:
    // mount the REAL entitlementMiddleware against the real billing
    // instance with a synthetic prelude that sets billingEnabled +
    // billingCustomerId so loadEntitlements actually runs.
    //
    // Regression guard: cache size DELTA must be 0 across the schedule
    // call. If a future refactor adds clearEntitlementCache to the
    // downgrade scheduling path (would be a bug — there is nothing to
    // re-cache yet), this delta becomes -1 and the test fails. The
    // INVERSE of the upgrade sub-commit 4 guard.
    //
    // SCOPE NOTE: same as the annual/monthly/upgrade sub-commit 4 —
    // validates the LOAD pipeline only. ENFORCEMENT (wiring
    // requireEntitlement / gateXxx to production routes) is gap work
    // tracked under SPEC-145.
    // -----------------------------------------------------------------------

    it('scheduling a downgrade does NOT change entitlements or invalidate the cache (cache delta = 0)', async () => {
        // ARRANGE: mini-app probe that runs the REAL entitlementMiddleware
        // against the real billing instance. The synthetic prelude sets
        // billingEnabled + billingCustomerId so loadEntitlements actually
        // runs.
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', expensiveCustomerId);
            return next();
        });
        probeApp.use(entitlementMiddleware());
        probeApp.get('/probe', (c) => {
            return c.json({
                entitlements: Array.from(c.get('userEntitlements') ?? []),
                limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
                billingLoadFailed: c.get('billingLoadFailed') ?? false
            });
        });

        // ARRANGE: ensure the cache singleton has no entry for this
        // customer (prior tests in this file leave the singleton populated
        // because the cache is process-wide and not cleared by
        // testDb.clean()).
        clearEntitlementCache(expensiveCustomerId);

        // ACT 1: probe BEFORE scheduling. The sub is active on the
        // expensive plan, so loadEntitlements returns the expensive
        // plan's declared entitlements ('publish_accommodations' + 'view_advanced_stats')
        // and limits (max_accommodations=3). The set lands in the cache.
        const preRes = await probeApp.request('/probe');
        expect(preRes.status).toBe(200);
        const preBody = (await preRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(preBody.entitlements).toContain('publish_accommodations');
        expect(preBody.entitlements).toContain('view_advanced_stats');
        expect(preBody.limits.max_accommodations).toBe(3);
        expect(preBody.billingLoadFailed).toBe(false);

        // Snapshot cache size. The downgrade scheduling MUST NOT
        // invalidate this entry, so the delta after the schedule call
        // must be 0.
        const cacheSizeBeforeSchedule = getEntitlementCacheStats().size;
        expect(cacheSizeBeforeSchedule).toBeGreaterThanOrEqual(1);

        // ACT 2: schedule the downgrade (handled by sub-commit 1 — we
        // re-use the happy-path response shape here as a state mutation,
        // not as the assertion target).
        const scheduleRes = await client.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: seed.cheap.planId,
                billingInterval: 'monthly'
            }
        );
        expect(scheduleRes.status).toBe(200);

        // ASSERT: cache size unchanged. The scheduling path writes
        // scheduledPlanChange to the local sub but does NOT touch the
        // entitlement cache, because the user's effective plan is still
        // expensive until the cron applies the change. A non-zero delta
        // here would indicate either an unintended cache invalidation
        // (premature feature drop) or test infra leaking another
        // customer's entry, both of which we want to surface.
        const cacheSizeAfterSchedule = getEntitlementCacheStats().size;
        expect(cacheSizeAfterSchedule).toBe(cacheSizeBeforeSchedule);

        // ACT 3: probe AFTER scheduling. The cache hit returns the same
        // expensive entitlements as before (no reload happens because
        // the cache was not invalidated). Even if we forced a reload
        // (e.g. clearEntitlementCache + re-request), the result would
        // still be expensive entitlements because the middleware filters
        // subs by status='active'|'trialing' and reads the active sub's
        // plan_id (entitlement.ts:167) — which is still expensive.
        const postRes = await probeApp.request('/probe');
        expect(postRes.status).toBe(200);
        const postBody = (await postRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(postBody.entitlements).toContain('publish_accommodations');
        expect(postBody.entitlements).toContain('view_advanced_stats');
        expect(postBody.limits.max_accommodations).toBe(3);

        // ASSERT: sub.scheduledPlanChange IS populated (the schedule
        // landed) AND sub.plan_id is still expensive. Pinning both
        // facts together documents the invariant: the SCHEDULE exists,
        // but the PLAN has not flipped yet. The cron is the only thing
        // that can flip it.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        const scheduledPlanChange = subs[0]?.scheduledPlanChange as Record<string, unknown> | null;
        expect(scheduledPlanChange?.newPlanId).toBe(seed.cheap.planId);
        expect(scheduledPlanChange?.status).toBe('pending');
    });
});
