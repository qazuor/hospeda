/**
 * Annual checkout flow — happy path (SPEC-143 T-143-09 sub-commit 1).
 *
 * Validates the first leg of the annual subscription flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/start-paid
 *      { planSlug, billingInterval: 'annual' }
 *
 * → service calls billing.checkout.create({ mode: 'payment' })
 * → QZPay-core invokes paymentAdapter.checkout.create() under the hood
 *   (the mp-stub intercepts that call)
 * → service INSERTs billing_subscriptions row with status='pending_provider'
 *   and metadata.annualSubscriptionId = localSubscriptionId
 * → handler returns 201 { checkoutUrl, localSubscriptionId, expiresAt }
 * ```
 *
 * Webhook activation (the second leg) is covered in a follow-up sub-commit.
 *
 * @module test/e2e/flows/billing/annual-checkout
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
// real MP adapter that would try to reach the network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — annual-checkout.test.ts must wire stubRef before the first request'
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
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import {
    invalidSignatureHeaders,
    providerResponseFixtures,
    signWebhookPayload
} from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
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

describe('SPEC-143 T-143-09 — annual checkout', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;

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

        // Each test starts clean: seed plans, create a user + billing customer
        // linked by external_id, build an authenticated client.
        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `annual-checkout-${Date.now()}@example.com`
        });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('creates a pending_provider subscription and returns the provider checkout URL', async () => {
        // ARRANGE — stub the adapter call qzpay-core will make
        const expectedCheckoutUrl = 'https://stub.example/checkout/chk_annual_xyz';
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_annual_xyz',
                url: expectedCheckoutUrl,
                status: 'pending'
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });

        // ASSERT — response shape
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
                readonly expiresAt: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
        expect(body.data.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — DB row created in pending_provider with the documented
        // subscription-side metadata fields (source, planSlug, annualPriceId,
        // billingInterval — see initiatePaidAnnualSubscription in
        // subscription-checkout.service.ts).
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.status).toBe('pending_provider');
        expect(row?.billingInterval).toBe('year');
        expect(row?.intervalCount).toBe(1);
        const subscriptionMetadata = row?.metadata as Record<string, unknown> | null;
        expect(subscriptionMetadata?.source).toBe('start-paid-annual');
        expect(subscriptionMetadata?.billingInterval).toBe('annual');
        expect(subscriptionMetadata?.planSlug).toBe(cheapPlanName);

        // ASSERT — webhook correlation: the handler stores
        // `annualSubscriptionId = localSubscriptionId` in the CHECKOUT row's
        // metadata so the payment.updated webhook can flip the subscription
        // to `active`. Verify the correlation key landed correctly.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(1);
        const checkoutMetadata = checkouts[0]?.metadata as Record<string, unknown> | null;
        expect(checkoutMetadata?.annualSubscriptionId).toBe(body.data.localSubscriptionId);
        expect(checkoutMetadata?.billingInterval).toBe('annual');

        // ASSERT — qzpay-core invoked the adapter exactly once
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });

    // -----------------------------------------------------------------------
    // Error paths — sub-commit 2
    // -----------------------------------------------------------------------

    it('returns 404 when the plan slug does not match any existing plan', async () => {
        // No stub configuration: the service fails at plan lookup, before any
        // adapter call. If checkout.create were ever invoked, the loud
        // unconfigured-error from the stub would fail the test.

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: 'Non Existent Plan Name',
            billingInterval: 'annual'
        });

        expect(response.status).toBe(404);

        // No DB side effects: no subscription, no checkout row.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(0);
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // Adapter was never called.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    it('returns 404 when the plan exists but has no active annual price', async () => {
        // Create a plan with ONLY a monthly price. The seedBillingTestPlans
        // baseline plans always have both intervals, so we need an ad-hoc plan
        // to exercise this branch.
        const monthlyOnly = await createTestPlan({
            name: 'Monthly Only Plan',
            metadata: { slug: 'monthly-only', category: 'test-error-path' }
        });
        await createTestPrice({
            planId: monthlyOnly.planId,
            unitAmount: 100_000,
            billingInterval: 'month'
        });
        // Deliberately NO annual price.

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: monthlyOnly.name,
            billingInterval: 'annual'
        });

        expect(response.status).toBe(404);

        // No DB side effects.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(0);
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // Adapter was never called.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    it('returns 500 when the adapter response carries no checkout URL', async () => {
        // qzpay-core only sets `providerInitPoint` when `providerResult.url` is
        // truthy. An empty string is falsy, so the handler hits the
        // MISSING_INIT_POINT branch and surfaces 500.
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_no_url',
                url: ''
            })
        );

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });

        expect(response.status).toBe(500);

        // qzpay-core invoked the adapter, but the response was insufficient.
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');

        // The pending_provider subscription row is created BEFORE the adapter
        // call (Decision 1A in qzpay-core: "no orphans"). The abandoned-pending-
        // subs cron picks it up after TTL — no manual rollback. Validate that
        // contract here.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('pending_provider');
    });

    it('returns 503 (PROVIDER_RATE_LIMITED) when the adapter throws a 429 (provider sync failure, throw strategy)', async () => {
        // qzpay-core is constructed with `providerSyncErrorStrategy: 'throw'`
        // (SPEC-149 T-002). When checkout.create throws, qzpay-core wraps the
        // error in QZPayProviderSyncError and re-throws. The hospeda handler
        // detects it via isBillingProviderError(), maps MP 429 →
        // PROVIDER_RATE_LIMITED → HTTP 503 with a Retry-After header.
        //
        // This validates the throw-strategy branch end-to-end for the annual
        // flow, distinct from the previous test which exercises the
        // success-with-missing-url path.
        mpStub.config.setError(
            'checkout.create',
            429,
            'MercadoPago rate limit exceeded',
            'RATE_LIMITED'
        );

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });

        // Post-SPEC-149: MP 429 → QZPayProviderSyncError → PROVIDER_RATE_LIMITED → 503.
        expect(response.status).toBe(503);

        const body = (await response.json()) as {
            readonly success: boolean;
            readonly error: { readonly code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PROVIDER_RATE_LIMITED');

        // Retry-After header must be present for rate-limited responses.
        const retryAfter = response.headers.get('Retry-After');
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThan(0);

        // Adapter was called and threw — outcome recorded as 'error'.
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('error');

        // Subscription row remains in pending_provider despite the provider
        // failure (the abandoned-pending-subs cron reaper handles it later).
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('pending_provider');
    });

    // -----------------------------------------------------------------------
    // Webhook activation — sub-commit 3
    //
    // MercadoPago IPN delivers `{ id, type, action, data: { id } }`. Hospeda's
    // handlePaymentUpdated (post SPEC-143 T-143-09 fix) fetches the full
    // payment via paymentAdapter.payments.retrieve, then dispatches to
    // confirmAnnualSubscription when metadata carries `annualSubscriptionId`
    // and the status is approved/accredited.
    //
    // The test programs three stub operations to simulate the full flow:
    //   - webhooks.verifySignature -> true (qzpay-hono's middleware check)
    //   - webhooks.constructEvent  -> the parsed QZPayWebhookEvent
    //   - payments.retrieve        -> the full QZPayProviderPayment with
    //                                  status='approved' + metadata
    // -----------------------------------------------------------------------

    /**
     * Helper: create a pending_provider annual subscription via the happy
     * path so the webhook test has something to activate.
     */
    async function createPendingAnnualSubscription(): Promise<string> {
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_for_activation',
                url: 'https://stub.example/checkout/for-activation'
            })
        );
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        mpStub.config.reset();
        return body.data.localSubscriptionId;
    }

    /**
     * Helper: build + sign an MP IPN payment.updated payload.
     */
    function buildSignedWebhookRequest(opts: {
        readonly providerPaymentId: string;
    }): {
        readonly body: string;
        readonly headers: Record<string, string>;
    } {
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

    it('webhook payment.updated with matching annualSubscriptionId flips subscription to active', async () => {
        // ARRANGE: pending_provider sub created via happy path
        const localSubscriptionId = await createPendingAnnualSubscription();

        // ARRANGE: stub the three adapter calls qzpay-hono + the handler make
        const providerPaymentId = `pay_test_${randomUUID()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_activation',
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

        // ACT: POST the signed webhook
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT: webhook acknowledged
        expect(response.status).toBe(200);

        // ASSERT: subscription flipped to active
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('active');

        // ASSERT: each stub leg fired exactly once
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(1);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);
    });

    it('webhook with mismatched annualSubscriptionId leaves subscription pending', async () => {
        // ARRANGE: pending_provider sub created via happy path
        const localSubscriptionId = await createPendingAnnualSubscription();

        // ARRANGE: webhook carries a *different* annualSubscriptionId — one that
        // does not match any subscription row. The handler should swallow the
        // miss + acknowledge the event without mutating the existing sub.
        const providerPaymentId = `pay_test_${randomUUID()}`;
        const mismatchedSubId = randomUUID();
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_mismatch',
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
                    annualSubscriptionId: mismatchedSubId,
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            })
        );

        // ACT
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT: 200 (event acknowledged) but no state change to the real sub
        expect(response.status).toBe(200);

        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('pending_provider');

        // The mismatched id obviously creates no new subscription row either.
        const sub2 = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, mismatchedSubId));
        expect(sub2).toHaveLength(0);
    });

    it('webhook with invalid signature is rejected with 401 and produces no DB change', async () => {
        // ARRANGE: pending_provider sub
        const localSubscriptionId = await createPendingAnnualSubscription();
        const providerPaymentId = `pay_test_${randomUUID()}`;

        // qzpay-hono's webhook router is the signature gate now (the custom
        // hospeda webhookSignatureMiddleware was removed in PR #1221). Make the
        // stub's verifySignature reject so the gate returns 401.
        mpStub.config.setSuccess('webhooks.verifySignature', false);

        // ACT: build a body with wrong-hmac headers; qzpay-hono verifies the
        // signature via the stub above and rejects with 401 before dispatch.
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'payment',
            action: 'payment.updated',
            data: { id: providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const badHeaders = invalidSignatureHeaders({ body, mode: 'wrong-hmac' });

        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...badHeaders
            },
            body
        });

        expect(response.status).toBe(401);

        // ASSERT: subscription untouched
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('pending_provider');

        // ASSERT: qzpay verified the signature once (and it failed); the event
        // was never constructed because the gate rejected before dispatch.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(0);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Entitlement load post-activation — sub-commit 4
    //
    // Hospeda's billing system loads `userEntitlements` and `userLimits`
    // into the request context via a globally-mounted `entitlementMiddleware`
    // (see apps/api/src/utils/create-app.ts:184). When an annual subscription
    // activates via a payment.updated webhook, the handler at
    // apps/api/src/routes/webhooks/mercadopago/payment-logic.ts:183 invokes
    // `clearEntitlementCache(customerId)` so the next request sees the
    // post-activation plan entitlements without waiting for the 5-minute TTL.
    //
    // This test validates the full reload path by exercising a mini-app
    // probe that mounts the REAL `entitlementMiddleware` against the REAL
    // billing instance + DB. Pre-webhook the probe returns an empty
    // entitlement set (the sub is still `pending_provider` and the
    // middleware's `loadEntitlements` finds no active sub). Post-webhook
    // the probe returns the cheap plan's declared entitlements, proving
    // (a) the cache was invalidated for this customer and (b) the
    // middleware correctly loads plan-level entitlements after activation.
    // If `clearEntitlementCache` were removed from the webhook handler,
    // this test would fail: the cached empty set would persist for the
    // 5-minute TTL and the post-webhook probe would still return [].
    //
    // SCOPE NOTE: this test validates the LOAD pipeline only. The
    // ENFORCEMENT pipeline (wiring `requireEntitlement` / `gateXxx` to
    // production routes so unentitled users actually get 403s) is gap
    // work tracked under SPEC-145 (Billing Entitlements and Limits
    // Enforcement) as a formal sequential follow-up of this spec.
    // -----------------------------------------------------------------------

    it('webhook activation invalidates the entitlement cache and the next lookup loads plan entitlements', async () => {
        // ARRANGE: create the pending_provider annual sub via the happy
        // path. Capture its customer id so the probe app can target it.
        const localSubscriptionId = await createPendingAnnualSubscription();
        const subRows = await testDb
            .getDb()
            .select({ customerId: billingSubscriptions.customerId })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        const customerId = subRows[0]?.customerId as string;
        expect(customerId).toMatch(/^[0-9a-f-]{36}$/);

        // ARRANGE: mini-app that runs the REAL entitlementMiddleware
        // against the REAL billing instance and exposes the resulting
        // userEntitlements + userLimits in JSON. The synthetic prelude
        // middleware sets billingEnabled + billingCustomerId so the
        // entitlement middleware does not short-circuit before calling
        // loadEntitlements.
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
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
        clearEntitlementCache(customerId);

        // ACT 1: probe BEFORE webhook activation. The sub is in
        // `pending_provider`, so loadEntitlements finds no active sub and
        // returns the tourist-free fallback (SPEC-143 T-143-58) with
        // shouldCache=true; the fallback set lands in the cache for this
        // customer.
        const preRes = await probeApp.request('/probe');
        expect(preRes.status).toBe(200);
        const preBody = (await preRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(new Set(preBody.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'can_view_recommendations'])
        );
        expect(preBody.limits).toEqual({ max_favorites: 3 });
        expect(preBody.billingLoadFailed).toBe(false);

        // Snapshot the cache size so we can prove exactly one entry was
        // removed by the webhook handler (the singleton may carry entries
        // for other customers from prior tests; we assert a delta of -1
        // rather than an absolute value).
        const cacheSizeBeforeWebhook = getEntitlementCacheStats().size;
        expect(cacheSizeBeforeWebhook).toBeGreaterThanOrEqual(1);

        // ACT 2: webhook payment.updated. The handler activates the sub
        // AND invokes clearEntitlementCache for this customer.
        const providerPaymentId = `pay_test_${randomUUID()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_reload',
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
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const webhookRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
        expect(webhookRes.status).toBe(200);

        // ASSERT: the webhook handler removed exactly this customer's
        // entry from the cache. Other customers' entries (if any) are
        // untouched, so the delta is -1.
        const cacheSizeAfterWebhook = getEntitlementCacheStats().size;
        expect(cacheSizeAfterWebhook).toBe(cacheSizeBeforeWebhook - 1);

        // ACT 3: probe AFTER activation. The cache miss for this customer
        // forces loadEntitlements to re-query, which now finds the newly-
        // active sub, fetches the cheap plan, and surfaces its declared
        // entitlements + limits.
        const postRes = await probeApp.request('/probe');
        expect(postRes.status).toBe(200);
        const postBody = (await postRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        // The cheap plan declares ['public:read'] (apps/api/test/e2e/setup/
        // seed-helpers.ts:352). The probe must surface that entitlement.
        // Note: 'public:read' is a string-literal entitlement value that
        // is NOT present in the EntitlementKey enum; the middleware
        // accepts it via an `as EntitlementKey[]` cast. SPEC-145 Phase 0
        // closes that catalog gap.
        expect(postBody.entitlements).toContain('public:read');
        // The cheap plan declares { ads_per_month: 5 } in limits.
        expect(postBody.limits.ads_per_month).toBe(5);
        expect(postBody.billingLoadFailed).toBe(false);
    });
});
