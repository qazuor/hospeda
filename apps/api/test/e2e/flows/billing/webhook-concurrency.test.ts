/**
 * Webhook concurrency — duplicate concurrent + out-of-order (SPEC-143 T-143-64).
 *
 * Distinct from T-143-15 (`webhook-idempotency.test.ts`) which exercises the
 * SEQUENTIAL duplicate path (event A → event A): the first POST commits the
 * row, the second hits the unique constraint and the handler reads the
 * already-existing `processed` row and short-circuits.
 *
 * This file pins the CONCURRENT path and the OUT-OF-ORDER convergence:
 *
 *   Part A — Concurrent duplicate (`Promise.all`):
 *     Two parallel POSTs with the SAME outer event id race the optimistic
 *     INSERT in `event-handler.ts:75-87`. One INSERT wins, the other raises
 *     SQLSTATE 23505. The losing handler enters the 3-attempt SELECT loop
 *     at `event-handler.ts:126-143` to find the winner's row even when it
 *     has not yet returned. The contract under test:
 *       - exactly one `billing_webhook_events` row is committed,
 *       - both responses return 200,
 *       - the downstream dispatcher (`payments.retrieve`) runs at most once.
 *
 *   Part B — Out-of-order delivery (regression-guard):
 *     A monthly subscription's recurring charge is announced by
 *     `subscription_authorized_payment.created` BEFORE the activation event
 *     `subscription_preapproval.created` lands. Today the system has no
 *     explicit reconciliation job for this case — the docs in
 *     `payment-logic.ts:214` describe convergence as a side-effect of the
 *     handlers' idempotency and the eventual arrival of every event. This
 *     test pins the convergent outcome we observe today:
 *       - the authorized-payment handler logs/acks without crashing,
 *       - the later preapproval event still flips the sub to `active`,
 *       - both events end up persisted in `billing_webhook_events` (both
 *         responses return 200 regardless of internal status).
 *     If a future change breaks convergence (e.g. handler order matters,
 *     or one event blocks the other), this test catches it. The exact
 *     internal status of the authorized-payment row (`processed` /
 *     `failed`) is documented inline but NOT pinned — it is current
 *     behavior, not contract.
 *
 * Out of scope:
 *   - the unique-index contract itself (covered by T-143-15).
 *   - the SEQUENTIAL duplicate response message ("Webhook already processed"
 *     vs "currently being processed") — also covered by T-143-15.
 *   - the addon dispatcher idempotency layer (covered by T-143-14 sub-commit 3).
 *
 * @module test/e2e/flows/billing/webhook-concurrency
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (captured at hoist time) and the top-level code below
// (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// Mock factory for the MP adapter so the billing singleton wires against
// our deterministic stub instead of a real network adapter.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — webhook-concurrency.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

// Mock the REST helper the authorized-payment handler uses to enrich each
// event. The IPN payload only carries `data.id`; the MP API call is the
// load-bearing data source. Each Part B case configures this mock per
// scenario via `fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce`.
const fetchAuthorizedPaymentDetailsMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../src/utils/mp-authorized-payment.js', () => ({
    fetchAuthorizedPaymentDetails: fetchAuthorizedPaymentDetailsMock
}));

import { randomUUID } from 'node:crypto';
import { billingSubscriptions, billingWebhookEvents, eq } from '@repo/db';
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

/**
 * Build a signed payment.updated webhook payload. Mirrors the helper in
 * webhook-idempotency.test.ts so the same outer event id can be POSTed by
 * two parallel requests in the concurrent-duplicate test.
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
 * Build a signed subscription_preapproval.created webhook payload. The
 * `.created` action is what MP fires immediately after the user authorizes
 * the recurring charge in the hosted page; `subscription-handler.ts`
 * processes both `.created` and `.updated` through the same handler.
 */
function buildSignedSubscriptionPreapprovalWebhook(opts: {
    readonly outerEventId: number;
    readonly mpSubId: string;
}): { readonly body: string; readonly headers: Record<string, string> } {
    const body = JSON.stringify({
        id: opts.outerEventId,
        type: 'subscription_preapproval',
        action: 'subscription_preapproval.created',
        data: { id: opts.mpSubId },
        date_created: new Date().toISOString(),
        live_mode: false
    });
    const headers = signWebhookPayload({ body });
    return { body, headers };
}

/**
 * Build a signed subscription_authorized_payment.created webhook payload.
 * The outer event id is independent from the preapproval event's id; the
 * two are separate records in `billing_webhook_events`.
 */
function buildSignedAuthorizedPaymentWebhook(opts: {
    readonly outerEventId: number;
    readonly authorizedPaymentId: string;
}): { readonly body: string; readonly headers: Record<string, string> } {
    const body = JSON.stringify({
        id: opts.outerEventId,
        type: 'subscription_authorized_payment',
        action: 'subscription_authorized_payment.created',
        data: { id: opts.authorizedPaymentId },
        date_created: new Date().toISOString(),
        live_mode: false
    });
    const headers = signWebhookPayload({ body });
    return { body, headers };
}

describe('SPEC-143 T-143-64 — webhook concurrency (concurrent + out-of-order)', () => {
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
        fetchAuthorizedPaymentDetailsMock.mockReset();

        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `webhook-concurrency-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
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
     * Drive the annual happy path to produce a pending_provider sub. The
     * mp-stub is reset after this call so each test owns its own
     * `payments.retrieve` configuration.
     */
    async function createPendingAnnualSubscription(): Promise<string> {
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_for_concurrency',
                url: 'https://stub.example/checkout/for-concurrency'
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
     * Drive the monthly happy path to produce an `incomplete` sub with
     * `mp_subscription_id` set. Returns the local sub id and the MP
     * preapproval id so subsequent webhooks can target the same sub.
     */
    async function createIncompleteMonthlySubscription(): Promise<{
        readonly localSubscriptionId: string;
        readonly mpSubscriptionId: string;
    }> {
        const mpSubscriptionId = `sub_monthly_concurrency_${randomUUID().slice(0, 8)}`;
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

    describe('Part A — concurrent duplicate delivery', () => {
        it('two parallel POSTs with the same provider_event_id commit a single row and dispatch once', async () => {
            // ARRANGE — annual sub awaiting activation. The two parallel
            // webhook POSTs target the same outer event id, which
            // unambiguously identifies the row in
            // `billing_webhook_events.provider_event_id` (UNIQUE-indexed).
            const localSubscriptionId = await createPendingAnnualSubscription();
            const sharedOuterEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
            const providerPaymentId = `pay_test_${randomUUID()}`;

            // ARRANGE — stub the three adapter calls the downstream
            // dispatcher invokes. payments.retrieve is the strongest
            // signal because every successful dispatch increments its
            // call counter exactly once.
            mpStub.config.setSuccess('webhooks.verifySignature', true);
            mpStub.config.setSuccess(
                'webhooks.constructEvent',
                providerResponseFixtures.webhookEvent({
                    id: String(sharedOuterEventId),
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

            // ACT — fire both POSTs concurrently. `Promise.all` resolves
            // the in-process app.request invocations near-simultaneously;
            // the race window between the two INSERTs is what
            // event-handler.ts's optimistic-insert + SELECT loop is
            // designed to absorb.
            const requestPair = buildSignedPaymentWebhook({
                outerEventId: sharedOuterEventId,
                providerPaymentId
            });
            const [first, second] = await Promise.all([
                app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'mp-webhook-test',
                        ...requestPair.headers
                    },
                    body: requestPair.body
                }),
                app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'mp-webhook-test',
                        ...requestPair.headers
                    },
                    body: requestPair.body
                })
            ]);

            // ASSERT — both responses are 200 (the loser either short-
            // circuits at the "already processed" branch or short-circuits
            // at the "currently being processed" branch; both return 200).
            expect(first.status).toBe(200);
            expect(second.status).toBe(200);

            // ASSERT — exactly ONE row in billing_webhook_events for the
            // shared provider_event_id. Two rows would mean the UNIQUE
            // index was missing or skipped — the bug fixed in
            // qzpay-drizzle PR #20.
            const eventRows = await testDb
                .getDb()
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, String(sharedOuterEventId)));
            expect(eventRows).toHaveLength(1);

            // ASSERT — the downstream dispatcher (payments.retrieve) ran
            // AT MOST ONCE across both parallel requests. The mp-stub
            // counts every call so a second dispatch would push this
            // count to 2. Idempotency contract: "exactly one side-effect
            // per provider_event_id, regardless of concurrent delivery".
            //
            // We assert `<= 1` instead of `=== 1` because a true race can
            // legitimately produce zero dispatches: both POSTs may take
            // the "currently being processed" branch (status='pending'
            // SELECT) while the winning INSERT is still in flight, then
            // the winning request's downstream dispatch eventually
            // completes. Either outcome (0 or 1 retrieve calls observed
            // here, with the final state still being a single 'processed'
            // row + activated sub) satisfies the at-most-once contract.
            const dispatchCalls = mpStub.config.getCalls('payments.retrieve');
            expect(dispatchCalls.length).toBeLessThanOrEqual(1);

            // ASSERT — final convergent state: subscription is active.
            // If both requests took the "pending" short-circuit and
            // neither completed dispatch, the row stayed pending and the
            // sub stayed unactivated. The race resolution must finish
            // by the time the slower of the two POSTs returns.
            const subRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, localSubscriptionId));
            expect(subRows[0]?.status).toBe('active');

            // ASSERT — the row's final status is 'processed', not stuck
            // at 'pending'. A stuck-pending row would mean the winning
            // INSERT's handler never marked the event processed — a
            // regression we want to catch loudly.
            expect(eventRows[0]?.status).toBe('processed');
        });
    });

    describe('Part B — out-of-order delivery (regression-guard)', () => {
        it('subscription_authorized_payment.created arriving before subscription_preapproval.created converges to a consistent state', async () => {
            // ARRANGE — incomplete monthly sub with mp_subscription_id
            // already set by start-paid. This is the state the system
            // is in WHEN MP starts delivering events.
            const { localSubscriptionId, mpSubscriptionId } =
                await createIncompleteMonthlySubscription();

            // Sanity — pre-condition is `incomplete`, not yet active.
            const preRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, localSubscriptionId));
            expect(preRows[0]?.status).toBe('incomplete');

            // ARRANGE — authorized-payment IPN (the "early" event). The
            // handler fetches MP REST details via the mocked helper.
            // We return a `paymentId: null` shape so the handler ack-
            // and-logs without trying to record a settled payment row.
            // This is the natural pre-settlement state and is the most
            // likely real-world out-of-order pattern (MP sometimes
            // delivers `subscription_authorized_payment.created` with
            // status=scheduled and no payment id before the preapproval
            // activation event lands).
            const authorizedPaymentId = `auth_pay_${randomUUID()}`;
            fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({
                kind: 'ok',
                details: {
                    authorizedPaymentId,
                    preapprovalId: mpSubscriptionId,
                    paymentId: null,
                    transactionAmount: 1500,
                    currencyId: 'ARS',
                    status: 'scheduled',
                    paymentStatus: null,
                    debitDate: new Date().toISOString()
                }
            });

            // ARRANGE — signature verification stub (re-set between
            // POSTs because `setSuccess` is Map.set semantics and
            // `mpStub.config.reset()` would also clear it).
            mpStub.config.setSuccess('webhooks.verifySignature', true);

            // ARRANGE — constructEvent is set to the FIRST event only.
            // Important: the stub's `setSuccess` is a Map.set (see
            // mp-stub.ts:327-329) — it overwrites previous responses for
            // the same operation key. Queue-style multiple-call simulation
            // is NOT supported. We MUST therefore stub the
            // first event, fire its POST, then re-stub for the second
            // event before firing the second POST.
            const authPaymentEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
            const preapprovalEventId = Math.floor(Math.random() * 1_000_000_000) + 200_000_000;
            mpStub.config.setSuccess(
                'webhooks.constructEvent',
                providerResponseFixtures.webhookEvent({
                    id: String(authPaymentEventId),
                    type: 'subscription_authorized_payment.created',
                    data: { id: authorizedPaymentId }
                })
            );

            // ACT 1 — out-of-order event arrives first. Handler should
            // ack-and-log without crashing or mutating sub state.
            const authReq = buildSignedAuthorizedPaymentWebhook({
                outerEventId: authPaymentEventId,
                authorizedPaymentId
            });
            const authRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'mp-webhook-test',
                    ...authReq.headers
                },
                body: authReq.body
            });
            expect(authRes.status).toBe(200);

            // Sanity — sub state did NOT regress and is NOT yet active.
            // The authorized_payment handler does not have authority to
            // activate; it only records charges against an already-active
            // sub. With paymentId=null it should just ack.
            const midRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, localSubscriptionId));
            expect(midRows[0]?.status).toBe('incomplete');

            // ARRANGE — re-stub constructEvent for the second event +
            // subscriptions.retrieve so the preapproval handler can flip
            // the local sub. signature verification stub also re-set
            // because `setSuccess` overwrites on the same key.
            mpStub.config.setSuccess('webhooks.verifySignature', true);
            mpStub.config.setSuccess(
                'webhooks.constructEvent',
                providerResponseFixtures.webhookEvent({
                    id: String(preapprovalEventId),
                    type: 'subscription_preapproval.created',
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

            // ACT 2 — preapproval event arrives second. This is the
            // event that flips the sub to active.
            const preReq = buildSignedSubscriptionPreapprovalWebhook({
                outerEventId: preapprovalEventId,
                mpSubId: mpSubscriptionId
            });
            const preRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'mp-webhook-test',
                    ...preReq.headers
                },
                body: preReq.body
            });
            expect(preRes.status).toBe(200);

            // ASSERT — final convergent state: sub is active. The
            // out-of-order delivery did NOT prevent activation. This is
            // the load-bearing assertion for the regression-guard.
            const finalRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, localSubscriptionId));
            expect(finalRows[0]?.status).toBe('active');

            // ASSERT — both webhook events are persisted. Two distinct
            // provider_event_ids → two distinct rows. The internal
            // `status` of each row depends on handler outcomes — pinned
            // below loosely (any non-`pending` status documents that the
            // handler completed its run; tightening would couple the
            // test to qzpay's lifecycle terminology).
            const authEventRows = await testDb
                .getDb()
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, String(authPaymentEventId)));
            expect(authEventRows).toHaveLength(1);
            expect(['processed', 'failed']).toContain(authEventRows[0]?.status);

            const preEventRows = await testDb
                .getDb()
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, String(preapprovalEventId)));
            expect(preEventRows).toHaveLength(1);
            expect(preEventRows[0]?.status).toBe('processed');
        });
    });
});
