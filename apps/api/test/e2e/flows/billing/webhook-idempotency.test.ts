/**
 * Webhook idempotency — duplicate event id (SPEC-143 T-143-15).
 *
 * Validates the OUTER idempotency layer in the MercadoPago webhook
 * pipeline: `event-handler.ts` does an optimistic INSERT into
 * `billing_webhook_events` keyed on `provider_event_id`, which is
 * UNIQUE-indexed at the schema level (qzpay-drizzle PR #20). A
 * duplicate event triggers the UNIQUE violation, the handler SELECTs
 * the existing row, and short-circuits based on its `status`:
 *
 *   - `processed` → return 200 "Webhook already processed", NO downstream dispatch.
 *   - `pending`   → return 200 "Webhook currently being processed", NO downstream dispatch.
 *   - `failed`    → UPDATE back to `pending`, then dispatch downstream (reprocess).
 *
 * Distinct from the INNER idempotency layer pinned by T-143-14
 * sub-commit 3 — that one keys on the MP `payment_id` inside
 * `payment-logic.ts:583` (SELECT against billing_addon_purchases.payment_id)
 * and is specific to the addon dispatch branch. The OUTER layer covered
 * here is generic across all webhook types and runs BEFORE any handler
 * dispatch.
 *
 * IMPORTANT contracts pinned by this test:
 *
 *   1. A duplicate event (same outer `id` → same providerEventId) lands
 *      a single row in `billing_webhook_events`. Two rows would mean the
 *      UNIQUE constraint is missing — the bug fixed in qzpay-drizzle
 *      PR #20 (release 1.7.5).
 *   2. The downstream payment dispatcher runs EXACTLY ONCE across both
 *      events. We assert this via the mp-stub call counter on
 *      `payments.retrieve` — if the second event slipped past idempotency
 *      it would call retrieve a second time.
 *   3. The annual subscription activated by the first event stays
 *      `active` across the duplicate (no state regression, no error).
 *   4. The `failed` → reprocess branch: an event with status='failed' in
 *      the DB IS reprocessed by a subsequent webhook, the row flips back
 *      to `pending` (and eventually to `processed`), and the downstream
 *      dispatch runs once.
 *
 * @module test/e2e/flows/billing/webhook-idempotency
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
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
                    'mp-stub adapter not initialized — webhook-idempotency.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

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

// Construct the stub once per test file and wire it into the ref the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-15 — webhook idempotency (duplicate event id)', () => {
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

        // Seed plans + an authenticated user with a billing customer.
        // The annual happy-path leg uses these to create a
        // pending_provider sub, which the webhook then activates.
        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `webhook-idem-${Date.now()}@example.com`
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

    /**
     * Helper: drive the annual happy path so we have a pending_provider
     * sub ready for the webhook to activate. Mirrors
     * `createPendingAnnualSubscription` in annual-checkout.test.ts.
     */
    async function createPendingAnnualSubscription(): Promise<string> {
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_for_idem',
                url: 'https://stub.example/checkout/for-idem'
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
     * Helper: build a signed MP IPN payment.updated payload. The outer
     * event id is caller-supplied so two invocations can target the
     * SAME providerEventId (the contract under test) or DIFFERENT ones
     * (negative control).
     */
    function buildSignedWebhookRequest(opts: {
        readonly outerEventId: number;
        readonly providerPaymentId: string;
    }): {
        readonly body: string;
        readonly headers: Record<string, string>;
    } {
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

    it('duplicate webhook event id is skipped: single billing_webhook_events row, downstream dispatch runs once', async () => {
        // ARRANGE — pending annual sub created via happy path.
        const localSubscriptionId = await createPendingAnnualSubscription();

        // ARRANGE — both event POSTs share the SAME outer id, which is what
        // ends up in `billing_webhook_events.provider_event_id`. The
        // optimistic INSERT in event-handler.ts will succeed the first
        // time and fail with a UNIQUE violation the second time.
        const sharedOuterEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        const providerPaymentId = `pay_test_${randomUUID()}`;

        // ARRANGE — stub the three adapter calls the webhook pipeline
        // needs. We DELIBERATELY stub `payments.retrieve` with a single
        // queued response (default behavior of setSuccess) — if the
        // second event ran the dispatcher, the second call to retrieve
        // would have no canned response and surface differently. The
        // call counter pinned below is the primary assertion.
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

        // ACT 1 — first webhook lands. INSERT into billing_webhook_events
        // succeeds, downstream dispatch runs, annual sub flips to active.
        const first = buildSignedWebhookRequest({
            outerEventId: sharedOuterEventId,
            providerPaymentId
        });
        const firstResponse = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...first.headers
            },
            body: first.body
        });
        expect(firstResponse.status).toBe(200);

        // Sanity — the sub was activated and a single row landed in
        // billing_webhook_events.
        const subsAfterFirst = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subsAfterFirst[0]?.status).toBe('active');

        const eventsAfterFirst = await testDb
            .getDb()
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, String(sharedOuterEventId)));
        expect(eventsAfterFirst).toHaveLength(1);
        const firstRowId = eventsAfterFirst[0]?.id;
        expect(firstRowId).toBeDefined();
        // Hospeda's event-handler.ts marks the row 'processed' once the
        // dispatcher completes (markEventProcessedByProviderId in
        // payment-handler.ts). Pin this for the duplicate-skip branch
        // that reads exactly this status to decide its response message.
        expect(eventsAfterFirst[0]?.status).toBe('processed');

        // ACT 2 — second webhook with the SAME providerEventId. The
        // optimistic INSERT in event-handler.ts trips the UNIQUE index
        // (idx_webhook_events_provider_id, UNIQUE since qzpay-drizzle
        // 1.7.5). The handler short-circuits, returns 200, and the
        // downstream dispatcher is NOT invoked again.
        const second = buildSignedWebhookRequest({
            outerEventId: sharedOuterEventId,
            providerPaymentId
        });
        const secondResponse = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...second.headers
            },
            body: second.body
        });
        expect(secondResponse.status).toBe(200);

        // ASSERT — still EXACTLY ONE row in billing_webhook_events. Two
        // rows would mean the UNIQUE index is missing (the bug that
        // motivated qzpay-drizzle PR #20).
        const eventsAfterSecond = await testDb
            .getDb()
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, String(sharedOuterEventId)));
        expect(eventsAfterSecond).toHaveLength(1);
        expect(eventsAfterSecond[0]?.id).toBe(firstRowId);

        // ASSERT — the sub is still active and intact. The second event
        // did not corrupt or re-mutate any state.
        const subsAfterSecond = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subsAfterSecond[0]?.status).toBe('active');

        // ASSERT — the downstream dispatcher ran EXACTLY ONCE across
        // both events. This is the strongest signal that the idempotency
        // short-circuit fired: `payments.retrieve` is the first thing
        // the dispatch path does, so if the second event slipped past
        // event-handler.ts the counter would be 2.
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);
        // verifySignature + constructEvent fire on EVERY incoming event
        // — they run in middleware BEFORE event-handler.ts's idempotency
        // check. Pin them as 2 so a regression in the middleware stack
        // (e.g. moving idempotency upstream) surfaces here.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(2);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(2);
    });

    it('failed previous event id is reprocessed: row flips back to processed, dispatcher runs once', async () => {
        // ARRANGE — pending annual sub created via happy path. The webhook
        // we send below activates it.
        const localSubscriptionId = await createPendingAnnualSubscription();

        // ARRANGE — pre-seed a 'failed' row in billing_webhook_events
        // for the providerEventId we are about to POST. This mirrors the
        // production state where a previous attempt errored out (the
        // markEventFailedByProviderId path in event-handler.ts:261). The
        // contract under test: a NEW webhook for this same event id
        // should reprocess instead of being skipped.
        const sharedOuterEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        const providerPaymentId = `pay_test_${randomUUID()}`;
        await testDb
            .getDb()
            .insert(billingWebhookEvents)
            .values({
                providerEventId: String(sharedOuterEventId),
                provider: 'mercadopago',
                type: 'payment.updated',
                status: 'failed',
                payload: { stub: 'previous-failed-attempt' },
                error: 'simulated previous failure for SPEC-143 T-143-15',
                attempts: 1,
                livemode: false
            });

        // ARRANGE — stubs for the dispatcher to succeed this time.
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

        // ACT — POST the webhook. The optimistic INSERT trips the UNIQUE
        // constraint, the handler SELECTs the existing row, sees status
        // 'failed', and reprocesses (UPDATE → 'pending', then continue
        // to dispatch).
        const { body, headers } = buildSignedWebhookRequest({
            outerEventId: sharedOuterEventId,
            providerPaymentId
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
        expect(response.status).toBe(200);

        // ASSERT — the dispatcher ran (payments.retrieve called once)
        // and the annual sub is now active. This is the positive proof
        // that the failed-state branch does NOT short-circuit like the
        // processed/pending branches do.
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);

        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs[0]?.status).toBe('active');

        // ASSERT — the existing row is still the only row for this
        // providerEventId (the reprocess path UPDATEs in place, it does
        // NOT insert a second row). Its status has flipped from 'failed'
        // to 'processed' after the dispatcher completed.
        const events = await testDb
            .getDb()
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, String(sharedOuterEventId)));
        expect(events).toHaveLength(1);
        expect(events[0]?.status).toBe('processed');
    });
});
