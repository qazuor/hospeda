/**
 * Dispute/chargeback webhook handler — SPEC-143 T-143-35.
 *
 * Validates the MercadoPago `chargebacks` and `payment.dispute` IPN flow
 * end-to-end:
 *
 * ```
 * POST /api/v1/webhooks/mercadopago  ({chargebacks, payment.dispute})
 *   → router.ts dispatches to handleDisputeOpened
 *   → processDisputeEvent(eventData, eventType, eventId)
 *     ─ apiLogger.warn(...) with dispute metadata
 *     ─ sendNotification(ADMIN_SYSTEM_EVENT) per HOSPEDA_ADMIN_NOTIFICATION_EMAILS  (fire-and-forget)
 *   → markEventProcessedByProviderId(event.id)
 *   → ack 200, no thrown body
 * ```
 *
 * IMPORTANT contracts pinned by this suite:
 *
 *   1. The task notes describe a richer flow that does NOT exist:
 *      "Customer initiates dispute → MP chargeback webhook → subscription
 *      past_due + sub auto-cancels after grace period". The codebase
 *      implements ONLY notification + log; resolution is MANUAL via the
 *      MP dashboard (documented in dispute-handler.ts:5-22 and ADR-008).
 *      The "manual in v1" choice is INTENTIONAL, not a gap. This suite
 *      pins that intent so a future fix that adds auto-cancellation
 *      surfaces here as an inverted assertion.
 *
 *   2. Both `chargebacks` (action='chargebacks') and `payment.dispute`
 *      (type='payment', action='payment.dispute') route to the same
 *      handler. Two separate tests pin the symmetry so a refactor that
 *      diverges them surfaces here.
 *
 *   3. The handler ALWAYS acks 200 — disputes never re-throw because
 *      the in-process notification path is fire-and-forget. Pin the
 *      ack contract so an upstream regression that returns 5xx (which
 *      would trigger MP retries indefinitely) surfaces here.
 *
 * @module test/e2e/flows/billing/chargeback
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
                    'mp-stub adapter not initialized — chargeback.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { and, billingCustomerEntitlements, billingWebhookEvents, eq, sql } from '@repo/db';
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
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-35 — dispute/chargeback webhook', () => {
    let app: ReturnType<typeof initApp>;
    let _seed: TestBillingPlansSeed;
    let customerId: string;
    let subscriptionId: string;
    let paymentId: string;

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

        _seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `chargeback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: _seed.cheap.planId,
            status: 'active'
        });
        subscriptionId = sub.subscriptionId;

        // Seed a succeeded payment + a subscription-source customer entitlement
        // so the manual-in-v1 pin can prove that the dispute handler does NOT
        // mutate either of them.
        paymentId = randomUUID();
        await testDb.getDb().execute(sql`
            INSERT INTO billing_payments (
                id, customer_id, subscription_id,
                amount, currency, status,
                provider, provider_payment_ids, metadata, livemode
            ) VALUES (
                ${paymentId}, ${customerId}, ${subscriptionId},
                500000, 'ARS', 'succeeded',
                'mercadopago', ${'{}'}::jsonb, ${'{}'}::jsonb, false
            )
        `);

        await testDb
            .getDb()
            .insert(billingCustomerEntitlements)
            .values({
                customerId,
                entitlementKey: 'publish_accommodations',
                source: 'subscription',
                sourceId: subscriptionId,
                livemode: false
            } as typeof billingCustomerEntitlements.$inferInsert);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Build + sign a chargebacks or payment.dispute webhook. Each call uses a
     * randomized outer event id so qzpay-hono's dedup tracker treats sequential
     * calls as independent unless the caller explicitly reuses the same id
     * (see idempotency test).
     */
    function buildSignedDisputeWebhook(opts: {
        readonly variant: 'chargebacks' | 'payment.dispute';
        readonly providerPaymentId: string;
        readonly outerEventId?: number;
    }): { readonly body: string; readonly headers: Record<string, string> } {
        const eventId =
            opts.outerEventId ?? Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        const fixture =
            opts.variant === 'chargebacks'
                ? webhookEventFixtures.chargebackOpened({
                      eventId,
                      paymentId: opts.providerPaymentId
                  })
                : webhookEventFixtures.paymentDispute({
                      eventId,
                      paymentId: opts.providerPaymentId
                  });
        const body = JSON.stringify(fixture);
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    /**
     * Stub the two adapter calls qzpay-hono performs at every webhook entry:
     * verifySignature + constructEvent. The dispute handler does NOT call any
     * other adapter operation, so this is the full stub surface needed.
     */
    function stubWebhookDispatch(opts: {
        readonly variant: 'chargebacks' | 'payment.dispute';
        readonly providerPaymentId: string;
        readonly eventTag?: string;
        /**
         * Explicit provider event id to advertise via constructEvent.
         * Pass the SAME value on two sequential stubs to exercise the
         * hospeda dedup path (handleWebhookEvent uses this as the
         * `providerEventId` column key on billing_webhook_events).
         */
        readonly providerEventId?: string;
    }): void {
        const providerEventId =
            opts.providerEventId ??
            `evt_test_dispute_${opts.eventTag ?? opts.providerPaymentId}_${Math.floor(
                Math.random() * 1_000_000
            )}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: providerEventId,
                type: opts.variant === 'chargebacks' ? 'chargebacks' : 'payment.dispute',
                data: { id: opts.providerPaymentId }
            })
        );
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('processes a chargebacks event by acking 200 and marking the webhook event as processed — no DB side effects on sub/payment/entitlements', async () => {
        // ARRANGE
        const providerPaymentId = `pay_chgbk_${Date.now()}`;
        stubWebhookDispatch({ variant: 'chargebacks', providerPaymentId });

        // ACT
        const { body, headers } = buildSignedDisputeWebhook({
            variant: 'chargebacks',
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

        // ASSERT — 200 ack (the dispute handler never throws).
        expect(response.status).toBe(200);

        // ASSERT — the billing_webhook_events row landed and is processed.
        // qzpay-hono inserts the event row at dispatch time; the handler
        // flips its status via markEventProcessedByProviderId(eventId).
        const webhookRows = await testDb
            .getDb()
            .select({ status: billingWebhookEvents.status })
            .from(billingWebhookEvents);
        expect(webhookRows.length).toBeGreaterThanOrEqual(1);
        // Every chargeback-related row must end up processed (we may also
        // pick up unrelated rows from other tests if isolation drifts, but
        // testDb.clean() in afterEach prevents that — assert all are processed
        // to surface drift as a clear failure).
        expect(webhookRows.every((row) => row.status === 'processed')).toBe(true);
    });

    it('processes a payment.dispute event using the same handler as chargebacks (symmetry pin)', async () => {
        // ARRANGE — same setup, different event variant. The router maps
        // both `chargebacks` and `payment.dispute` to handleDisputeOpened
        // (router.ts:115-116); this test pins the alias contract so a
        // refactor that splits them surfaces here.
        const providerPaymentId = `pay_dispute_${Date.now()}`;
        stubWebhookDispatch({ variant: 'payment.dispute', providerPaymentId });

        const { body, headers } = buildSignedDisputeWebhook({
            variant: 'payment.dispute',
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

        const webhookRows = await testDb
            .getDb()
            .select({ status: billingWebhookEvents.status })
            .from(billingWebhookEvents);
        expect(webhookRows.length).toBeGreaterThanOrEqual(1);
        expect(webhookRows.every((row) => row.status === 'processed')).toBe(true);
    });

    it('PINS MANUAL-IN-V1 SCOPE: dispute handler does NOT change subscription status, payment status, or customer entitlements', async () => {
        // PIN ENTRY: dispute-handler.ts:5-22 documents "All dispute resolution
        // is manual in v1". ADR-008 / docs/decisions/ADR-008-afip-deferred-v2.md
        // captures the v1 monetization scope (AFIP, refunds, disputes all
        // deferred). This test pins the absence of auto-resolution so a future
        // spec that introduces auto-cancellation / past_due flips, etc.,
        // surfaces here.
        //
        // When the v2+ work lands, expected assertion flips:
        //   - sub status: 'active' → 'past_due' (or 'cancelled' after grace)
        //   - payment status: 'succeeded' → 'disputed' / 'refunded'
        //   - entitlement count: 1 → 0 (end-dated by the dispute event)
        const providerPaymentId = `pay_pin_manual_${Date.now()}`;
        stubWebhookDispatch({ variant: 'chargebacks', providerPaymentId });

        // Sanity — pre-webhook DB state.
        const preSub = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_subscriptions WHERE id = ${subscriptionId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(preSub?.status).toBe('active');

        const prePayment = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_payments WHERE id = ${paymentId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(prePayment?.status).toBe('succeeded');

        const preGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.customerId, customerId),
                    eq(billingCustomerEntitlements.sourceId, subscriptionId)
                )
            );
        expect(preGrants).toHaveLength(1);

        // ACT
        const { body, headers } = buildSignedDisputeWebhook({
            variant: 'chargebacks',
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

        // ASSERT (MANUAL-IN-V1 PIN) — all three checked surfaces are UNCHANGED.
        const postSub = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_subscriptions WHERE id = ${subscriptionId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(postSub?.status).toBe('active');

        const postPayment = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_payments WHERE id = ${paymentId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(postPayment?.status).toBe('succeeded');

        const postGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.customerId, customerId),
                    eq(billingCustomerEntitlements.sourceId, subscriptionId)
                )
            );
        expect(postGrants).toHaveLength(1);
    });

    it('is idempotent — replaying the SAME outer event id does not insert a second webhook event row', async () => {
        // ARRANGE — qzpay-hono's webhook bucket dedups by the OUTER `id`
        // field of the IPN payload (which becomes the providerEventId
        // column on billing_webhook_events, unique-indexed since SPEC-143
        // T-143-15). Reusing the same outer id is the production retry
        // signature: MP retries the same envelope when an ack is missed.
        // The handler must collapse them into one persisted webhook row.
        const providerPaymentId = `pay_idem_${Date.now()}`;
        const outerEventId = Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
        // Hospeda's onEvent (handleWebhookEvent) dedups on the
        // `providerEventId` column of billing_webhook_events, which is
        // sourced from the parsed event's `id` field (set by the adapter's
        // constructEvent stub). Reuse the SAME stable providerEventId on
        // both stubs so the second insert hits Postgres SQLSTATE 23505 and
        // the dedup branch ("Duplicate webhook skipped - already processed")
        // returns 200 without inserting another row.
        const stableProviderEventId = `evt_test_dispute_idem_${outerEventId}`;
        stubWebhookDispatch({
            variant: 'chargebacks',
            providerPaymentId,
            providerEventId: stableProviderEventId
        });

        const first = buildSignedDisputeWebhook({
            variant: 'chargebacks',
            providerPaymentId,
            outerEventId
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

        const afterFirstRows = await testDb.getDb().select().from(billingWebhookEvents);
        expect(afterFirstRows).toHaveLength(1);
        const firstId = afterFirstRows[0]?.id;

        // ACT — replay with the SAME providerEventId. The duplicate-key
        // INSERT triggers the dedup branch in handleWebhookEvent and the
        // existing row stays unique.
        stubWebhookDispatch({
            variant: 'chargebacks',
            providerPaymentId,
            providerEventId: stableProviderEventId
        });
        const second = buildSignedDisputeWebhook({
            variant: 'chargebacks',
            providerPaymentId,
            outerEventId
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

        const afterSecondRows = await testDb.getDb().select().from(billingWebhookEvents);
        expect(afterSecondRows).toHaveLength(1);
        expect(afterSecondRows[0]?.id).toBe(firstId);
    });
});
