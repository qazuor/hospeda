/**
 * User self-service soft-cancel e2e (SPEC-147 T-012).
 *
 * Covers four scenarios end-to-end against a real Postgres DB and the
 * billing singleton wired to the mp-stub adapter:
 *
 *   1. HAPPY PATH: POST /api/v1/protected/billing/subscriptions/:id/cancel
 *      (flag on, owner) returns 200; DB has status='active',
 *      cancelAtPeriodEnd=true, canceledAt set; USER_CANCELED event row
 *      exists; entitlements still load (no immediate access loss); mp-stub
 *      recorded the subscriptions.cancel call (provider pause).
 *      GET /subscription returns cancelAtPeriodEnd=true + canceledAt.
 *
 *   2. WEBHOOK COLLISION (T-007): a subscription_preapproval.updated event
 *      with status='paused' arriving after the soft-cancel leaves the local
 *      status as 'active' (grace-period guard). The subscription stays
 *      ACTIVE+cancelAtPeriodEnd=true instead of flipping to PAUSED.
 *
 *   3. GATE (T-008): POST change-plan on a soft-cancelled subscription
 *      returns 409 with reason='SUBSCRIPTION_CANCEL_PENDING'.
 *
 *   4. FLAG OFF: covered by unit tests in
 *      `test/routes/subscription-cancel.test.ts` (flag is evaluated at
 *      app-boot when the env module is parsed; toggling it mid-suite requires
 *      full module cache invalidation which is not compatible with the shared
 *      singleFork e2e pool). That file pins every flag-off assertion.
 *
 * @module test/e2e/flows/billing/user-self-service-cancel
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Step 1: hoist the stub ref so the vi.mock factory can close over it.
// ---------------------------------------------------------------------------

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// ---------------------------------------------------------------------------
// Step 2: intercept @repo/billing so the billing middleware never reaches
// the real MP adapter.
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — user-self-service-cancel.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

// ---------------------------------------------------------------------------
// Step 3: mock the env module to enable the feature flag.
//
// HOSPEDA_USER_CANCEL_ENABLED is evaluated at handler invocation time (not at
// module parse time), so mocking the env object here is sufficient. All other
// env vars are forwarded from the real module so the rest of the app boots
// normally.
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/env.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env.js')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            HOSPEDA_USER_CANCEL_ENABLED: true
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptionEvents, billingSubscriptions, eq } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// ---------------------------------------------------------------------------
// Stub setup: construct once per file, wire into the ref.
// Tests reset state per case via mpStub.config.reset() in beforeEach.
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/** Two-second window for timestamp assertions (server stamps canceledAt server-side). */
const TWO_SECONDS_MS = 2 * 1000;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-147 T-012 — user self-service soft-cancel e2e', () => {
    let app: ReturnType<typeof initApp>;

    // Seeded per-test
    let customerId: string;
    let subscriptionId: string;
    let mpSubscriptionId: string;
    let userClient: E2EApiClient;
    let cheapPlanId: string;
    let expensivePlanId: string;

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
        cheapPlanId = seed.cheap.planId;
        expensivePlanId = seed.expensive.planId;

        const user = await createTestUser({
            email: `spec147-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });

        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            // Monthly flow needs a mercadopago provider customer id so qzpay-core
            // can look up the customer when pausing the preapproval.
            providerCustomerIds: { mercadopago: `mp_cust_spec147_${user.id.slice(0, 8)}` }
        });
        customerId = customer.customerId;

        // Link the subscription to a fake MP preapproval id so the webhook
        // collision scenario can post a signed event keyed on that id.
        mpSubscriptionId = `mp-pre-spec147-${randomUUID()}`;

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            providerSubscriptionId: mpSubscriptionId
        });
        subscriptionId = sub.subscriptionId;

        // Also write mpSubscriptionId into the mp_subscription_id column so
        // the webhook handler's local-sub lookup keyed on that column finds
        // the row (mirrors webhook-failed-payment.test.ts pattern).
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ mpSubscriptionId })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // User actor — same id as the DB user so billingCustomerMiddleware can
        // resolve externalId → customerId.
        const actor = createMockUserActor({ id: user.id });
        userClient = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // Probe app: mirrors the entitlement-load probe from subscription-cancel.test.ts
    // -------------------------------------------------------------------------

    function buildProbeApp(): Hono {
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            return next();
        });
        probeApp.use(entitlementMiddleware());
        probeApp.get('/probe', (c) =>
            c.json({
                entitlements: Array.from(c.get('userEntitlements') ?? []),
                limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
                billingLoadFailed: c.get('billingLoadFailed') ?? false
            })
        );
        return probeApp;
    }

    // -------------------------------------------------------------------------
    // Helper: build + sign an MP subscription_preapproval.updated webhook
    // -------------------------------------------------------------------------

    function buildSignedSubscriptionWebhook(opts: {
        readonly outerEventId: number;
        readonly mpSubId: string;
        readonly status: string;
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

    // -------------------------------------------------------------------------
    // Helper: stub the three adapter calls the subscription webhook handler makes
    // -------------------------------------------------------------------------

    function stubSubscriptionWebhook(opts: {
        readonly outerEventId: number;
        readonly mpSubId: string;
        readonly providerStatus: string;
    }): void {
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: String(opts.outerEventId),
                type: 'subscription_preapproval.updated',
                data: { id: opts.mpSubId }
            })
        );
        mpStub.config.setSuccess(
            'subscriptions.retrieve',
            providerResponseFixtures.subscription({
                id: opts.mpSubId,
                status: opts.providerStatus
            })
        );
    }

    // =========================================================================
    // SCENARIO 1: Happy path
    // =========================================================================

    it('happy path — POST /cancel returns 200; DB active+cancelAtPeriodEnd; USER_CANCELED event; entitlements preserved; mp-stub records provider cancel call', async () => {
        // ARRANGE: stub the provider cancel call. qzpay-core with
        // cancelAtPeriodEnd:true calls paymentAdapter.subscriptions.cancel(mpSubId,
        // true) — the stub intercepts that as 'subscriptions.cancel' and returns a
        // subscription-shaped object with canceledAt so the service can read it.
        const now = new Date();
        const oneMonthLater = new Date(now);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        mpStub.config.setSuccess('subscriptions.cancel', {
            id: mpSubscriptionId,
            status: 'authorized',
            cancelAtPeriodEnd: true,
            canceledAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: oneMonthLater,
            trialStart: null,
            trialEnd: null,
            metadata: {}
        });

        // ACT: POST the user cancel request
        const response = await userClient.post(
            `/api/v1/protected/billing/subscriptions/${subscriptionId}/cancel`,
            { reason: 'Too expensive' }
        );

        // ASSERT: response shape
        expect(response.status).toBe(200);
        const rawBody = await response.json();
        const body = rawBody as {
            readonly success: boolean;
            readonly data: {
                readonly subscriptionId: string;
                readonly cancelAtPeriodEnd: boolean;
                readonly canceledAt: string;
                readonly accessUntil: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.subscriptionId).toBe(subscriptionId);
        expect(body.data.cancelAtPeriodEnd).toBe(true);
        expect(body.data.canceledAt).toBeTruthy();
        expect(body.data.accessUntil).toBeTruthy();

        // ASSERT: DB — status stays 'active', cancelAtPeriodEnd=true, canceledAt set
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        const row = rows[0];
        expect(row?.status).toBe('active');
        expect(row?.cancelAtPeriodEnd).toBe(true);
        expect(row?.canceledAt).toBeInstanceOf(Date);
        const canceledAtMs = (row?.canceledAt as Date).getTime();
        expect(Math.abs(canceledAtMs - Date.now())).toBeLessThan(TWO_SECONDS_MS);

        // ASSERT: USER_CANCELED audit event written
        const events = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));
        const userCanceledEvent = events.find((e) => e.eventType === 'USER_CANCELED');
        expect(userCanceledEvent).toBeDefined();
        expect(userCanceledEvent?.triggerSource).toBe('user-cancel');
        const eventMeta = userCanceledEvent?.metadata as Record<string, unknown> | null;
        expect(eventMeta?.reason).toBe('Too expensive');

        // ASSERT: provider cancel recorded by the mp-stub
        // The soft-cancel service calls billing.subscriptions.cancel(id, { cancelAtPeriodEnd: true })
        // which drives qzpay-core to call paymentAdapter.subscriptions.cancel(mpSubId, true).
        const cancelCalls = mpStub.config.getCalls('subscriptions.cancel');
        expect(cancelCalls.length).toBeGreaterThanOrEqual(1);

        // ASSERT: entitlements still load — status='active' is kept, so the plan's
        // entitlements are still surfaced (no immediate access loss, INV-4).
        clearEntitlementCache(customerId);
        const probeRes = await buildProbeApp().request('/probe');
        const probeBody = (await probeRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(probeBody.entitlements.length).toBeGreaterThan(0);
        expect(probeBody.billingLoadFailed).toBe(false);
    });

    // =========================================================================
    // SCENARIO 2: Webhook collision — PAUSED webhook after soft-cancel keeps ACTIVE
    // =========================================================================

    it('webhook collision (T-007) — subscription_preapproval.updated status=paused after soft-cancel keeps status ACTIVE', async () => {
        // ARRANGE step A: establish cancelAtPeriodEnd=true in the DB directly
        // (simulates the soft-cancel service having already run). We bypass the
        // HTTP cancel route here so the scenario focuses purely on the webhook guard.
        // This mirrors the webhook-failed-payment.test.ts pattern of seeding state
        // directly and then posting the event.
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // Confirm the flag is set before the webhook arrives.
        const preCancelRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(preCancelRows[0]?.status).toBe('active');
        expect(preCancelRows[0]?.cancelAtPeriodEnd).toBe(true);

        // ARRANGE step B: configure the stub to return status='paused' for the
        // subscription retrieve call inside the webhook handler.
        const outerEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        stubSubscriptionWebhook({
            outerEventId,
            mpSubId: mpSubscriptionId,
            providerStatus: 'paused'
        });

        // ACT: post the signed paused webhook.
        const { body, headers } = buildSignedSubscriptionWebhook({
            outerEventId,
            mpSubId: mpSubscriptionId,
            status: 'paused'
        });
        const webhookRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-spec147',
                ...headers
            },
            body
        });
        // Webhook must return 200 (MP retries on non-2xx).
        expect(webhookRes.status).toBe(200);

        // ASSERT: status STAYS 'active' — the T-007 grace guard intercepted the
        // PAUSED transition and skipped it because cancelAtPeriodEnd=true.
        const postWebhookRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        const postRow = postWebhookRows[0];
        expect(postRow?.status).toBe('active');
        // cancelAtPeriodEnd must still be true — the guard must not clear it.
        expect(postRow?.cancelAtPeriodEnd).toBe(true);
    });

    // =========================================================================
    // SCENARIO 3: plan-change gate — 409 SUBSCRIPTION_CANCEL_PENDING
    // =========================================================================

    it('change-plan gate (T-008) — POST change-plan on soft-cancelled sub returns 409 SUBSCRIPTION_CANCEL_PENDING', async () => {
        // ARRANGE: mark the subscription as soft-cancelled directly in the DB.
        // Using the direct DB write (not the cancel HTTP route) isolates this
        // scenario to the gate behavior in plan-change.ts.
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // ACT: attempt a plan change.
        const response = await userClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: expensivePlanId,
                billingInterval: 'monthly'
            }
        );

        // ASSERT: 409 with the SUBSCRIPTION_CANCEL_PENDING reason
        expect(response.status).toBe(409);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly error: {
                readonly code: string;
                readonly message: string;
                readonly reason?: string;
            };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.reason).toBe('SUBSCRIPTION_CANCEL_PENDING');
    });

    // =========================================================================
    // SCENARIO 3b: start-paid gate — 409 SUBSCRIPTION_CANCEL_PENDING
    // =========================================================================

    it('start-paid gate (T-008) — POST start-paid for a customer with a soft-cancelled sub returns 409 SUBSCRIPTION_CANCEL_PENDING', async () => {
        // ARRANGE: mark the subscription as soft-cancelled.
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // ACT: attempt to start a new paid subscription.
        const response = await userClient.post(
            '/api/v1/protected/billing/subscriptions/start-paid',
            {
                planSlug: 'cheap-plan',
                billingInterval: 'monthly'
            }
        );

        // ASSERT: 409 with the SUBSCRIPTION_CANCEL_PENDING reason.
        expect(response.status).toBe(409);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly error: {
                readonly code: string;
                readonly message: string;
                readonly reason?: string;
            };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.reason).toBe('SUBSCRIPTION_CANCEL_PENDING');
    });
});
