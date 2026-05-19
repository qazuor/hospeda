/**
 * Plan downgrade execution by cron — happy path (SPEC-143 T-143-13 sub-commit 1).
 *
 * Validates the apply-scheduled-plan-changes cron's end-to-end behavior
 * against a real DB + real qzpay-core, complementing the existing unit
 * suite in `apps/api/test/cron/apply-scheduled-plan-changes.test.ts`
 * (which mocks everything below the cron).
 *
 * Flow exercised:
 *
 * ```
 * (setup) sub on expensive plan, active, currentPeriodEnd in the past
 *
 * → POST /api/v1/protected/billing/subscriptions/change-plan
 *   { newPlanId: cheap, billingInterval: 'monthly' }
 *   → writes scheduledPlanChange { status: 'pending', applyAt: currentPeriodEnd }
 *   → because currentPeriodEnd is already past, applyAt is past → cron-due
 *
 * → applyScheduledPlanChangesJob.handler(ctx)
 *   → findDueScheduledChanges picks up the row (status pending, applyAt <= now)
 *   → applyOne:
 *       STEP 1: billing.subscriptions.changePlan → flips local plan_id
 *       STEP 2: skipped (mp_subscription_id is NULL — no MP propagation)
 *       STEP 3: addon recalc (no addons present — no-op write path)
 *       STEP 4: clearEntitlementCache(customerId)
 *       STEP 5: mark scheduledPlanChange.status='applied' with resolvedAt
 *   → outcome 'applied' → result { applied: 1, retried: 0, failed: 0 }
 * ```
 *
 * IMPORTANT contracts pinned by this test:
 *
 *   1. The cron's handler is invoked directly (NOT via POST /admin/cron/...).
 *      The handler is the canonical entry point — the admin route is a thin
 *      wrapper. Calling the handler skips the admin actor pipeline + the
 *      permission check, which are out of scope for this T.
 *   2. The local sub's `plan_id` flips from expensive → cheap after the
 *      tick. T-143-12 sub-commit 1 already pinned that the scheduling leg
 *      LEAVES plan_id unchanged; this test pins the inverse for the cron leg.
 *   3. `scheduledPlanChange.status` transitions `pending` → `applied`.
 *      `resolvedAt` is populated, `attemptCount` increments to 1. The shape
 *      stays consistent with the QZPayScheduledPlanChange JSONB written by
 *      the scheduling leg.
 *   4. NO billing_checkouts row is created by the cron path. The downgrade
 *      apply is a pure local state change + MP preapproval update (skipped
 *      when mp_subscription_id is NULL).
 *
 * @module test/e2e/flows/billing/plan-downgrade-cron
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// vi.mock is also hoisted. The factory closes over `stubRef` and returns the
// current adapter every time `createMercadoPagoAdapter` is invoked. The cron
// path itself does NOT call the payment adapter in this happy-path setup
// (mp_subscription_id is NULL, so STEP 2 of applyOne is skipped). The stub
// is still required because the QZPay billing middleware initializes the
// adapter eagerly at app boot — without the stub, that initialization tries
// to reach the MP network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — plan-downgrade-cron.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { applyScheduledPlanChangesJob } from '../../../../src/cron/jobs/apply-scheduled-plan-changes.js';
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

/**
 * Build a minimal CronJobContext for handler invocation. Mirrors the shape
 * built by the admin-cron route handler at runtime; counts every log call
 * so individual tests can assert what the cron emitted.
 */
function makeCronCtx() {
    const logs = {
        info: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        warn: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        error: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        debug: [] as Array<{ message: string; data?: Record<string, unknown> }>
    };
    const ctx = {
        logger: {
            info: (message: string, data?: Record<string, unknown>) => {
                logs.info.push({ message, data });
            },
            warn: (message: string, data?: Record<string, unknown>) => {
                logs.warn.push({ message, data });
            },
            error: (message: string, data?: Record<string, unknown>) => {
                logs.error.push({ message, data });
            },
            debug: (message: string, data?: Record<string, unknown>) => {
                logs.debug.push({ message, data });
            }
        },
        startedAt: new Date(),
        dryRun: false
    };
    return { ctx, logs };
}

describe('SPEC-143 T-143-13 — plan downgrade execution by cron', () => {
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
        // with currentPeriodEnd ALREADY IN THE PAST. The downgrade scheduling
        // handler copies currentPeriodEnd into scheduledPlanChange.applyAt,
        // so a past currentPeriodEnd → past applyAt → cron-due in the same
        // tick. This avoids a separate raw-SQL UPDATE to force applyAt.
        seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `plan-downgrade-cron-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        expensiveCustomerId = customer.customerId;

        // currentPeriodEnd ~60s in the past so the cron picks it up at the
        // next handler invocation. Using a small delta keeps the simulated
        // "applyAt elapsed" state realistic without time-travel mocks.
        const now = Date.now();
        const periodStart = new Date(now - 31 * 24 * 60 * 60 * 1000); // ~1 month ago
        const periodEnd = new Date(now - 60 * 1000); // 60 seconds ago

        const sub = await createTestSubscription({
            customerId: expensiveCustomerId,
            planId: seed.expensive.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            metadata: { source: 'test-factory-plan-downgrade-cron' }
        });
        expensiveSubscriptionId = sub.subscriptionId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('applies a due scheduled downgrade end-to-end: flips plan_id, marks scheduledPlanChange applied, reports applied=1', async () => {
        // ARRANGE — first leg: schedule the downgrade via the user-facing
        // route. The handler writes scheduledPlanChange { status: 'pending',
        // applyAt: currentPeriodEnd } onto the sub. Since the sub was
        // seeded with currentPeriodEnd 60s in the past, the schedule is
        // due immediately for the next cron tick.
        const scheduleRes = await client.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: seed.cheap.planId,
                billingInterval: 'monthly'
            }
        );
        expect(scheduleRes.status).toBe(200);

        // Sanity: scheduledPlanChange is in place and applyAt is in the
        // past (so the cron query's `applyAt <= now()` matches).
        const preCronRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(preCronRows).toHaveLength(1);
        const preSchedule = preCronRows[0]?.scheduledPlanChange as Record<string, unknown> | null;
        expect(preSchedule?.status).toBe('pending');
        expect(preSchedule?.newPlanId).toBe(seed.cheap.planId);
        expect(new Date(preSchedule?.applyAt as string).getTime()).toBeLessThan(Date.now());
        expect(preCronRows[0]?.planId).toBe(seed.expensive.planId);

        // ACT — invoke the cron handler directly. The admin POST
        // /api/v1/admin/cron/{jobName} route is a thin wrapper around this
        // handler; the e2e value of going through HTTP is negligible
        // compared to the cost of standing up an admin actor + permission
        // check. The unit suite already covers the route wrapper.
        const { ctx, logs } = makeCronCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        // ASSERT — CronJobResult counters. Exactly one row was due and
        // applied cleanly; no retries, no failures.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ applied: 1, retried: 0, failed: 0, due: 1 });
        expect(result.message).toContain('Applied 1');

        // ASSERT — the cron logged the per-row applied message. Pins the
        // observability contract: ops greps `Scheduled plan change applied`
        // when triaging downgrade traffic.
        const appliedLog = logs.info.find((l) => l.message === 'Scheduled plan change applied');
        expect(appliedLog).toBeDefined();
        expect(appliedLog?.data).toMatchObject({
            subscriptionId: expensiveSubscriptionId,
            customerId: expensiveCustomerId,
            oldPlanId: seed.expensive.planId,
            newPlanId: seed.cheap.planId
        });

        // ASSERT — DB after the cron tick. plan_id has flipped to cheap.
        // This is the INVERSE invariant of T-143-12 sub-commit 1, which
        // pinned that the scheduling leg leaves plan_id unchanged. Together
        // the two tests document the full lifecycle: schedule → wait →
        // cron applies.
        const postCronRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, expensiveSubscriptionId));
        expect(postCronRows).toHaveLength(1);
        const postRow = postCronRows[0];
        expect(postRow?.planId).toBe(seed.cheap.planId);
        // Status stays 'active' across the apply — downgrades do not
        // interrupt subscription state.
        expect(postRow?.status).toBe('active');

        // ASSERT — scheduledPlanChange transitions pending → applied with
        // resolvedAt populated and attemptCount incremented. The shape
        // matches the QZPayScheduledPlanChange JSONB the cron writes in
        // STEP 5. Pin every field that ops or downstream code reads.
        const postSchedule = postRow?.scheduledPlanChange as Record<string, unknown> | null;
        expect(postSchedule).toBeTruthy();
        expect(postSchedule?.status).toBe('applied');
        expect(postSchedule?.newPlanId).toBe(seed.cheap.planId);
        expect(postSchedule?.attemptCount).toBe(1);
        expect(postSchedule?.resolvedAt).toBeDefined();
        expect(typeof postSchedule?.resolvedAt).toBe('string');
        expect(new Date(postSchedule?.resolvedAt as string).getTime()).toBeGreaterThan(
            new Date(preSchedule?.requestedAt as string).getTime()
        );
        expect(postSchedule?.lastAttemptAt).toBeDefined();

        // ASSERT — NO billing_checkouts row was created by either leg of
        // the flow. The downgrade is a pure local state change followed by
        // a cron-driven commit; no payment intent, no checkout session.
        // Pins the contract that the user is NOT charged at downgrade time.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // ASSERT — the cron never invoked the MP adapter (mp_subscription_id
        // is NULL in this setup, so STEP 2 is skipped). The scheduling leg
        // also does not touch MP. Verifies the e2e flow stays off the
        // network when the local sub has no provider-side subscription id.
        expect(mpStub.config.getCalls('subscriptions.update')).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });
});
