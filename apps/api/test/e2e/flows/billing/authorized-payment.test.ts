/**
 * Subscription authorized-payment webhook handler — SPEC-143 T-143-33.
 *
 * Validates the MP `subscription_authorized_payment.{created,updated}`
 * event flow end-to-end:
 *
 * ```
 * POST /api/v1/webhooks/mercadopago  (subscription_authorized_payment.{created,updated})
 *   → router.ts dispatches to handleSubscriptionAuthorizedPayment
 *   → extractAuthorizedPaymentId(event)
 *   → fetchAuthorizedPaymentDetails(authorizedPaymentId, accessToken)  [REST]
 *   → if details.paymentId === null → ack, no record
 *   → findLocalSubscriptionByPreapprovalId(details.preapprovalId)
 *   → if no local sub → ack, log warn, no record
 *   → paymentAlreadyRecorded(details.paymentId) → if true, ack, idempotent skip
 *   → billing.payments.record(...)                                     [INSERT billing_payments]
 *   → safeMarkProcessed(event.id)                                      [billing_webhook_events]
 *   → ack 200
 * ```
 *
 * IMPORTANT contracts pinned by this suite:
 *
 *   1. The task notes call this flow "Pre-authorize on signup → capture
 *      on conversion → assert no double-charge + MP authorization-id
 *      tracked". That language is a MISNOMER for this codebase. Hospeda
 *      does NOT use MP's pre-auth/capture (`payments.create` with
 *      `capture: false` then `payments.capture`). The "authorized
 *      payment" here is MP's `subscription_authorized_payment` event
 *      family — IPN notifications for recurring charges executed against
 *      an active preapproval. This file pins THAT flow.
 *
 *   2. `router.ts:105-111` carries a STALE comment claiming the handler
 *      is "acknowledge-only (logs + dedup), with full payment recording
 *      deferred to a follow-up". The handler has been doing the record
 *      (subscription-payment-handler.ts:285) for a while; the comment
 *      lags reality. Out of scope to fix here, captured as a doc gap.
 *
 *   3. Amount is stored in INTEGER centavos. MP returns
 *      `transaction_amount` in MAJOR units (e.g. 999.50 ARS) — the
 *      handler converts via `Math.round(details.transactionAmount * 100)`.
 *      Pin the centavos shape so a regression that drops the conversion
 *      surfaces here.
 *
 *   4. `billing_subscriptions.providerSubscriptionId` does not exist as a
 *      column on the qzpay-drizzle schema; only `mp_subscription_id` is
 *      real. `createTestSubscription`'s `providerSubscriptionId` input is
 *      silently dropped by the `$inferInsert` cast. Tests that need the
 *      preapproval-to-local-sub link MUST update `mp_subscription_id`
 *      directly via raw SQL after the factory call.
 *
 *   5. HOS-225 REGRESSION TEST (fixed upstream bug, engram topic
 *      `bug/qzpay-drizzle-payments-create-loses-provider-ids`):
 *      `qzpay-drizzle/src/adapter/drizzle-storage.adapter.ts`
 *      `createPaymentStorage().create()` used to hardcode
 *      `provider: 'stripe'` and drop `providerPaymentIds` for every
 *      payment, MercadoPago included. Fixed in `@qazuor/qzpay-drizzle`
 *      1.11.5: `create()` now derives `provider` from the
 *      `providerPaymentIds` keys and forwards the map as-is, so a
 *      MercadoPago payment persists `provider = 'mercadopago'` and
 *      `provider_payment_ids = { mercadopago: <mp paymentId> }`. This
 *      fixes two things this suite now pins as CORRECT behavior:
 *        a. `paymentAlreadyRecorded` (handler.ts:115) queries
 *           `provider_payment_ids->>'mercadopago'`, which now MATCHES on
 *           a retried event → a repeated MP webhook no longer inserts a
 *           duplicate `billing_payments` row.
 *        b. Reporting grouped by `provider` correctly distinguishes MP
 *           from any other provider.
 *      Tests below assert the fixed (correct) behavior:
 *      `providerPaymentIds = { mercadopago: <mp paymentId> }`,
 *      `provider = 'mercadopago'`, and the idempotency test asserts a
 *      single billing_payments row for two webhook deliveries of the
 *      same authorized payment.
 *
 * @module test/e2e/flows/billing/authorized-payment
 */

import { vi } from 'vitest';

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));
const fetchAuthorizedPaymentDetailsMock = vi.hoisted(() => vi.fn());

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — authorized-payment.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

// Mock the REST helper that the handler uses to enrich the authorized-payment
// event. The MP API call is the load-bearing data source for this flow; the
// IPN payload only carries `data.id`. Each test configures the mock per case.
vi.mock('../../../../src/utils/mp-authorized-payment.js', () => ({
    fetchAuthorizedPaymentDetails: fetchAuthorizedPaymentDetailsMock
}));

import { and, billingPayments, billingSubscriptions, eq, isNull, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import {
    providerResponseFixtures,
    signWebhookPayload,
    webhookEventFixtures
} from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    createTestUser,
    seedBillingTestPlans,
    type TestBillingPlansSeed
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Build a fully-shaped MPAuthorizedPaymentDetails fixture. Defaults reflect
 * a SUCCESSFUL recurring charge that the handler should record.
 *
 * Passing `paymentId: null` simulates the pre-settlement state
 * (status='scheduled'); the handler logs and ack without recording.
 */
function buildAuthorizedPaymentDetails(overrides: {
    readonly authorizedPaymentId: string;
    readonly preapprovalId: string;
    readonly paymentId: string | null;
    readonly transactionAmount?: number;
    readonly currencyId?: string;
    readonly status?: string;
    readonly paymentStatus?: string | null;
}) {
    return {
        authorizedPaymentId: overrides.authorizedPaymentId,
        preapprovalId: overrides.preapprovalId,
        paymentId: overrides.paymentId,
        transactionAmount: overrides.transactionAmount ?? 1500, // 1500 ARS = 150_000 centavos
        currencyId: overrides.currencyId ?? 'ARS',
        status: overrides.status ?? 'processed',
        paymentStatus: overrides.paymentStatus ?? 'approved',
        debitDate: '2026-05-19T00:00:00Z'
    };
}

describe('SPEC-143 T-143-33 — subscription_authorized_payment webhook', () => {
    let app: ReturnType<typeof initApp>;
    let _seed: TestBillingPlansSeed;
    let customerId: string;
    let subscriptionId: string;
    let mpPreapprovalId: string;

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

        _seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `authorized-payment-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: _seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1
        });
        subscriptionId = sub.subscriptionId;

        // The factory's `providerSubscriptionId` input is silently dropped by
        // the `$inferInsert` cast (the qzpay-drizzle schema only has
        // `mp_subscription_id`, no generic `provider_subscription_id` column).
        // Patch the mp_subscription_id directly so the handler's
        // `findLocalSubscriptionByPreapprovalId` lookup resolves to this row.
        mpPreapprovalId = `2c938084-test-preapp-${Date.now()}`;
        await testDb.getDb().execute(sql`
            UPDATE billing_subscriptions
            SET mp_subscription_id = ${mpPreapprovalId}
            WHERE id = ${subscriptionId}
        `);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Build a signed `subscription_authorized_payment.{created,updated}`
     * webhook request. Outer event id is randomized so qzpay-hono's
     * idempotency tracker does NOT collapse two sequential requests
     * during the idempotency test.
     */
    function buildSignedAuthorizedPaymentWebhook(opts: {
        readonly authorizedPaymentId: string;
        readonly action?: 'created' | 'updated';
    }): { readonly body: string; readonly headers: Record<string, string> } {
        const fixture =
            (opts.action ?? 'created') === 'created'
                ? webhookEventFixtures.subscriptionAuthorizedPaymentCreated({
                      eventId: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
                      paymentId: opts.authorizedPaymentId
                  })
                : webhookEventFixtures.subscriptionAuthorizedPaymentUpdated({
                      eventId: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
                      paymentId: opts.authorizedPaymentId
                  });
        const body = JSON.stringify(fixture);
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    /**
     * Stub the two adapter calls qzpay-hono makes to validate + parse the
     * inbound IPN: webhooks.verifySignature and webhooks.constructEvent.
     *
     * Pass a unique `eventTag` for back-to-back stubs in the same test
     * (e.g. the idempotency case sends two webhooks). qzpay-hono dedups
     * by the constructed event's `id`, so reusing the same string would
     * cause the second dispatch to be silently skipped.
     */
    function stubWebhookDispatch(opts: {
        readonly authorizedPaymentId: string;
        readonly action?: 'created' | 'updated';
        readonly eventTag?: string;
    }): void {
        const action = opts.action ?? 'created';
        const eventId = `evt_test_authpay_${opts.eventTag ?? opts.authorizedPaymentId}_${Math.floor(
            Math.random() * 1_000_000
        )}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: eventId,
                // HOS-191 raw→normalized dispatch gap: qzpay-hono's router
                // dispatches on the NORMALIZED event type (per
                // `MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED` in
                // `@qazuor/qzpay-mercadopago`), which the REAL adapter's
                // `webhooks.constructEvent` derives internally. Because this
                // stub replaces `constructEvent` wholesale, it must emit the
                // already-normalized type itself: `subscription_authorized_
                // payment.created` -> `invoice.paid`,
                // `subscription_authorized_payment.updated` -> `invoice.updated`.
                type: action === 'created' ? 'invoice.paid' : 'invoice.updated',
                data: { id: opts.authorizedPaymentId }
            })
        );
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('records the recurring charge as a billing_payments row with centavos amount, mapped status, and JSONB providerPaymentIds', async () => {
        // ARRANGE — settled charge with full MP details.
        const authorizedPaymentId = `authpay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const mpPaymentId = `pay_settled_${Date.now()}`;
        stubWebhookDispatch({ authorizedPaymentId });
        fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({
            kind: 'ok',
            details: buildAuthorizedPaymentDetails({
                authorizedPaymentId,
                preapprovalId: mpPreapprovalId,
                paymentId: mpPaymentId,
                transactionAmount: 1500, // 1500 ARS in MAJOR units
                currencyId: 'ARS',
                status: 'processed',
                paymentStatus: 'approved'
            })
        });

        // Sanity — no payment row exists pre-webhook.
        const pre = await testDb.getDb().select().from(billingPayments);
        expect(pre).toHaveLength(0);

        // ACT — POST the signed webhook.
        const { body, headers } = buildSignedAuthorizedPaymentWebhook({ authorizedPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT — MP gets a 200 ack regardless of upstream outcome.
        expect(response.status).toBe(200);

        // ASSERT — exactly one billing_payments row inserted with the
        // expected shape: amount converted to centavos, status mapped via
        // mapMpStatusToQZPayStatus, subscriptionId is the local row's UUID,
        // and metadata records the MP authorized-payment id.
        const payments = await testDb.getDb().select().from(billingPayments);
        expect(payments).toHaveLength(1);
        const payment = payments[0];
        expect(payment?.customerId).toBe(customerId);
        expect(payment?.subscriptionId).toBe(subscriptionId);
        expect(payment?.amount).toBe(150_000); // 1500 ARS * 100 = 150000 centavos
        expect(payment?.currency).toBe('ARS');
        expect(payment?.status).toBe('succeeded');
        const metadata = payment?.metadata as Record<string, unknown> | null;
        expect(metadata?.mpAuthorizedPaymentId).toBe(authorizedPaymentId);

        // ASSERT (HOS-225 regression, see file-level note 5) —
        // `provider_payment_ids` carries the real MP payment id and
        // `provider` is derived as 'mercadopago', fixed upstream in
        // `@qazuor/qzpay-drizzle` 1.11.5's `payments.create()`.
        const providerIds = payment?.providerPaymentIds as Record<string, string> | null;
        expect(providerIds).toEqual({ mercadopago: mpPaymentId });
        expect(payment?.provider).toBe('mercadopago');

        // ASSERT — adapter dispatch ran exactly once. The handler does NOT
        // call `payments.retrieve` for this event family (unlike the
        // payment.updated path) — pin that absence too.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(1);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(0);

        // ASSERT — the REST helper was called exactly once with the
        // extracted authorizedPaymentId. Pins the IPN → REST chain.
        expect(fetchAuthorizedPaymentDetailsMock).toHaveBeenCalledTimes(1);
        const callArg = fetchAuthorizedPaymentDetailsMock.mock.calls[0]?.[0] as
            | { authorizedPaymentId: string }
            | undefined;
        expect(callArg?.authorizedPaymentId).toBe(authorizedPaymentId);
    });

    it('HOS-225: handler-level idempotency (paymentAlreadyRecorded) works because qzpay-drizzle 1.11.5 persists providerPaymentIds — duplicate MP webhooks do NOT insert a duplicate billing_payments row', async () => {
        // BUG REGISTRY ENTRY (fixed, engram topic:
        // `bug/qzpay-drizzle-payments-create-loses-provider-ids`):
        //
        // The handler calls `paymentAlreadyRecorded(details.paymentId)` to
        // short-circuit when MP retries the same authorized-payment event
        // (subscription-payment-handler.ts:251). That check executes:
        //
        //     SELECT id FROM billing_payments
        //     WHERE provider_payment_ids->>'mercadopago' = $providerPaymentId
        //
        // Previously, qzpay-drizzle's `payments.create` discarded the
        // `providerPaymentIds` map and stored `'{}'` instead, so the JSONB
        // lookup ALWAYS missed on retried events and every retry inserted a
        // NEW billing_payments row. Fixed in `@qazuor/qzpay-drizzle` 1.11.5:
        // `create()` now derives `provider` from the `providerPaymentIds`
        // keys and persists the map, so the JSONB lookup MATCHES on the
        // second delivery and the handler's dedupe guard fires correctly.
        //
        // Asserting the fixed (correct) behavior: two webhook deliveries of
        // the same authorized payment produce exactly ONE row.
        const authorizedPaymentId = `authpay_idem_${Date.now()}`;
        const mpPaymentId = `pay_idem_${Date.now()}`;

        const details = buildAuthorizedPaymentDetails({
            authorizedPaymentId,
            preapprovalId: mpPreapprovalId,
            paymentId: mpPaymentId
        });

        // First event — fresh `eventTag` so qzpay-hono dedup does not
        // collapse it with anything else.
        stubWebhookDispatch({ authorizedPaymentId, action: 'created', eventTag: 'first' });
        fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({ kind: 'ok', details });
        const first = buildSignedAuthorizedPaymentWebhook({
            authorizedPaymentId,
            action: 'created'
        });
        const firstResponse = await app.request(
            '/api/v1/webhooks/mercadopago?source_news=webhooks',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'mp-webhook-test',
                    ...first.headers
                },
                body: first.body
            }
        );
        expect(firstResponse.status).toBe(200);

        const afterFirst = await testDb.getDb().select().from(billingPayments);
        expect(afterFirst).toHaveLength(1);

        // Second event — different `eventTag` so qzpay-hono's outer-event
        // dedup does NOT short-circuit. The intended guard is the handler's
        // own `paymentAlreadyRecorded`. We want to surface that it does
        // not fire.
        stubWebhookDispatch({ authorizedPaymentId, action: 'updated', eventTag: 'second' });
        fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({ kind: 'ok', details });
        const second = buildSignedAuthorizedPaymentWebhook({
            authorizedPaymentId,
            action: 'updated'
        });
        const secondResponse = await app.request(
            '/api/v1/webhooks/mercadopago?source_news=webhooks',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'mp-webhook-test',
                    ...second.headers
                },
                body: second.body
            }
        );
        expect(secondResponse.status).toBe(200);

        // ASSERT (HOS-225 fix) — still ONE row in billing_payments for the
        // same MP payment id. The handler's idempotency guard fired on the
        // second delivery because `provider_payment_ids->>'mercadopago'`
        // now matches, so `paymentAlreadyRecorded` short-circuits before a
        // second insert. The surviving row is the same one from the first
        // delivery, not a new one.
        const afterSecond = await testDb.getDb().select().from(billingPayments);
        expect(afterSecond).toHaveLength(1);
        expect(afterSecond[0]?.id).toBe(afterFirst[0]?.id);

        // ASSERT — the REST helper was still called both times: the fetch
        // that enriches the IPN payload always happens BEFORE the dedup
        // check, regardless of the fix. Only the downstream insert is
        // skipped on the second delivery.
        expect(fetchAuthorizedPaymentDetailsMock).toHaveBeenCalledTimes(2);
    });

    it('returns 200 without recording a payment when the authorized-payment has no settled paymentId yet (scheduled state)', async () => {
        // ARRANGE — pre-settlement state: MP returns details but the
        // inner payment block has not materialized yet. Handler hits the
        // `!details.paymentId` branch (subscription-payment-handler.ts:218)
        // and ack without inserting.
        const authorizedPaymentId = `authpay_scheduled_${Date.now()}`;
        stubWebhookDispatch({ authorizedPaymentId });
        fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({
            kind: 'ok',
            details: buildAuthorizedPaymentDetails({
                authorizedPaymentId,
                preapprovalId: mpPreapprovalId,
                paymentId: null,
                status: 'scheduled',
                paymentStatus: null
            })
        });

        // ACT
        const { body, headers } = buildSignedAuthorizedPaymentWebhook({ authorizedPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT — 200 ack, no row inserted, REST helper still ran once
        // (the scheduled-state branch is downstream of the fetch).
        expect(response.status).toBe(200);

        const payments = await testDb.getDb().select().from(billingPayments);
        expect(payments).toHaveLength(0);

        expect(fetchAuthorizedPaymentDetailsMock).toHaveBeenCalledTimes(1);
    });

    it('returns 200 without recording when no local subscription is mapped to the MP preapproval id', async () => {
        // ARRANGE — the MP details point at an UNKNOWN preapproval id
        // (no local subscription carries it under mp_subscription_id).
        // Handler hits the `!sub` branch (subscription-payment-handler.ts:236)
        // and ack without inserting. This guards the "stranger" case where
        // a webhook arrives for a subscription not owned by this hospeda
        // instance (e.g. shared MP app across environments).
        const authorizedPaymentId = `authpay_orphan_${Date.now()}`;
        const orphanPreapprovalId = `2c938084-orphan-preapp-${Date.now()}`;
        const mpPaymentId = `pay_orphan_${Date.now()}`;

        // Make sure NO local sub has this preapproval id, even by accident.
        const orphanCheck = await testDb
            .getDb()
            .select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.mpSubscriptionId, orphanPreapprovalId),
                    isNull(billingSubscriptions.deletedAt)
                )
            );
        expect(orphanCheck).toHaveLength(0);

        stubWebhookDispatch({ authorizedPaymentId });
        fetchAuthorizedPaymentDetailsMock.mockResolvedValueOnce({
            kind: 'ok',
            details: buildAuthorizedPaymentDetails({
                authorizedPaymentId,
                preapprovalId: orphanPreapprovalId,
                paymentId: mpPaymentId
            })
        });

        // ACT
        const { body, headers } = buildSignedAuthorizedPaymentWebhook({ authorizedPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT — 200 ack, no payment row inserted (the orphan branch
        // returns early before billing.payments.record).
        expect(response.status).toBe(200);
        const payments = await testDb.getDb().select().from(billingPayments);
        expect(payments).toHaveLength(0);

        // ASSERT — the OWNED subscription (with mpPreapprovalId from
        // beforeEach) is intact; the orphan event must not have side
        // effects on unrelated rows.
        const ownedSubRow = (
            await testDb.getDb().execute(sql`
                SELECT id, status FROM billing_subscriptions WHERE id = ${subscriptionId}
            `)
        ).rows[0] as { id: string; status: string } | undefined;
        expect(ownedSubRow?.status).toBe('active');
    });
});
