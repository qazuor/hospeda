/**
 * Dunning cron: HOS-191 F5 observe-only behavior (was SPEC-143 T-143-30
 * "retries failed payments and ages out past-due subs").
 *
 * ## HOS-191 F5 update (2026-07-18)
 *
 * The owner decided MercadoPago's own native dunning ("recycling") is now
 * the sole retry/cancellation mechanism; Hospeda's own retry/cancel loop
 * (`lifecycle.processRetries()` / `lifecycle.processCancellations()`) is
 * disabled by the `DUNNING_MUTATIONS_ENABLED = false` kill switch in
 * `dunning.job.ts`. This file's original assertions exercised exactly that
 * loop end-to-end against a real Postgres + the mp-stub adapter; they have
 * been rewritten below to assert the NEW behavior — the cron observes
 * (counts `past_due` subscriptions) but never mutates them. The original
 * scenarios (retry succeeds, retry exhausts, grace-period cancellation) are
 * preserved as historical documentation in each test's comments, since the
 * `DUNNING_MUTATIONS_ENABLED` flag exists specifically to restore that exact
 * path if MercadoPago's native recycling is ever confirmed broken — see the
 * module JSDoc in `dunning.job.ts` for the full rationale, including the
 * discovered `past_due`-reachability gap.
 *
 * Validates the production dunning cron job end-to-end against a real
 * Postgres + the real qzpay-billing instance + the mp-stub adapter. The
 * cron runs in production at 6:00 AM UTC daily; here we invoke its
 * handler directly with a synthetic CronJobContext to bypass the
 * scheduler.
 *
 * Production code under test:
 *   - `apps/api/src/cron/jobs/dunning.job.ts:dunningJob.handler`
 *   - the HOS-191 F5 observe-only branch (`DUNNING_MUTATIONS_ENABLED === false`):
 *      counts `past_due` subscriptions via `billing.subscriptions.list()`
 *      without ever calling `lifecycle.processRetries()` /
 *      `lifecycle.processCancellations()`
 *   - `billing_dunning_attempts` audit table (asserted to stay empty)
 *
 * Retry schedule (now dormant behind the kill switch, documented for when
 * it is re-enabled). The hospeda cron wires `DUNNING_RETRY_INTERVALS =
 * [1, 3, 5, 7]` days (packages/billing/src/constants/billing.constants.ts:47).
 * Four attempts total. NOT exponential backoff — the SPEC-143 task notes
 * called it "exponential backoff" but the actual schedule is a fixed
 * arithmetic progression. The dunning.job.ts module header documents
 * this is a deliberate product decision to be more aggressive than the
 * original SPEC-021 [1, 3, 7] proposal.
 *
 * Grace period (also dormant). `DUNNING_GRACE_PERIOD_DAYS = 7`. A past_due
 * sub was eligible for cancellation when `gracePeriodStartedAt + 7 days <=
 * now` AND `retryCount >= retryIntervals.length` (i.e., 4+).
 *
 * Setup pattern. Each test builds a past_due subscription with the
 * exact retry metadata the qzpay-core lifecycle service would read if
 * mutations were re-enabled (`gracePeriodStartedAt`, `retryCount`,
 * `lastRetryAt`), inserts a default payment method for the customer, and
 * configures the mp-stub — then asserts the cron leaves all of it
 * untouched.
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

describe('HOS-191 F5 (was SPEC-143 T-143-30) — dunning cron, observe-only', () => {
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

    it('does NOT retry a past-due payment or flip the sub to active, even when eligible under the old schedule', async () => {
        // ARRANGE: this metadata shape would have made the sub eligible for
        // retry under the pre-HOS-191-F5 schedule — retryCount=0,
        // lastRetryAt=2d ago (>= retryIntervals[0]=1), gracePeriod started 2d
        // ago (well within the old 7d window). Kept exactly as before so this
        // test still proves eligibility is irrelevant now: the cron does not
        // even look at it.
        await patchRetryMetadata({
            gracePeriodDaysAgo: 2,
            retryCount: 0,
            lastRetryDaysAgo: 2
        });
        await insertDefaultPaymentMethod();

        // ARRANGE: mp-stub WOULD return a succeeded payment if the cron ever
        // called billing.payments.process — asserting below that it never does.
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

        // ASSERT: HOS-191 F5 observe-only pass — no local mutation is
        // attempted, so `processed` stays 0 and the details report the
        // current past_due count instead.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.details).toMatchObject({ dunningMutationsEnabled: false });

        // ASSERT: subscription stays past_due — the retry loop that used to
        // call `updateSubscriptionAfterRetryRecovery` on success is disabled.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('past_due');

        // ASSERT: no billing_dunning_attempts row was written — the
        // onEvent recorder only fires for events the (now-unused)
        // lifecycle.processRetries()/processCancellations() would emit.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        expect(attempts).toHaveLength(0);
    });

    it('does NOT record a failed attempt or touch retry metadata when retries would have exhausted under the old schedule', async () => {
        // ARRANGE: retryCount=3 so an upcoming failure would have produced
        // newRetryCount=4 == retryIntervals.length=4 under the old schedule
        // (hasMoreRetries=false → qzpay-core would emit
        // 'subscription.retry_failed'). Preserved for documentation; the
        // cron now ignores this metadata entirely.
        await patchRetryMetadata({
            gracePeriodDaysAgo: 2,
            retryCount: 3,
            lastRetryDaysAgo: 7
        });
        await insertDefaultPaymentMethod();

        // ARRANGE: mp-stub WOULD reject the payment if the cron ever called
        // billing.payments.process — asserting below that it never does.
        mpStub.config.setError(
            'payments.create',
            500,
            'Provider declined the payment',
            'PAYMENT_DECLINED'
        );

        // ACT
        const result = await dunningJob.handler(buildCronContext());

        // ASSERT: handler still returns success — an observe-only pass has
        // nothing that can fail per-subscription.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);

        // ASSERT: no billing_dunning_attempts row was written.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        expect(attempts).toHaveLength(0);

        // ASSERT: subscription and its retry metadata are byte-for-byte
        // untouched — the observe-only pass never writes
        // `retryCount`/`lastRetryError`, unlike the old `processFailedRetry`.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('past_due');
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.retryCount).toBe(3);
        expect(metadata?.lastRetryError).toBeUndefined();
    });

    it('does NOT cancel a past-due subscription even once the old retry-exhausted + grace-expired conditions are met', async () => {
        // ARRANGE: under the old schedule this combination (retries
        // exhausted, gracePeriodStartedAt 8 days ago >= the 7-day grace
        // window) would have triggered `processCancellations()`. Preserved
        // for documentation; the cron now ignores it.
        await patchRetryMetadata({
            gracePeriodDaysAgo: 8,
            retryCount: 4,
            lastRetryDaysAgo: 7
        });

        // ACT
        const result = await dunningJob.handler(buildCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);

        // ASSERT: status stays 'past_due' — NOT flipped to 'canceled'. Only
        // MercadoPago's own `subscription_preapproval` cancellation webhook
        // (subscription-logic.ts) can move this subscription out of
        // past_due now.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('past_due');
        expect(row?.canceledAt).toBeNull();

        // ASSERT: no dunning_attempts row was written.
        const attempts = await testDb
            .getDb()
            .select()
            .from(billingDunningAttempts)
            .where(eq(billingDunningAttempts.subscriptionId, subscriptionId));
        expect(attempts).toHaveLength(0);
    });

    // HOS-191 F5: the observe-only pass still counts past_due subscriptions
    // for visibility (the only thing the cron does now in production mode).
    it('reports the past_due count for visibility without mutating anything', async () => {
        await patchRetryMetadata({
            gracePeriodDaysAgo: 2,
            retryCount: 0,
            lastRetryDaysAgo: 2
        });

        const result = await dunningJob.handler(buildCronContext());

        expect(result.success).toBe(true);
        expect(result.message).toContain('Observe-only');
        const details = result.details as { pastDueCount?: number } | undefined;
        expect(details?.pastDueCount).toBeGreaterThanOrEqual(1);
    });
});
