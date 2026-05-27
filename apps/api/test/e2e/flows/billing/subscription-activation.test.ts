/**
 * Subscription activation — annual + monthly post-payment (SPEC-143 T-143-18).
 *
 * Consolidates the post-payment activation contract for BOTH paid-subscription
 * paths in a single file. The happy-path activation legs were already covered
 * by T-143-09 sub-commit 3 (annual) and T-143-10 sub-commit 3 (monthly), but
 * neither pinned the `current_period_end` shape — the calendar field that
 * downstream code (entitlement TTL, renewal cron, dunning windows) reads to
 * decide when the next billing cycle starts. This test fills that gap and
 * documents the period-end contract for each interval in one place.
 *
 * What this test pins (beyond what the earlier sub-commits already pin):
 *
 *   1. ANNUAL flow: after `payment.updated` (status='approved') activates a
 *      pending annual subscription, `current_period_end` is approximately
 *      one YEAR after `current_period_start`. The exact value is whatever
 *      `initiatePaidAnnualSubscription` set at create time (the webhook
 *      handler in payment-logic.ts does NOT mutate the period bounds — it
 *      only flips status).
 *   2. MONTHLY flow: after `subscription_preapproval.updated` (status='active')
 *      activates a pending monthly subscription, `current_period_end` is
 *      approximately one MONTH after `current_period_start`. Same contract:
 *      webhook does not mutate the period.
 *   3. The status flip is observable as `active` in both flows.
 *
 * SCOPE NOTE: cache-priming behaviour is already covered by sub-commit 4
 * tests in both `annual-checkout.test.ts` and `monthly-checkout.test.ts`,
 * so this file does NOT mount a probe app. The focus here is the
 * period-end calendar contract — a small surface, intentionally.
 *
 * @module test/e2e/flows/billing/subscription-activation
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. Shared ref pattern so the
// `@repo/billing` factory below can lazy-resolve the mp-stub adapter
// once it is constructed at top-level.
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
                    'mp-stub adapter not initialized — subscription-activation.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// Slack windows for period-end assertions. Plans seed at a different
// wall-clock instant than the test compares against, so we allow some
// drift around the nominal duration. One day on both ends is generous
// enough to absorb time-zone arithmetic without papering over a missing
// year/month addition.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('SPEC-143 T-143-18 — subscription activation post-payment', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;

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

        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `sub-activation-${Date.now()}@example.com`
        });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Helper: build + sign an MP IPN `payment.updated` payload. Mirrors
     * `buildSignedWebhookRequest` in annual-checkout.test.ts.
     */
    function buildSignedPaymentWebhook(opts: {
        readonly outerEventId: number;
        readonly providerPaymentId: string;
    }): { readonly body: string; readonly headers: Record<string, string> } {
        const body = JSON.stringify({
            id: opts.outerEventId,
            type: 'payment',
            action: 'payment.updated',
            data: { id: opts.providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    /**
     * Helper: same as buildSignedPaymentWebhook but for the subscription
     * preapproval event family (different `type` + `action`).
     */
    function buildSignedSubscriptionWebhook(opts: {
        readonly outerEventId: number;
        readonly mpSubId: string;
    }): { readonly body: string; readonly headers: Record<string, string> } {
        const body = JSON.stringify({
            id: opts.outerEventId,
            type: 'subscription_preapproval',
            action: 'subscription_preapproval.updated',
            data: { id: opts.mpSubId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    it('annual: payment.updated approved flips the local sub to active with current_period_end ~1 year after start', async () => {
        // ARRANGE — drive the annual happy path to produce a
        // pending_provider sub with `current_period_end` set to ~1 year
        // from start at create time. The webhook below flips the status
        // but leaves the period bounds intact — the assertion at the
        // bottom pins exactly that contract.
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_annual_activation',
                url: 'https://stub.example/checkout/annual-activation'
            })
        );
        const createRes = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });
        expect(createRes.status).toBe(201);
        const createBody = (await createRes.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        const localSubscriptionId = createBody.data.localSubscriptionId;
        mpStub.config.reset();

        // Sanity — period bounds were set at create time.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(preRows).toHaveLength(1);
        const periodStartAtCreate = preRows[0]?.currentPeriodStart;
        const periodEndAtCreate = preRows[0]?.currentPeriodEnd;
        expect(periodStartAtCreate).toBeInstanceOf(Date);
        expect(periodEndAtCreate).toBeInstanceOf(Date);
        expect(preRows[0]?.status).toBe('pending_provider');

        // ARRANGE — stub the webhook adapter calls. The payment status
        // `approved` is what triggers confirmAnnualSubscription.
        const outerEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        const providerPaymentId = `pay_test_${randomUUID()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: String(outerEventId),
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: 1_000_000,
                currency: 'ARS',
                metadata: {
                    annualSubscriptionId: localSubscriptionId,
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            })
        );

        // ACT — POST the signed webhook.
        const { body, headers } = buildSignedPaymentWebhook({
            outerEventId,
            providerPaymentId
        });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
        expect(response.status).toBe(200);

        // ASSERT — sub flipped to active AND period_end is approximately
        // one year after period_start. The webhook handler MUST NOT
        // mutate the period bounds (regression guard: a refactor that
        // accidentally resets them on activation would flunk this test).
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        const post = postRows[0];
        expect(post?.status).toBe('active');

        const periodStart = post?.currentPeriodStart as Date;
        const periodEnd = post?.currentPeriodEnd as Date;
        expect(periodStart).toBeInstanceOf(Date);
        expect(periodEnd).toBeInstanceOf(Date);
        expect(periodStart.getTime()).toBe((periodStartAtCreate as Date).getTime());
        expect(periodEnd.getTime()).toBe((periodEndAtCreate as Date).getTime());

        // period_end must be approximately 1 year after period_start.
        // ±1 day slack absorbs DST/leap-year arithmetic; anything outside
        // that window means the period was off by more than a few hours,
        // which would be a real defect.
        const delta = periodEnd.getTime() - periodStart.getTime();
        expect(delta).toBeGreaterThan(ONE_YEAR_MS - ONE_DAY_MS);
        expect(delta).toBeLessThan(ONE_YEAR_MS + ONE_DAY_MS);

        // Adapter call accounting: exactly one retrieve, matching the
        // single approved webhook event.
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);
    });

    it('monthly: subscription_preapproval.updated active flips the local sub to active with current_period_end ~1 month after start', async () => {
        // ARRANGE — drive the monthly happy path. The local sub starts in
        // pending_provider with period bounds spanning ~1 month.
        const mpSubscriptionId = `sub_monthly_activation_${randomUUID().slice(0, 8)}`;
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: mpSubscriptionId,
                status: 'pending',
                initPoint: `https://stub.example/preapproval/${mpSubscriptionId}`
            })
        );
        const createRes = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });
        expect(createRes.status).toBe(201);
        const createBody = (await createRes.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        const localSubscriptionId = createBody.data.localSubscriptionId;
        mpStub.config.reset();

        // Sanity — period bounds were set at create time.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(preRows).toHaveLength(1);
        const periodStartAtCreate = preRows[0]?.currentPeriodStart;
        const periodEndAtCreate = preRows[0]?.currentPeriodEnd;
        expect(periodStartAtCreate).toBeInstanceOf(Date);
        expect(periodEndAtCreate).toBeInstanceOf(Date);
        // Monthly start-paid creates the sub in 'incomplete' (set by
        // qzpay-core@1.6.4+ which now stages paid-mode subs as 'incomplete'
        // before the preapproval authorization webhook). Annual still uses
        // 'pending_provider' because the annual flow is a one-time checkout
        // — see annual-checkout.test.ts and monthly-checkout.test.ts for
        // the divergent pre-activation statuses.
        expect(preRows[0]?.status).toBe('incomplete');

        // ARRANGE — stub the preapproval-update webhook. MP `'authorized'`
        // maps to qzpay `'active'` (mercadopago/types.ts MERCADOPAGO_SUBSCRIPTION_STATUS),
        // which the handler then maps to local `active`. Stubbing
        // `subscriptions.retrieve` directly with `status: 'active'`
        // (the post-MP-mapping qzpay value) saves a translation step.
        const outerEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: String(outerEventId),
                type: 'subscription_preapproval.updated',
                data: { id: mpSubscriptionId }
            })
        );
        mpStub.config.setSuccess(
            'subscriptions.retrieve',
            providerResponseFixtures.subscription({
                id: mpSubscriptionId,
                status: 'active'
            })
        );

        // ACT — POST the signed webhook.
        const { body, headers } = buildSignedSubscriptionWebhook({
            outerEventId,
            mpSubId: mpSubscriptionId
        });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
        expect(response.status).toBe(200);

        // ASSERT — sub flipped to active, period bounds unchanged.
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        const post = postRows[0];
        expect(post?.status).toBe('active');

        const periodStart = post?.currentPeriodStart as Date;
        const periodEnd = post?.currentPeriodEnd as Date;
        expect(periodStart).toBeInstanceOf(Date);
        expect(periodEnd).toBeInstanceOf(Date);
        expect(periodStart.getTime()).toBe((periodStartAtCreate as Date).getTime());
        expect(periodEnd.getTime()).toBe((periodEndAtCreate as Date).getTime());

        // period_end ~1 month after period_start. Month length varies
        // (28-31 days) so the slack window is wider than the annual one —
        // ±2 days is generous enough to cover any monthly arithmetic
        // without hiding a real defect.
        const delta = periodEnd.getTime() - periodStart.getTime();
        expect(delta).toBeGreaterThan(ONE_MONTH_MS - 2 * ONE_DAY_MS);
        expect(delta).toBeLessThan(ONE_MONTH_MS + 2 * ONE_DAY_MS);

        // Exactly one subscription retrieve, matching the single webhook.
        expect(mpStub.config.getCalls('subscriptions.retrieve')).toHaveLength(1);
    });
});
