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

import { billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
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
});
