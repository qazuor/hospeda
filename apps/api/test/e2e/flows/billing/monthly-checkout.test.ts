/**
 * Monthly checkout flow — happy path (SPEC-143 T-143-10 sub-commit 1).
 *
 * Validates the first leg of the paid monthly subscription flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/start-paid
 *      { planSlug, billingInterval: 'monthly' }
 *
 * → service calls billing.subscriptions.create({ mode: 'paid' })
 * → qzpay-core inserts billing_subscriptions row via storage adapter
 * → qzpay-core invokes paymentAdapter.subscriptions.create() under the hood
 *   (the mp-stub intercepts that call)
 * → qzpay-core updates the local row with mp_subscription_id (the provider
 *   preapproval id)
 * → handler returns 201 { checkoutUrl, localSubscriptionId, expiresAt }
 * ```
 *
 * Unlike the annual flow (one-time `checkout.create({ mode: 'payment' })`),
 * the monthly flow drives a preapproval-based recurring authorization. The
 * `subscription_preapproval.updated` webhook (covered in sub-commit 3) is
 * what flips the local sub from its initial state to `active` after the
 * user authorizes on MP's hosted page.
 *
 * @module test/e2e/flows/billing/monthly-checkout
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
                    'mp-stub adapter not initialized — monthly-checkout.test.ts must wire stubRef before the first request'
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

describe('SPEC-143 T-143-10 — monthly checkout', () => {
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
            email: `monthly-checkout-${Date.now()}@example.com`
        });
        // The monthly flow drives qzpay-core's `billing.subscriptions.create`,
        // which reads `customer.providerCustomerIds[mercadopago]` to address
        // the preapproval API. The annual flow does not need this because
        // `billing.checkout.create({ mode: 'payment' })` does not touch the
        // customer in MP. Set a stable test id so the create call lands.
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

    it('creates a subscription via preapproval and returns the provider init point', async () => {
        // ARRANGE — stub the adapter call qzpay-core will make for the
        // monthly preapproval. MercadoPago returns 'pending' for a freshly
        // created preapproval (the user hasn't authorized yet); the
        // adapter's mapStatus passes 'pending' through and qzpay-core
        // forwards it to the storage adapter. The hosted-page url comes
        // back as `initPoint`.
        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_monthly_xyz';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_monthly_xyz',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });

        // ASSERT — response shape mirrors the annual flow so the route
        // handler can return either uniformly. See
        // InitiatePaidMonthlySubscriptionResult in
        // apps/api/src/services/subscription-checkout.service.ts.
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

        // ASSERT — DB row: qzpay-core inserts the subscription via its
        // storage adapter, then updates the row with `mpSubscriptionId`
        // (the provider preapproval id) after the adapter call lands.
        // See packages/core/src/billing.ts:1292-1294. The
        // service-side metadata stamps `source: 'start-paid-monthly'`
        // so the downstream cron + audit log can attribute the row.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.mpSubscriptionId).toBe('sub_monthly_xyz');
        // qzpay-core 1.6.4 / qzpay-drizzle 1.7.4 ship `mode: 'paid'` subs in
        // `'incomplete'` until the `subscription_preapproval.updated` webhook
        // flips the row to `'active'`. Prior versions wrote `'active'` at
        // create time, which leaked entitlements before any provider
        // authorization landed — pin the invariant explicitly so a downstream
        // bump that regresses the behavior fails this test.
        expect(row?.status).toBe('incomplete');
        const subscriptionMetadata = row?.metadata as Record<string, unknown> | null;
        expect(subscriptionMetadata?.source).toBe('start-paid-monthly');

        // ASSERT — monthly does NOT create a billing_checkouts row. That
        // table is populated only by the annual one-time `checkout.create`
        // path (see initiatePaidAnnualSubscription). Validating zero
        // checkouts here pins the contract: if someone refactors the
        // monthly handler to use the checkout table, this test fails.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // ASSERT — qzpay-core invoked the adapter exactly once. No
        // payments.* or webhooks.* calls fire during initiation; those
        // only enter the picture during the `subscription_preapproval.updated`
        // webhook (sub-commit 3).
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });

    // -----------------------------------------------------------------------
    // Error paths — sub-commit 2
    //
    // The monthly flow surfaces five distinct error codes from
    // `initiatePaidMonthlySubscription`, each mapped to an HTTP status by
    // `mapServiceErrorToHttp` in start-paid.ts:86. The tests below exercise
    // each branch end-to-end and assert no half-state lands in the DB when
    // the failure happens BEFORE the qzpay create call.
    // -----------------------------------------------------------------------

    it('returns 404 when the plan slug does not match any existing plan', async () => {
        // No stub configuration: the service fails at plan lookup, before any
        // adapter call. If `subscriptions.create` were ever invoked, the loud
        // unconfigured-error from the stub would fail the test.

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: 'Non Existent Plan Name',
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(404);

        // No DB side effects: no subscription row.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(0);

        // Adapter was never called.
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('returns 404 when the plan exists but has no active monthly price', async () => {
        // Create a plan with ONLY an annual price. The seedBillingTestPlans
        // baseline plans always have both intervals, so we need an ad-hoc
        // plan to exercise this branch (the symmetric case of the
        // NO_ANNUAL_PRICE test in annual-checkout.test.ts).
        const annualOnly = await createTestPlan({
            name: 'Annual Only Plan',
            metadata: { slug: 'annual-only', category: 'test-error-path' }
        });
        await createTestPrice({
            planId: annualOnly.planId,
            unitAmount: 1_200_000,
            billingInterval: 'year'
        });
        // Deliberately NO monthly price.

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: annualOnly.name,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(404);

        // No DB side effects.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(0);

        // Adapter was never called.
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('returns 500 when the adapter response carries no init point', async () => {
        // qzpay-core surfaces `providerInitPoint` only when the provider
        // result returns a truthy `initPoint` (falls back to `sandboxInitPoint`
        // if the former is missing). Both empty → the hospeda handler hits
        // the MISSING_INIT_POINT branch and surfaces 500.
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_no_url',
                status: 'pending',
                initPoint: ''
            })
        );

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(500);

        // qzpay-core invoked the adapter, but the response was insufficient.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');

        // qzpay-core's create flow inserts the local subscription row BEFORE
        // calling the provider adapter (see billing.ts:1262). The row stays
        // in storage even though no provider link was established — the
        // `abandoned-pending-subs` cron picks it up after the TTL. Validate
        // that contract here (symmetric with the annual MISSING_INIT_POINT
        // test which asserts the same no-rollback invariant).
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(1);
    });

    it('returns 500 when the adapter throws (provider sync failure under log strategy)', async () => {
        // qzpay-core was constructed with `providerSyncErrorStrategy: 'log'`
        // (the qzpay default, mirrored by hospeda's middlewares/billing.ts).
        // When the adapter throws, qzpay logs a warning and returns the
        // un-enriched local subscription (no providerInitPoint). The hospeda
        // handler then surfaces MISSING_INIT_POINT as 500.
        //
        // This validates the qzpay log-strategy branch end-to-end, distinct
        // from the previous test which exercised the success-with-missing-url
        // path. Both reach the same 500 but via different qzpay internals.
        mpStub.config.setError(
            'subscriptions.create',
            429,
            'MercadoPago rate limit exceeded',
            'RATE_LIMITED'
        );

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(500);

        // Adapter was called and threw — outcome recorded as 'error'.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('error');

        // Local subscription row persists despite the provider failure (the
        // abandoned-pending-subs cron reaper handles it later). qzpay-core's
        // `log` strategy explicitly keeps the local record so the user can
        // retry by hitting the endpoint again without an orphaned state.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(1);
    });

    it('returns 422 when the promo code is not a valid free-trial extension', async () => {
        // The monthly flow honors only `type: 'free_trial_extension'` promos
        // (SPEC-126 D9). An unknown or non-extension code is rejected at the
        // service layer with INVALID_PROMO_CODE BEFORE any qzpay call, so
        // the failure leaves no DB or adapter side effects.

        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly',
            promoCode: 'unknown-promo-code-xyz'
        });

        expect(response.status).toBe(422);

        // No DB side effects: the promo validation runs before plan lookup
        // and before any qzpay call.
        const subs = await testDb.getDb().select().from(billingSubscriptions);
        expect(subs).toHaveLength(0);

        // Adapter was never called.
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Webhook activation — sub-commit 3
    //
    // MercadoPago delivers `{ id, type: 'subscription_preapproval.updated',
    // data: { id } }` when the user authorizes the recurring charge in MP.
    // The hospeda webhook handler (apps/api/src/routes/webhooks/mercadopago/
    // subscription-logic.ts:218 `processSubscriptionUpdated`) fetches the
    // full preapproval via paymentAdapter.subscriptions.retrieve, maps the
    // MP-side status to the internal SubscriptionStatusEnum via
    // QZPAY_TO_HOSPEDA_STATUS (subscription-logic.ts:77), updates the local
    // row matched by `mp_subscription_id`, and invokes
    // `clearEntitlementCache(customerId)` so the next entitlement lookup
    // sees the post-activation plan immediately (no 5-minute TTL wait).
    //
    // The MP adapter maps MP `'authorized'` to qzpay `'active'`
    // (mercadopago/types.ts:117 MERCADOPAGO_SUBSCRIPTION_STATUS), and
    // QZPAY_TO_HOSPEDA_STATUS maps qzpay `'active'` to
    // SubscriptionStatusEnum.ACTIVE. So stubbing
    // `subscriptions.retrieve` with `status: 'active'` (the post-MP-mapping
    // value) flips the local row to `active` exactly once.
    //
    // The three tests below mirror the annual sub-commit 3 webhook block:
    // happy path (matching mpSubscriptionId), mismatched id (no DB change),
    // invalid signature (401, no DB change).
    // -----------------------------------------------------------------------

    /**
     * Helper: create a pending monthly subscription via the happy path so
     * the webhook tests have something to activate. Resets the stub config
     * before returning so each test's assertions about webhook stub calls
     * are independent of the create-time call.
     */
    async function createPendingMonthlySubscription(): Promise<{
        readonly localSubscriptionId: string;
        readonly mpSubscriptionId: string;
    }> {
        const mpSubscriptionId = `sub_for_activation_${randomUUID().slice(0, 8)}`;
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: mpSubscriptionId,
                status: 'pending',
                initPoint: `https://stub.example/preapproval/${mpSubscriptionId}`
            })
        );
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        mpStub.config.reset();
        return {
            localSubscriptionId: body.data.localSubscriptionId,
            mpSubscriptionId
        };
    }

    /**
     * Helper: build + sign an MP IPN subscription_preapproval.updated payload.
     */
    function buildSignedWebhookRequest(opts: {
        readonly mpSubscriptionId: string;
    }): {
        readonly body: string;
        readonly headers: Record<string, string>;
    } {
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'subscription_preapproval',
            action: 'subscription_preapproval.updated',
            data: { id: opts.mpSubscriptionId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    it('webhook subscription_preapproval.updated with matching mpSubscriptionId flips the subscription to active', async () => {
        // ARRANGE: pending monthly sub created via happy path
        const { localSubscriptionId, mpSubscriptionId } = await createPendingMonthlySubscription();

        // ARRANGE: stub the three adapter calls qzpay-hono + the handler make.
        // subscriptions.retrieve returns `status: 'active'` — the
        // POST-mapping value (the MP adapter would map MP `'authorized'` to
        // `'active'` via MERCADOPAGO_SUBSCRIPTION_STATUS before returning).
        // The hospeda handler then maps qzpay `'active'` to
        // SubscriptionStatusEnum.ACTIVE and updates the local row.
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_monthly_activation',
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

        // ACT: POST the signed webhook
        const { body, headers } = buildSignedWebhookRequest({ mpSubscriptionId });
        const response = await app.request('/api/v1/webhooks/mercadopago', {
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
        expect(mpStub.config.getCalls('subscriptions.retrieve')).toHaveLength(1);
    });

    it('webhook with mismatched mpSubscriptionId leaves the existing subscription untouched', async () => {
        // ARRANGE: pending monthly sub
        const { localSubscriptionId, mpSubscriptionId } = await createPendingMonthlySubscription();

        // ARRANGE: webhook carries a *different* mpSubscriptionId — one that
        // does not match any subscription row. The handler should log the
        // miss + acknowledge the event without mutating the existing sub.
        const mismatchedMpId = `sub_mismatch_${randomUUID().slice(0, 8)}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_monthly_mismatch',
                type: 'subscription_preapproval.updated',
                data: { id: mismatchedMpId }
            })
        );
        mpStub.config.setSuccess(
            'subscriptions.retrieve',
            providerResponseFixtures.subscription({
                id: mismatchedMpId,
                status: 'active'
            })
        );

        // ACT
        const { body, headers } = buildSignedWebhookRequest({
            mpSubscriptionId: mismatchedMpId
        });
        const response = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT: 200 (event acknowledged) and the original sub is unchanged.
        expect(response.status).toBe(200);

        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        // The original sub did NOT flip to active. qzpay-drizzle 1.7.4+
        // leaves it in `'incomplete'` until the matching preapproval webhook
        // arrives, so pin the exact status (no laxer `.not.toBe('active')`)
        // to catch regressions in either the storage adapter (the initial
        // status) or the webhook handler (which must NOT update on a miss).
        expect(subs[0]?.status).toBe('incomplete');

        // ASSERT: no NEW subscription was created for the unknown preapproval id.
        const subsForMismatched = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.mpSubscriptionId, mismatchedMpId));
        expect(subsForMismatched).toHaveLength(0);

        // The expected sub still exists with its original mp_subscription_id.
        const subsForOriginal = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.mpSubscriptionId, mpSubscriptionId));
        expect(subsForOriginal).toHaveLength(1);
    });

    it('webhook with invalid signature is rejected with 401 and produces no DB change', async () => {
        // ARRANGE: pending monthly sub
        const { localSubscriptionId, mpSubscriptionId } = await createPendingMonthlySubscription();

        // ACT: build a body but use wrong-hmac headers — Hospeda's
        // webhookSignatureMiddleware (HMAC over the body with the test
        // secret) rejects BEFORE qzpay-hono and the handler run.
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'subscription_preapproval',
            action: 'subscription_preapproval.updated',
            data: { id: mpSubscriptionId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const badHeaders = invalidSignatureHeaders({ body, mode: 'wrong-hmac' });

        const response = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...badHeaders
            },
            body
        });

        expect(response.status).toBe(401);

        // ASSERT: subscription untouched. Same `'incomplete'` invariant as
        // the mismatched-id test above — the signature middleware rejects
        // BEFORE the handler runs, so the row never sees the update path.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('incomplete');

        // ASSERT: stub never reached (hospeda's middleware short-circuited).
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(0);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.retrieve')).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Entitlement load post-activation — sub-commit 4
    //
    // Mirrors the annual sub-commit 4 entitlement-reload test but for the
    // monthly preapproval flow. The mini-app probe mounts the REAL
    // entitlementMiddleware against the REAL billing instance + DB, with a
    // synthetic prelude that sets `billingEnabled` + `billingCustomerId` so
    // the middleware does not short-circuit before calling loadEntitlements.
    //
    // Pre-webhook: the sub is `incomplete` (qzpay-core 1.6.4+ post-fix
    // initial status for mode 'paid'). entitlementMiddleware's
    // loadEntitlements filters subscriptions by `status === 'active' ||
    // status === 'trialing'` (entitlement.ts:167), so the lookup finds no
    // active sub and returns an empty set. That empty set is cached.
    //
    // The webhook handler (subscription-logic.ts:218 processSubscriptionUpdated)
    // updates the local row to `active` and invokes
    // `clearEntitlementCache(customerId)` so the next entitlement lookup
    // sees the post-activation plan immediately (no 5-minute TTL wait).
    //
    // Post-webhook: the probe cache-misses (the invalidation removed the
    // entry), re-loads, and surfaces the cheap plan's declared entitlements
    // ('public:read') and limits (ads_per_month=5).
    //
    // SCOPE NOTE: same as the annual sub-commit 4 — this validates the LOAD
    // pipeline only. ENFORCEMENT (wiring requireEntitlement / gateXxx to
    // production routes) is gap work tracked under SPEC-145 as a formal
    // sequential follow-up.
    // -----------------------------------------------------------------------

    it('webhook activation invalidates the entitlement cache and the next lookup loads plan entitlements', async () => {
        // ARRANGE: pending_provider monthly sub via the happy-path helper.
        // Capture the qzpay customerId for the probe mini-app.
        const { localSubscriptionId, mpSubscriptionId } = await createPendingMonthlySubscription();
        const subRows = await testDb
            .getDb()
            .select({ customerId: billingSubscriptions.customerId })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        const customerId = subRows[0]?.customerId as string;
        expect(customerId).toMatch(/^[0-9a-f-]{36}$/);

        // ARRANGE: mini-app that runs the REAL entitlementMiddleware
        // against the REAL billing instance. The synthetic prelude sets
        // billingEnabled + billingCustomerId so loadEntitlements actually
        // runs (it short-circuits when either is missing).
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

        // ACT 1: probe BEFORE webhook activation. The sub is in `incomplete`
        // (qzpay-core 1.6.4 post-fix initial status for mode 'paid'), so
        // loadEntitlements finds no active sub and returns the tourist-free
        // fallback (SPEC-143 T-143-58). The fallback set lands in the cache.
        const preRes = await probeApp.request('/probe');
        expect(preRes.status).toBe(200);
        const preBody = (await preRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        // Tourist-free entitlements: SAVE_FAVORITES, WRITE_REVIEWS,
        // READ_REVIEWS, CAN_VIEW_RECOMMENDATIONS (4 keys, max_favorites=3).
        // The exact shape comes from TOURIST_FREE_PLAN.
        expect(new Set(preBody.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'can_view_recommendations'])
        );
        expect(preBody.limits).toEqual({ max_favorites: 3 });
        expect(preBody.billingLoadFailed).toBe(false);

        // Snapshot the cache size so we can prove exactly one entry was
        // removed by the webhook handler (the singleton may carry entries
        // for other customers from prior tests; assert a delta of -1 rather
        // than an absolute value).
        const cacheSizeBeforeWebhook = getEntitlementCacheStats().size;
        expect(cacheSizeBeforeWebhook).toBeGreaterThanOrEqual(1);

        // ACT 2: subscription_preapproval.updated webhook activates the sub
        // AND invokes clearEntitlementCache for this customer
        // (subscription-logic.ts:480 in hospeda).
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_monthly_reload',
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
        const { body, headers } = buildSignedWebhookRequest({ mpSubscriptionId });
        const webhookRes = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
        expect(webhookRes.status).toBe(200);

        // ASSERT: the webhook handler removed exactly this customer's entry
        // from the cache. Other customers' entries (if any) are untouched,
        // so the delta is -1.
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
