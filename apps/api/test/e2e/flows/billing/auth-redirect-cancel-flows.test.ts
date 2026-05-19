/**
 * Secondary auth / redirect / cancel flows (SPEC-143 T-143-44, sub-flows D4/D6/D7/D8).
 *
 * The task scopes eight secondary flows around the checkout edge surface:
 * D1 success-redirect, D2 failure-redirect, D3 pending-redirect,
 * D4 cancel-from-MP, D5 browser-back-during-checkout, D6 double-submit,
 * D7 session-expired-during-checkout, D8 anonymous-checkout-attempt.
 *
 * Four are testable in this vitest e2e suite (the API surface), four are
 * frontend / browser concerns and live elsewhere:
 *
 * | Sub-flow | Testable here | Lives in |
 * |----------|---------------|----------|
 * | D1 success-redirect  | NO  | `apps/web/test/pages/checkout-pages.test.ts` (Astro page source-reading) |
 * | D2 failure-redirect  | NO  | `apps/web/test/pages/checkout-pages.test.ts` |
 * | D3 pending-redirect  | NO  | `apps/web/test/pages/checkout-pages.test.ts` |
 * | D4 cancel-from-MP    | YES | this file (webhook event) |
 * | D5 browser-back      | NO  | Workstream B manual staging smoke (`docs/staging-smoke-checklist.md`) — requires a real browser to reproduce the back-button → reuse-preference race |
 * | D6 double-submit     | YES | this file (concurrent POST /start-paid) |
 * | D7 session-expired   | YES | this file (POST /start-paid with no actor headers) |
 * | D8 anon checkout     | YES | this file (POST /start-paid sans any session) |
 *
 * Bug pin discovered while scoping this file (NOT fixed here — engram
 * topic `bug/back-url-orphan-billing-return`):
 *
 *   1. `apps/api/src/routes/billing/start-paid.ts` resolves MP back_urls
 *      to `${HOSPEDA_SITE_URL}/billing/return` (both for monthly preapproval
 *      and annual checkout). That path does NOT exist in `apps/web/src/pages`.
 *      The user is redirected by the Astro middleware to `/{lang}/billing/return/`
 *      which 404s. The real pages live at `/{lang}/suscriptores/checkout/{success,failure,pending}`.
 *   2. The qzpay MercadoPago checkout adapter sets `back_urls.pending = back_urls.success`
 *      (packages/mercadopago/src/adapters/checkout.adapter.ts:160), so pending
 *      payments land on the success page instead of pending.
 *   3. The back_url string carries no locale prefix; hospeda's web middleware
 *      enforces `/{lang}/` redirects which compound the 404.
 *
 * D7 vs D8 distinction. At the API boundary both yield identical HTTP
 * outcomes — the protected start-paid endpoint rejects the request when
 * `x-mock-actor-*` headers are absent. The semantic difference (D7: a
 * checkout in flight that times out the session vs D8: a logged-out user
 * clicking "Subscribe") lives in the web router's redirect-to-login UX,
 * not in the API. Both tests share the same assertion shape and exist
 * separately to pin the spec's two sub-flow names to concrete behavior.
 *
 * @module test/e2e/flows/billing/auth-redirect-cancel-flows
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
                    'mp-stub adapter not initialized — auth-redirect-cancel-flows.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptionEvents, billingSubscriptions, desc, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
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

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-44 — auth / redirect / cancel secondary flows (D4, D6, D7, D8)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        mpStub.config.reset();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -----------------------------------------------------------------------
    // D4 — cancel-from-MP
    //
    // The user authorizes a preapproval in MP and later cancels it from
    // the MP dashboard (or the bank rejects future charges and MP
    // marks the preapproval cancelled on its side). MP fires a
    // `subscription_preapproval.updated` IPN whose retrieved subscription
    // status is `cancelled`. The hospeda webhook handler must mirror that
    // onto the local row.
    //
    // Pins the cancel-from-provider lifecycle independently of the admin
    // cancel handler (covered in subscription-cancel.test.ts).
    // -----------------------------------------------------------------------

    describe('D4 — cancel-from-MP via subscription_preapproval.updated webhook', () => {
        it('flips an active local sub to cancelled when MP reports preapproval status="cancelled"', async () => {
            // ARRANGE — seed a customer + an active local sub linked to a
            // fake MP preapproval id. The handler keys on
            // `mp_subscription_id` to load the local row.
            const seed = await seedBillingTestPlans();
            const user = await createTestUser({
                email: `d4-cancel-${Date.now()}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email,
                providerCustomerIds: { mercadopago: `mp_cust_${user.id.slice(0, 8)}` }
            });
            const sub = await createTestSubscription({
                customerId: customer.customerId,
                planId: seed.cheap.planId,
                status: 'active'
            });
            const mpSubId = `mp-pre-d4-${randomUUID()}`;
            await testDb
                .getDb()
                .update(billingSubscriptions)
                .set({ mpSubscriptionId: mpSubId })
                .where(eq(billingSubscriptions.id, sub.subscriptionId));

            const outerEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
            mpStub.config.setSuccess('webhooks.verifySignature', true);
            mpStub.config.setSuccess(
                'webhooks.constructEvent',
                providerResponseFixtures.webhookEvent({
                    id: String(outerEventId),
                    type: 'subscription_preapproval.updated',
                    data: { id: mpSubId }
                })
            );
            // The mp-stub returns post-mapStatus QZPayProvider* shapes (see
            // mp-responses.ts module header), not raw MercadoPago payloads.
            // qzpay-mercadopago's mapStatus normalises MP's 'cancelled' to
            // qzpay's 'canceled' (US 1L) during the real retrieve — we
            // skip that step by stubbing 'canceled' directly. Hospeda's
            // QZPAY_TO_HOSPEDA_STATUS then maps 'canceled' →
            // SubscriptionStatusEnum.CANCELLED ('cancelled' UK 2L) on
            // the local row. Engram `bug/cancel-spelling-drift` documents
            // the cross-layer drift.
            mpStub.config.setSuccess(
                'subscriptions.retrieve',
                providerResponseFixtures.subscription({
                    id: mpSubId,
                    status: 'canceled'
                })
            );

            const body = JSON.stringify({
                id: outerEventId,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: { id: mpSubId },
                date_created: new Date().toISOString(),
                live_mode: false
            });
            const headers = signWebhookPayload({ body });

            // ACT — POST the signed webhook.
            const response = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'mp-webhook-test',
                    ...headers
                },
                body
            });

            // ASSERT — webhook acknowledged.
            expect(response.status).toBe(200);

            // ASSERT — local sub flipped to cancelled.
            const rows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, sub.subscriptionId));
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('cancelled');

            // ASSERT — an audit event was written for the transition. The
            // handler stamps `triggerSource` for provider-driven changes;
            // exact source string is implementation-detail but the row
            // must exist with `newStatus='cancelled'`.
            const events = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, sub.subscriptionId))
                .orderBy(desc(billingSubscriptionEvents.createdAt));
            expect(events.length).toBeGreaterThanOrEqual(1);
            expect(events[0]?.newStatus).toBe('cancelled');
        });
    });

    // -----------------------------------------------------------------------
    // D6 — double-submit
    //
    // Two concurrent POSTs to /start-paid from the same user with the
    // same plan slug should ideally collapse to one subscription
    // (idempotency at the application boundary). The current
    // implementation has no idempotency key on the endpoint, so two
    // concurrent calls produce two pending subscriptions. We pin the
    // current behavior with a "When fix lands, flip this" comment so the
    // regression is loud whenever the idempotency layer is added.
    //
    // The abandoned-pending-subs cron (SPEC-126 D6) eventually reaps the
    // extra rows after PENDING_PROVIDER_TTL_MS, so the leak is bounded —
    // but for a user double-clicking the Subscribe button, both rows
    // exist until the cron runs.
    // -----------------------------------------------------------------------

    describe('D6 — double-submit start-paid', () => {
        it('PIN: concurrent POSTs from the same user create two pending subscriptions (no endpoint-level idempotency)', async () => {
            // ARRANGE — one customer, one plan, two distinct MP responses
            // queued in the stub. The stub returns FIFO from the configured
            // success queue, so two concurrent calls each consume one.
            const seed = await seedBillingTestPlans();
            const user = await createTestUser({
                email: `d6-double-${Date.now()}@example.com`
            });
            await createTestBillingCustomer({
                externalId: user.id,
                email: user.email,
                providerCustomerIds: { mercadopago: `mp_cust_${user.id.slice(0, 8)}` }
            });
            const actor = createMockUserActor({ id: user.id });
            const client = new E2EApiClient(app, actor);

            // Two distinct stubbed creates — if idempotency lands later,
            // only one of these will be consumed and the other will sit
            // unused. Both are configured pre-emptively to keep this
            // test deterministic.
            mpStub.config.setSuccess(
                'subscriptions.create',
                providerResponseFixtures.subscription({
                    id: 'sub_d6_first',
                    status: 'pending',
                    initPoint: 'https://stub.example/preapproval/d6_first'
                })
            );
            mpStub.config.setSuccess(
                'subscriptions.create',
                providerResponseFixtures.subscription({
                    id: 'sub_d6_second',
                    status: 'pending',
                    initPoint: 'https://stub.example/preapproval/d6_second'
                })
            );

            // ACT — fire two POSTs concurrently. Promise.all preserves
            // both rejections so we can inspect each response.
            const [resp1, resp2] = await Promise.all([
                client.post('/api/v1/protected/billing/subscriptions/start-paid', {
                    planSlug: seed.cheap.name,
                    billingInterval: 'monthly'
                }),
                client.post('/api/v1/protected/billing/subscriptions/start-paid', {
                    planSlug: seed.cheap.name,
                    billingInterval: 'monthly'
                })
            ]);

            // ASSERT — both succeeded with 201. When idempotency lands,
            // flip this to expect one 201 + one 200 (or 409 Conflict)
            // referencing the existing pending sub.
            expect(resp1.status).toBe(201);
            expect(resp2.status).toBe(201);

            // ASSERT — two pending subs exist in DB. Pin of the gap.
            // `afterEach` truncates between tests so any row landed here is
            // attributable to one of the two concurrent start-paid calls
            // we just made — no need to filter by customer_id (which is
            // the qzpay billing_customers.id, not the actor's user id).
            const subs = await testDb.getDb().select().from(billingSubscriptions);
            expect(subs.length).toBe(2);
            // Both should be in qzpay-core's `incomplete` state (the
            // monthly post-1.6.4 invariant — see monthly-checkout.test.ts).
            for (const row of subs) {
                expect(row.status).toBe('incomplete');
            }

            // ASSERT — the MP adapter was invoked twice. Once idempotency
            // gates the second request before reaching qzpay, this drops
            // to 1.
            const createCalls = mpStub.config.getCalls('subscriptions.create');
            expect(createCalls).toHaveLength(2);
        });
    });

    // -----------------------------------------------------------------------
    // D7 — session-expired during checkout
    //
    // The protected start-paid endpoint sits behind the actor middleware.
    // A request without `x-mock-actor-*` headers in the test mode pipeline
    // never resolves an actor and the protected route returns 401. From
    // the user's perspective this is "session expired while I was on the
    // MP page" — the redirect back from MP lands on /billing/return (the
    // orphan back_url) and the next interaction with the protected API
    // surface fails auth.
    // -----------------------------------------------------------------------

    describe('D7 — session-expired during checkout', () => {
        it('returns 401 when start-paid is called without a valid actor (simulates expired session)', async () => {
            const seed = await seedBillingTestPlans();

            // ACT — no E2EApiClient (which sets mock-actor headers); raw
            // app.request with only content-type. The auth middleware
            // sees no session and rejects.
            const response = await app.request(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest-d7-expired'
                    },
                    body: JSON.stringify({
                        planSlug: seed.cheap.name,
                        billingInterval: 'monthly'
                    })
                }
            );

            // ASSERT — 401 Unauthorized from auth middleware. No
            // subscription rows created.
            expect(response.status).toBe(401);
            const subs = await testDb.getDb().select().from(billingSubscriptions);
            expect(subs).toHaveLength(0);

            // ASSERT — MP adapter never invoked.
            expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // D8 — anonymous checkout attempt
    //
    // A logged-out user navigates to /suscriptores/planes and clicks
    // "Subscribe". The web UI must redirect them to login while
    // preserving the intended plan (the web router's responsibility,
    // tested via the auth-ui smoke checklist). At the API boundary, any
    // POST to /start-paid without auth must be rejected outright with
    // 401 — there is no anonymous checkout path.
    //
    // Same HTTP outcome as D7 (the API cannot tell "I never had a
    // session" apart from "my session just expired"), but pinning both
    // sub-flows separately is the contract: both must yield 401 with no
    // DB or provider side effects.
    // -----------------------------------------------------------------------

    describe('D8 — anonymous checkout attempt', () => {
        it('returns 401 when start-paid is called without any session credentials', async () => {
            const seed = await seedBillingTestPlans();

            const response = await app.request(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest-d8-anonymous'
                    },
                    body: JSON.stringify({
                        planSlug: seed.cheap.name,
                        billingInterval: 'monthly'
                    })
                }
            );

            expect(response.status).toBe(401);

            const subs = await testDb.getDb().select().from(billingSubscriptions);
            expect(subs).toHaveLength(0);

            expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
        });
    });
});
