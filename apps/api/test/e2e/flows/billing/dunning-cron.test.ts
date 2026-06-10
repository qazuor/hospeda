/**
 * Dunning cron retries failed payments and ages out past-due subs
 * (SPEC-143 T-143-30).
 *
 * Validates the production dunning cron job end-to-end against a real
 * Postgres + the real qzpay-billing instance + the mp-stub adapter. The
 * cron runs in production at 6:00 AM UTC daily; here we invoke its
 * handler directly with a synthetic CronJobContext to bypass the
 * scheduler.
 *
 * Production code under test:
 *   - `apps/api/src/cron/jobs/dunning.job.ts:dunningJob.handler`
 *   - `qzpay-core` `createSubscriptionLifecycle`'s `processRetries` and
 *      `processCancellations` paths
 *   - `billing.payments.process` → MercadoPago adapter `payments.create`
 *   - `billing_dunning_attempts` audit table writes
 *
 * Retry schedule. The hospeda cron wires `DUNNING_RETRY_INTERVALS =
 * [1, 3, 5, 7]` days (packages/billing/src/constants/billing.constants.ts:47).
 * Four attempts total. NOT exponential backoff — the SPEC-143 task notes
 * called it "exponential backoff" but the actual schedule is a fixed
 * arithmetic progression. The dunning.job.ts module header documents
 * this is a deliberate product decision to be more aggressive than the
 * original SPEC-021 [1, 3, 7] proposal.
 *
 * Grace period. `DUNNING_GRACE_PERIOD_DAYS = 7`. A past_due sub is
 * eligible for cancellation when `gracePeriodStartedAt + 7 days <= now`
 * AND `retryCount >= retryIntervals.length` (i.e., 4+). Both checks
 * must pass; the cron does NOT cancel partway through the retry
 * schedule.
 *
 * Setup pattern. Each test builds a past_due subscription with the
 * exact retry metadata the qzpay-core lifecycle service expects
 * (`gracePeriodStartedAt`, `retryCount`, `lastRetryAt`), inserts a
 * default payment method for the customer (otherwise the cron skips
 * the retry), and configures the mp-stub to either succeed or fail the
 * payment. The cron handler then runs against the real billing
 * instance and the assertions verify the persisted DB state.
 *
 * @module test/e2e/flows/billing/dunning-cron
 */

import { vi } from 'vitest';

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
                    'mp-stub adapter not initialized — dunning-cron.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingDunningAttempts, billingSubscriptions, eq, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { dunningJob } from '../../../../src/cron/jobs/dunning.job.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimal CronJobContext for invoking the dunning handler outside of
 * the scheduler. Real production passes a structured logger and a
 * scheduler-provided startedAt; tests reuse the same shape with
 * console-only logging.
 */
function buildCronContext(): Parameters<typeof dunningJob.handler>[0] {
    return {
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined
        },
        startedAt: new Date(),
        dryRun: false
    };
}

describe('SPEC-143 T-143-30 — dunning cron', () => {
    let customerId: string;
    let cheapPlanId: string;
    let subscriptionId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
        // Reset the shared mp-stub config on file teardown so a leftover
        // error/timeout mode doesn't bleed into the first test of the next
        // file in the same vitest worker (was flaking mp-error-handling).
        mpStub.config.reset();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `dunning-cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_${randomUUID()}` }
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'past_due'
        });
        subscriptionId = sub.subscriptionId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Patch a past_due subscription with the retry metadata the
     * qzpay-core lifecycle service reads. Factories do not yet expose
     * a typed input for this metadata shape, so the test patches the
     * row directly via Drizzle UPDATE.
     */
    async function patchRetryMetadata(input: {
        readonly gracePeriodDaysAgo: number;
        readonly retryCount: number;
        readonly lastRetryDaysAgo: number;
    }): Promise<void> {
        const now = Date.now();
        const gracePeriodStartedAt = new Date(now - input.gracePeriodDaysAgo * ONE_DAY_MS);
        const lastRetryAt = new Date(now - input.lastRetryDaysAgo * ONE_DAY_MS);

        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                metadata: {
                    gracePeriodStartedAt: gracePeriodStartedAt.toISOString(),
                    retryCount: input.retryCount,
                    lastRetryAt: lastRetryAt.toISOString()
                }
            })
            .where(eq(billingSubscriptions.id, subscriptionId));
    }

    /**
     * Insert a default payment method for the customer. Without this
     * the lifecycle service's `getDefaultPaymentMethod` callback
     * returns null and the cron skips the retry.
     */
    async function insertDefaultPaymentMethod(): Promise<void> {
        const providerPaymentMethodId = `mp_pm_${randomUUID()}`;
        await testDb.getDb().execute(sql`
            INSERT INTO billing_payment_methods (
                customer_id, provider, provider_payment_method_id,
                type, status, is_default, livemode
            ) VALUES (
                ${customerId}, 'mercadopago', ${providerPaymentMethodId},
                'card', 'active', true, false
            )
        `);
    }

    it('retries a past-due payment, flips the sub to active, and records a success attempt', async () => {
        // ARRANGE: eligible for retry — retryCount=0, lastRetryAt=2d ago
        // (>= retryIntervals[0]=1), gracePeriod started 2d ago (well
        // within the 7d window).
        await patchRetryMetadata({
            gracePeriodDaysAgo: 2,
            retryCount: 0,
            lastRetryDaysAgo: 2
        });
        await insertDefaultPaymentMethod();

        // ARRANGE: mp-stub returns a succeeded payment.
        mpStub.config.setSuccess(
            'payments.create',
            providerResponseFixtures.payment({
                id: `pay_retry_success_${randomUUID()}`,
                status: 'approved',
                amount: 100_000,
                currency: 'ARS'
            })
        );

        // ACT
        const result = await dunningJob.handler(buildCronContext());

        // ASSERT: cron returned success with at least one processed
        // retry. The handler aggregates both retries and cancellations,
        // so processed >= 1.
        expect(result.success).toBe(true);
        expect(result.processed).toBeGreaterThanOrEqual(1);

        // ASSERT: subscription flipped to active. qzpay-core's
        // `processSuccessfulRetry` calls
        // `updateSubscriptionAfterRetryRecovery` which sets status back
        // to 'active' and advances the period bounds.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('active');

        // ASSERT: a billing_dunning_attempts row with result='success'
        // was written by the cron's onEvent recorder.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        const successAttempts = attempts.filter((a) => a.result === 'success');
        expect(successAttempts).toHaveLength(1);
        expect(successAttempts[0]?.provider).toBe('mercadopago');
        expect(successAttempts[0]?.attemptNumber).toBeGreaterThanOrEqual(0);
    });

    it('records a failed attempt when retries exhaust and leaves the sub past_due (cancellation happens on a later cron run)', async () => {
        // ARRANGE: retryCount=3 so the upcoming failure produces
        // newRetryCount=4 which equals retryIntervals.length=4 →
        // hasMoreRetries=false → qzpay-core emits
        // 'subscription.retry_failed' (not 'retry_scheduled') and the
        // hospeda cron's recordDunningAttempt writes a 'failed' row
        // (dunning.job.ts:37-78 only inserts for retry_succeeded /
        // retry_failed). The grace period is still within 7 days, so
        // the cancellation phase that runs immediately after retries
        // does NOT cancel — the cancel needs BOTH retries exhausted
        // AND grace expired. The sub therefore stays past_due here
        // and a separate cron run after grace expiry (covered by the
        // next test) is what finalises the cancellation.
        //
        // Important audit-coverage finding documented for SPEC-143
        // observability scope. Mid-schedule failures (retryCount < 4
        // newRetryCount < 4) emit 'subscription.retry_scheduled' with
        // the error embedded in event.data — NOT 'retry_failed'.
        // recordDunningAttempt only persists 'retry_succeeded' and
        // 'retry_failed' events (dunning.job.ts:38-43), so attempts
        // 1, 2, and 3 of a four-attempt schedule are NEVER written to
        // billing_dunning_attempts. The audit table is therefore
        // incomplete: only the FINAL outcome of a dunning sequence
        // (max-out or success) is persisted. Tracked under the
        // SPEC-143 Phase 4 observability scope.
        await patchRetryMetadata({
            gracePeriodDaysAgo: 2,
            retryCount: 3,
            lastRetryDaysAgo: 7
        });
        await insertDefaultPaymentMethod();

        // ARRANGE: mp-stub rejects the payment. The qzpay-core
        // `billing.payments.process` catches the adapter error and
        // marks the payment as 'failed'; `processSuccessfulRetry`
        // throws because the returned payment.status !== 'succeeded',
        // which trips `processFailedRetry`.
        mpStub.config.setError(
            'payments.create',
            500,
            'Provider declined the payment',
            'PAYMENT_DECLINED'
        );

        // ACT
        const result = await dunningJob.handler(buildCronContext());

        // ASSERT: handler still returned success (the cron does not
        // fail on per-sub payment errors — it logs and continues).
        expect(result.success).toBe(true);

        // ASSERT: a billing_dunning_attempts row with result='failed'
        // was written.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        const failedAttempts = attempts.filter((a) => a.result === 'failed');
        expect(failedAttempts).toHaveLength(1);

        // ASSERT: subscription stays past_due. qzpay-core's
        // `processFailedRetry` updates the metadata (incremented
        // retryCount, new lastRetryAt) but does not flip the status —
        // that is the cancellation phase's job once retries exhaust
        // AND the grace window expires. Grace window is still active
        // here (2d into the 7d window) so the cancellation pass is a
        // no-op for this sub.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('past_due');
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.retryCount).toBe(4);
        expect(metadata?.lastRetryError).toBeDefined();
    });

    it('cancels a past-due subscription once retries are exhausted and the grace period has expired', async () => {
        // ARRANGE: retries exhausted (retryCount=4 — beyond the
        // retryIntervals.length=4 boundary, so hasMoreRetries=false)
        // and gracePeriodStartedAt is 8 days ago (>= the 7-day grace
        // window). lastRetryAt does not matter for this branch because
        // getSubscriptionsToRetry returns empty when retryIntervals[4]
        // is undefined, so the retry phase is a no-op and the
        // cancellation phase fires next.
        await patchRetryMetadata({
            gracePeriodDaysAgo: 8,
            retryCount: 4,
            lastRetryDaysAgo: 7
        });
        // No payment method needed: cancellation does not invoke
        // billing.payments.process.

        // ACT
        const result = await dunningJob.handler(buildCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBeGreaterThanOrEqual(1);

        // ASSERT: status flipped to 'canceled' (US spelling, the
        // qzpay-core canonical value — billing.ts:1380 and
        // QZPAY_SUBSCRIPTION_STATUS.CANCELED). The cancellation path
        // also stamps canceledAt and merges
        // `cancelReason: 'Payment failed - grace period expired'`
        // into the metadata (subscription-lifecycle.service.ts:858-863).
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('canceled');
        expect(row?.canceledAt).toBeInstanceOf(Date);
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.cancelReason).toBe('Payment failed - grace period expired');
        expect(typeof metadata?.gracePeriodEndedAt).toBe('string');

        // ASSERT: no dunning_attempts row was written for this
        // cancellation. The audit recorder only fires for
        // retry_succeeded / retry_failed events; the
        // canceled_nonpayment event is logged but not persisted in
        // the dunning_attempts table.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        expect(attempts).toHaveLength(0);
    });
});
