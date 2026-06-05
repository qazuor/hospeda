/**
 * SPEC-145 T-015 — Plan-change elevation and restriction at route level
 *
 * Validates that entitlement gates reflect plan changes IMMEDIATELY after the
 * change is applied — without any manual `clearEntitlementCache()` call in the
 * test body. The absence of a manual cache clear is the key assertion: the
 * plan-change paths themselves (webhook for upgrade, cron for downgrade) are
 * responsible for cache invalidation.
 *
 * Scenarios:
 *
 * 1. UPGRADE ELEVATION
 *    - Customer on owner-basico (lacks VIEW_ADVANCED_STATS) → gated route 403.
 *    - Drive the upgrade through the REAL webhook path:
 *        POST /change-plan (initiatePaidPlanUpgrade → creates checkout row)
 *        POST /webhooks/mercadopago (payment.updated → confirmPlanUpgrade →
 *              billing.subscriptions.changePlan → clearEntitlementCache)
 *    - Gated route → 2xx immediately (no manual cache clear between webhook
 *      and assertion — the webhook cleared it).
 *
 * 2. DOWNGRADE RESTRICTION
 *    - Customer on owner-pro (has VIEW_ADVANCED_STATS) → gated route 2xx.
 *    - Drive the downgrade through the REAL apply path:
 *        POST /change-plan with past currentPeriodEnd (scheduleSubscriptionDowngrade)
 *        applyScheduledPlanChangesJob.handler() — the apply step calls
 *              billing.subscriptions.changePlan → clearEntitlementCache
 *    - Gated route → 403 immediately (no manual cache clear).
 *
 * Real paths used (documented here as the lifecycle-wiring evidence):
 *
 *   UPGRADE:
 *     initiatePaidPlanUpgrade (apps/api/src/services/subscription-checkout.service.ts)
 *     → billing.checkout.create (qzpay-core + mpStub)
 *     → confirmPlanUpgrade (apps/api/src/routes/webhooks/mercadopago/payment-logic.ts:797)
 *     → billing.subscriptions.changePlan (qzpay-drizzle)
 *     → clearEntitlementCache (payment-logic.ts:379)
 *
 *   DOWNGRADE:
 *     scheduleSubscriptionDowngrade (apps/api/src/services/subscription-downgrade.service.ts)
 *     → applyScheduledPlanChangesJob.handler (apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts)
 *     → billing.subscriptions.changePlan (step 1)
 *     → clearEntitlementCache (step 4)
 *
 * Fixture strategy (mirrors enforcement-admin-override.test.ts):
 *   - Plans are seeded in the outer describe (beforeAll-level) via beforeEach so
 *     they survive the per-test testDb.clean() truncation.
 *   - A fresh user + billing customer + subscription is created per test.
 *   - clearEntitlementCache(customerId) is called ONCE during setup after
 *     subscription creation (cold cache), then NOT called again in the test body.
 *
 * @module test/e2e/flows/billing/enforcement-plan-change
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// The billing instance initialises a MercadoPago adapter at construction time
// even though the plan-change flows only invoke the adapter for the upgrade
// checkout.create call. Without the stub the adapter constructor reaches for
// live MP credentials and throws at app boot.
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
                    'mp-stub adapter not initialized — enforcement-plan-change.test.ts must wire stubRef before the first request'
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
import { applyScheduledPlanChangesJob } from '../../../../src/cron/jobs/apply-scheduled-plan-changes.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor, createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// MP stub — required even when not exercising checkout (app boots the adapter).
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants
//
// Copied as string literals to avoid importing from @repo/billing —
// the vi.mock intercept is file-scoped. Using the string values directly
// keeps plan fixture creation free from mock entanglement.
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
 * Actor for the VIEW_ADVANCED_STATS gated route.
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
 * Assert a response is a 403 ENTITLEMENT_REQUIRED gate block.
 */
async function expectEntitlementBlock(res: Response): Promise<void> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/**
 * Assert the entitlement gate passed (response is NOT 403 ENTITLEMENT_REQUIRED).
 * Any other status (200, 404, 422…) is acceptable — the gate let the request through.
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
// Helper: build + sign an MP IPN payment.updated webhook payload.
// Mirrors the same pattern used by plan-upgrade.test.ts sub-commit 3.
// ---------------------------------------------------------------------------

function buildSignedWebhookRequest(opts: {
    readonly providerPaymentId: string;
}): { readonly body: string; readonly headers: Record<string, string> } {
    const body = JSON.stringify({
        id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
        type: 'payment',
        action: 'payment.updated',
        data: { id: opts.providerPaymentId },
        date_created: new Date().toISOString(),
        live_mode: false
    });
    const headers = signWebhookPayload({ body });
    return { body, headers };
}

// ---------------------------------------------------------------------------
// Minimal CronJobContext for applyScheduledPlanChangesJob.handler invocation.
// Mirrors plan-downgrade-cron.test.ts makeCronCtx().
// ---------------------------------------------------------------------------

function makeCronCtx() {
    return {
        logger: {
            info: (_message: string, _data?: Record<string, unknown>) => undefined,
            warn: (_message: string, _data?: Record<string, unknown>) => undefined,
            error: (_message: string, _data?: Record<string, unknown>) => undefined,
            debug: (_message: string, _data?: Record<string, unknown>) => undefined
        },
        startedAt: new Date(),
        dryRun: false
    };
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-015 — plan-change elevation and restriction at route level', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan IDs — populated in beforeEach, consumed per test.
    // Two separate plan rows are needed:
    //   ownerBasicoPlanId  — lacks VIEW_ADVANCED_STATS (used for upgrade-FROM / downgrade-TO)
    //   ownerProPlanId     — has VIEW_ADVANCED_STATS (used for upgrade-TO / downgrade-FROM)
    // The seedBillingTestPlans cheap/expensive plans carry no entitlement metadata
    // relevant to VIEW_ADVANCED_STATS, so we create dedicated rows here.
    let ownerBasicoPlanId: string;
    let ownerProPlanId: string;
    // The seedBillingTestPlans seed is needed by the upgrade flow because
    // initiatePaidPlanUpgrade resolves plan price ROWS from billing_prices.
    // The test plan rows created above have no prices attached, so we still need
    // the seed's cheap/expensive plans for the upgrade price comparison.
    // Both upgrade and downgrade use the TEST seed plans for the change-plan call
    // (the route compares plan prices, not entitlements) and then we use
    // ownerBasico/ownerPro for entitlement assertions (subscription.planId = slug).
    //
    // Actually: because the plan-change route uses billing_plans.id (UUID) for
    // change-plan requests, and entitlement loading uses billingCustomerEntitlements
    // (which are seeded from the plan's entitlements column via billingCustomerMiddleware),
    // we need the ownerBasico / ownerPro plans to have BOTH prices (for the route)
    // and entitlements (for the gate). So we seed prices on the ownerBasico/Pro plans.
    let _ownerBasicoPriceId: string;
    let ownerProPriceId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    // Plans are seeded in EVERY beforeEach so they survive the per-test
    // testDb.clean() truncation. Mirrors enforcement-gates.test.ts.
    beforeEach(async () => {
        mpStub.config.reset();

        // owner-basico: has PUBLISH + EDIT + VIEW_BASIC, NOT VIEW_ADVANCED_STATS.
        // Price: 100,000 centavos/month (cheaper than ownerPro — needed for the
        // upgrade flow to detect cheap → expensive direction).
        const ownerBasico = await createTestPlan({
            name: `PlanChange-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS]
        });
        ownerBasicoPlanId = ownerBasico.planId;

        const { createTestPrice } = await import('../../setup/seed-helpers.js');
        const basicoPrice = await createTestPrice({
            planId: ownerBasicoPlanId,
            unitAmount: 100_000, // 1000 ARS/month
            billingInterval: 'month'
        });
        _ownerBasicoPriceId = basicoPrice.priceId;

        // owner-pro: has VIEW_ADVANCED_STATS in addition to basico entitlements.
        // Price: 500,000 centavos/month (more expensive — upgrade target).
        const ownerPro = await createTestPlan({
            name: `PlanChange-OwnerPro-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.PUBLISH_ACCOMMODATIONS,
                E.EDIT_ACCOMMODATION_INFO,
                E.VIEW_BASIC_STATS,
                E.VIEW_ADVANCED_STATS
            ]
        });
        ownerProPlanId = ownerPro.planId;

        const proPrice = await createTestPrice({
            planId: ownerProPlanId,
            unitAmount: 500_000, // 5000 ARS/month
            billingInterval: 'month'
        });
        ownerProPriceId = proPrice.priceId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Scenario 1: UPGRADE ELEVATION
    //
    // Path: POST /change-plan (creates checkout) → POST /webhooks/mercadopago
    //       (payment.updated → confirmPlanUpgrade → billing.subscriptions.changePlan
    //        → clearEntitlementCache)
    //
    // The webhook calls clearEntitlementCache internally (payment-logic.ts:379).
    // NO manual cache clear occurs between the webhook POST and the gate assertion.
    // =========================================================================

    it('UPGRADE ELEVATION: gated route lifts from 403 to 2xx after upgrade webhook commits the plan flip (no manual cache clear)', async () => {
        // ── Arrange: customer on owner-basico (no VIEW_ADVANCED_STATS) ────────

        const user = await createTestUser({
            email: `plan-change-upgrade-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            // providerCustomerIds is not required for the upgrade flow (the
            // prorated-delta checkout path uses billing.checkout.create with
            // mode='payment', not a subscription create that reads this map).
            providerCustomerIds: { mercadopago: `mp_cust_${user.id.slice(0, 8)}` }
        });

        // Subscription starts fresh — currentPeriodEnd 30 days from now.
        // The upgrade delta is positive (pro = 500k > basico = 100k).
        const now = Date.now();
        const periodStart = new Date(now);
        const periodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000); // +30 days
        const sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerBasicoPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            metadata: { source: 'test-plan-change-upgrade' }
        });

        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const statsActor = makeStatsActor(user.id);
        const statsClient = new E2EApiClient(app, statsActor);

        // changeClient uses createMockUserActor which maps to the billing routes.
        const changeClient = new E2EApiClient(app, createMockUserActor({ id: user.id }));

        const gatedRoute = '/api/v1/protected/accommodations/my/favorites-breakdown';

        // ── Step 1: confirm gate is BLOCKING before upgrade ───────────────────
        const before = await statsClient.get(gatedRoute);
        await expectEntitlementBlock(before);

        // ── Step 2: initiate the upgrade via POST /change-plan ────────────────
        // initiatePaidPlanUpgrade detects pro > basico, calls billing.checkout.create
        // (the only adapter call in this leg), and returns 200 pending_payment.
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_upgrade_plan_change_test',
                url: 'https://stub.example/checkout/upgrade-plan-change',
                status: 'pending'
            })
        );

        const changeRes = await changeClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerProPlanId,
                billingInterval: 'monthly'
            }
        );
        expect(changeRes.status, `change-plan returned ${changeRes.status}`).toBe(200);
        const changeBody = (await changeRes.json()) as {
            readonly success: boolean;
            readonly data: { readonly status: string };
        };
        expect(changeBody.data.status).toBe('pending_payment');

        // Subscription is NOT yet on ownerPro at this leg (changePlan fires
        // only after the webhook). Verify the local invariant.
        const preSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, sub.subscriptionId));
        expect(preSubs[0]?.planId).toBe(ownerBasicoPlanId);

        // Reset stub for the webhook leg.
        mpStub.config.reset();

        // ── Step 3: fire the payment.updated webhook (confirmPlanUpgrade) ─────
        // The webhook handler calls confirmPlanUpgrade which:
        //   Step 1: billing.subscriptions.changePlan (flips planId to ownerPro)
        //   Step 4: clearEntitlementCache(customerId)  ← the key assertion
        const providerPaymentId = `pay_upgrade_${randomUUID()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_upgrade_plan_change',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );

        // The payment metadata shape is what extractPlanChangeUpgradeMetadata reads.
        // planChangeUpgradeId = the subscription id (used by changePlan as the
        // target sub to flip). deltaCentavos comes from the checkout creation leg;
        // the test uses a placeholder since confirmPlanUpgrade doesn't re-assert it.
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: 4000, // major units (400k centavos prorated delta)
                currency: 'ARS',
                metadata: {
                    planChangeUpgradeId: sub.subscriptionId,
                    oldPlanId: ownerBasicoPlanId,
                    newPlanId: ownerProPlanId,
                    newPriceId: ownerProPriceId,
                    targetTransactionAmountMajor: 5000,
                    deltaCentavos: 400_000
                } as unknown as Record<string, string>
            })
        );

        const { body: whBody, headers: whHeaders } = buildSignedWebhookRequest({
            providerPaymentId
        });
        const whRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...whHeaders
            },
            body: whBody
        });
        expect(whRes.status, `webhook returned ${whRes.status}`).toBe(200);

        // Verify plan flip committed to DB (confirms confirmPlanUpgrade ran).
        const postSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, sub.subscriptionId));
        expect(postSubs[0]?.planId).toBe(ownerProPlanId);

        // ── Step 4: gated route PASSES immediately — no manual cache clear ─────
        // confirmPlanUpgrade called clearEntitlementCache (payment-logic.ts:379).
        // The next request to this route loads fresh entitlements that now include
        // VIEW_ADVANCED_STATS. This IS the key assertion.
        const afterUpgrade = await statsClient.get(gatedRoute);
        await expectGatePassed(afterUpgrade);
        expect(
            afterUpgrade.status,
            `Expected 200 after upgrade but got ${afterUpgrade.status}`
        ).toBe(200);
    });

    // =========================================================================
    // Scenario 2: DOWNGRADE RESTRICTION
    //
    // Path: POST /change-plan with past currentPeriodEnd (scheduleSubscriptionDowngrade)
    //       → applyScheduledPlanChangesJob.handler() → billing.subscriptions.changePlan
    //       → clearEntitlementCache (step 4 in apply-scheduled-plan-changes.ts)
    //
    // The cron handler calls clearEntitlementCache internally.
    // NO manual cache clear occurs between the cron tick and the gate assertion.
    // =========================================================================

    it('DOWNGRADE RESTRICTION: gated route drops from 2xx to 403 after apply-scheduled-plan-changes cron runs (no manual cache clear)', async () => {
        // ── Arrange: customer on owner-pro (has VIEW_ADVANCED_STATS) ──────────

        const user = await createTestUser({
            email: `plan-change-downgrade-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_down_${user.id.slice(0, 8)}` }
        });

        // currentPeriodEnd ~60s in the past — same pattern as plan-downgrade-cron.test.ts.
        // This means scheduleSubscriptionDowngrade will write
        // scheduledPlanChange.applyAt = currentPeriodEnd (already past),
        // so the cron picks it up immediately on the same tick.
        const now = Date.now();
        const periodStart = new Date(now - 31 * 24 * 60 * 60 * 1000); // ~1 month ago
        const periodEnd = new Date(now - 60 * 1000); // 60 seconds ago

        const sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerProPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            metadata: { source: 'test-plan-change-downgrade' }
        });

        // Cold cache after setup.
        clearEntitlementCache(customer.customerId);

        const statsActor = makeStatsActor(user.id);
        const statsClient = new E2EApiClient(app, statsActor);
        const changeClient = new E2EApiClient(app, createMockUserActor({ id: user.id }));

        const gatedRoute = '/api/v1/protected/accommodations/my/favorites-breakdown';

        // ── Step 1: confirm gate is PASSING before downgrade ──────────────────
        // owner-pro has VIEW_ADVANCED_STATS so the gate passes.
        const before = await statsClient.get(gatedRoute);
        await expectGatePassed(before);
        expect(before.status, `Expected 200 before downgrade but got ${before.status}`).toBe(200);

        // ── Step 2: schedule the downgrade via POST /change-plan ──────────────
        // scheduleSubscriptionDowngrade detects basico < pro (downgrade direction),
        // writes scheduledPlanChange.applyAt = currentPeriodEnd (60s ago → past),
        // and returns 200 { status: 'scheduled' }. NO adapter call is made.
        const scheduleRes = await changeClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerBasicoPlanId,
                billingInterval: 'monthly'
            }
        );
        expect(scheduleRes.status, `schedule returned ${scheduleRes.status}`).toBe(200);
        const scheduleBody = (await scheduleRes.json()) as {
            readonly success: boolean;
            readonly data: { readonly status: string };
        };
        expect(scheduleBody.data.status).toBe('scheduled');

        // Verify sub is still on ownerPro (the scheduling leg does not flip planId).
        const preCronRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, sub.subscriptionId));
        expect(preCronRows[0]?.planId).toBe(ownerProPlanId);
        const preSchedule = preCronRows[0]?.scheduledPlanChange as Record<string, unknown> | null;
        expect(preSchedule?.status).toBe('pending');
        expect(new Date(preSchedule?.applyAt as string).getTime()).toBeLessThan(Date.now());

        // ── Step 3: apply the scheduled downgrade via the cron handler ────────
        // applyScheduledPlanChangesJob.handler is the same entry point used
        // by the admin POST /api/v1/admin/cron/{jobName} route; calling the
        // handler directly exercises the same code path and avoids needing
        // an admin actor + permission check (out of scope for this test).
        //
        // The cron's applyOne sequence (apply-scheduled-plan-changes.ts):
        //   STEP 1: billing.subscriptions.changePlan → flips local planId to basico
        //   STEP 4: clearEntitlementCache(customerId)  ← the key assertion
        mpStub.config.reset();
        const cronCtx = makeCronCtx();
        const cronResult = await applyScheduledPlanChangesJob.handler(cronCtx);

        expect(cronResult.success).toBe(true);
        expect(cronResult.processed).toBe(1);
        expect(cronResult.errors).toBe(0);
        expect(cronResult.details).toMatchObject({ applied: 1, retried: 0, failed: 0 });

        // Verify plan flip committed to DB.
        const postCronRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, sub.subscriptionId));
        expect(postCronRows[0]?.planId).toBe(ownerBasicoPlanId);

        // ── Step 4: gated route BLOCKS immediately — no manual cache clear ─────
        // The cron called clearEntitlementCache (apply-scheduled-plan-changes.ts step 4).
        // The next request loads fresh entitlements that no longer include
        // VIEW_ADVANCED_STATS. This IS the key assertion.
        const afterDowngrade = await statsClient.get(gatedRoute);
        await expectEntitlementBlock(afterDowngrade);
    });
});
