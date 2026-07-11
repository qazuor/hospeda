/**
 * Annual reactivation e2e flow (HOS-123 T-018/T-019).
 *
 * `annual-checkout.test.ts` (SPEC-143 T-143-09) only covers the FIRST-TIME
 * annual checkout (`POST /billing/subscriptions/start-paid`). This sibling
 * file covers the two reactivation entry points HOS-123 added an annual
 * branch to:
 *
 * ```
 * POST /billing/trial/reactivate               { planId, billingInterval: 'annual' }
 * POST /billing/trial/reactivate-subscription   { planId, billingInterval: 'annual' }
 * ```
 *
 * Both branch, via `TrialService`, into the shared `createAnnualSubscription`
 * helper (HOS-123 T-001/T-002) — a `pending_provider` local row + an upfront
 * `billing.checkout.create({ mode: 'payment' })` — and defer cancelling the
 * OLD subscription to the `payment.updated` webhook confirm path
 * (`confirmAnnualSubscription` → `completeReactivationSupersession`, wired by
 * HOS-123 T-013). This file proves the full two-leg flow for both origins:
 *
 * 1. **From TRIAL** (`/reactivate`): the old TRIALING sub must stay active
 *    and keep granting entitlements until the webhook confirms — the new
 *    annual `pending_provider` row is not itself sufficient.
 * 2. **From CANCELED** (`/reactivate-subscription`): the old sub is already
 *    terminal, but the supersession audit trail must still land, and its
 *    `triggerSource` must read `'subscription-reactivation'` — NOT
 *    `'trial-reactivation'` — the marker
 *    `completeReactivationSupersession` derives from
 *    `metadata.convertedFromTrial` vs `metadata.reactivatedFromCanceled`
 *    (HOS-114 T-009's distinguishing test, re-verified here for the annual
 *    branch).
 *
 * @module test/e2e/flows/billing/annual-reactivation
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// vi.mock is also hoisted. The factory closes over `stubRef` and returns the
// current adapter every time `createMercadoPagoAdapter` is invoked — this is
// the SAME mock both `getQZPayBilling()` (billing middleware) and
// `payment-logic.ts::confirmAnnualSubscription`'s own
// `createMercadoPagoAdapter({ logger })` call resolve to, so the webhook's
// supersession trigger (`completeReactivationSupersession` →
// `completeSupersessionPairing`) consults the SAME stub instance the
// checkout leg configured.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — annual-reactivation.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptionEvents, billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    type CreateTestSubscriptionInput,
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref. Tests
// reset response state per case via mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('HOS-123 T-018/T-019 — annual reactivation e2e', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let customerId: string;
    let cheapPlanId: string;
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

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `annual-reactivation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // Helper: build + sign an MP IPN `payment.updated` payload, matching the
    // pattern established in annual-checkout.test.ts.
    // -------------------------------------------------------------------------

    function buildSignedWebhookRequest(opts: { readonly providerPaymentId: string }): {
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

    /** POST the signed `payment.updated` webhook against the running app. */
    async function postApprovedPaymentWebhook(opts: {
        readonly annualSubscriptionId: string;
        readonly planSlug: string;
    }): Promise<Response> {
        const providerPaymentId = `pay_test_reactivation_${Math.random().toString(36).slice(2, 10)}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_annual_reactivation',
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
                    annualSubscriptionId: opts.annualSubscriptionId,
                    planSlug: opts.planSlug,
                    billingInterval: 'annual'
                }
            })
        );

        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        return app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
    }

    // =========================================================================
    // T-018 — annual reactivation FROM TRIAL
    // =========================================================================

    describe('T-018: annual reactivation from a trialing subscription', () => {
        let oldTrialSubId: string;

        beforeEach(async () => {
            const oldTrial = await createTestSubscription({
                customerId,
                planId: cheapPlanId,
                status: 'trialing',
                billingInterval: 'month'
            });
            oldTrialSubId = oldTrial.subscriptionId;
        });

        it('creates a pending_provider annual sub + checkoutUrl, leaves the old trial sub ACTIVE (still granting entitlements) BEFORE the webhook, then confirms + supersedes on payment.updated', async () => {
            // ARRANGE: stub the upfront checkout.create call.
            const expectedCheckoutUrl = 'https://stub.example/checkout/chk_annual_reactivate_trial';
            mpStub.config.setSuccess(
                'checkout.create',
                providerResponseFixtures.checkout({
                    id: 'chk_annual_reactivate_trial',
                    url: expectedCheckoutUrl,
                    status: 'pending'
                })
            );

            // ACT (leg 1): reactivate from trial onto the annual interval.
            const response = await client.post('/api/v1/protected/billing/trial/reactivate', {
                planId: cheapPlanId,
                billingInterval: 'annual'
            });

            // ASSERT: response shape — pending_provider + a real checkoutUrl
            // (NOT a synchronous activation — HOS-123 spec §3.3/§6.4).
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                readonly success: boolean;
                readonly data: {
                    readonly success: boolean;
                    readonly subscriptionId: string;
                    readonly checkoutUrl: string;
                    readonly status: string;
                };
            };
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
            expect(body.data.status).toBe('pending_provider');
            expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
            const newAnnualSubId = body.data.subscriptionId;
            expect(newAnnualSubId).toMatch(/^[0-9a-f-]{36}$/);
            expect(newAnnualSubId).not.toBe(oldTrialSubId);

            // ASSERT: the new annual row landed pending_provider with the
            // supersession marker + convertedFromTrial='true' (drives the
            // 'trial-reactivation' triggerSource once the webhook confirms).
            const newSubRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, newAnnualSubId));
            expect(newSubRows).toHaveLength(1);
            const newSubRow = newSubRows[0];
            expect(newSubRow?.status).toBe('pending_provider');
            expect(newSubRow?.billingInterval).toBe('year');
            const newSubMetadata = newSubRow?.metadata as Record<string, unknown> | null;
            expect(newSubMetadata?.supersedesSubscriptionId).toBe(oldTrialSubId);
            expect(newSubMetadata?.convertedFromTrial).toBe('true');

            // ── KEY ASSERTION (T-018): the OLD trial subscription is STILL
            // active/granting entitlements immediately after the POST, BEFORE
            // any webhook has arrived — the deferred-cancel contract
            // (HOS-114 §6.4, mirrored for the annual payment-confirm path by
            // HOS-123 T-013). If a regression cancelled it synchronously,
            // this assertion catches it immediately. ─────────────────────────
            const oldSubRowsBeforeWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, oldTrialSubId));
            expect(oldSubRowsBeforeWebhook).toHaveLength(1);
            expect(oldSubRowsBeforeWebhook[0]?.status).toBe('trialing');

            // No supersession audit row should exist yet either — the pairing
            // only completes once the webhook confirms the new sub.
            const auditRowsBeforeWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, newAnnualSubId));
            expect(auditRowsBeforeWebhook).toHaveLength(0);

            // ACT (leg 2): the payment.updated webhook confirms the charge.
            mpStub.config.reset();
            const webhookRes = await postApprovedPaymentWebhook({
                annualSubscriptionId: newAnnualSubId,
                planSlug: cheapPlanName
            });
            expect(webhookRes.status).toBe(200);

            // ASSERT: the new annual subscription is now active.
            const newSubRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, newAnnualSubId));
            expect(newSubRowsAfterWebhook[0]?.status).toBe('active');

            // ASSERT: the deferred supersession completed — the OLD trial sub
            // is now cancelled (qzpay-core's own 1-L 'canceled' write path,
            // same as the monthly HOS-114 flow — trial.service.ts /
            // reactivation-supersession-complete.ts both go through
            // `billing.subscriptions.cancel()`).
            const oldSubRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, oldTrialSubId));
            expect(oldSubRowsAfterWebhook[0]?.status).toBe('canceled');

            // ASSERT: the audit row was written with the trial-reactivation
            // marker, tying the new sub back to the superseded trial sub.
            const auditRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, newAnnualSubId));
            expect(auditRowsAfterWebhook).toHaveLength(1);
            const auditRow = auditRowsAfterWebhook[0];
            expect(auditRow?.triggerSource).toBe('trial-reactivation');
            expect(auditRow?.newStatus).toBe('active');
            const auditMetadata = auditRow?.metadata as Record<string, unknown> | null;
            expect(auditMetadata?.supersededSubscriptionId).toBe(oldTrialSubId);
            expect(auditMetadata?.convertedFromTrial).toBe('true');
        });
    });

    // =========================================================================
    // T-019 — annual reactivation FROM a previously CANCELED subscription
    // =========================================================================

    describe('T-019: annual reactivation from a previously canceled (non-trial) subscription', () => {
        let oldCanceledSubId: string;

        beforeEach(async () => {
            // The superseded subscription must read back as qzpay's own
            // 1-L 'canceled' spelling for `TrialService.reactivateSubscription`
            // to find it via `subscriptions.find(sub => sub.status === 'canceled')`
            // (see reactivation-plan-guard.ts / trial.service.ts — the qzpay
            // SDK vocabulary, NOT Hospeda's 2-L `cancelled` enum value). The
            // {@link CreateTestSubscriptionInput} factory type only lists the
            // Hospeda spelling, so this cast is deliberate — the DB column
            // itself is a plain varchar with no CHECK constraint.
            const oldCanceled = await createTestSubscription({
                customerId,
                planId: cheapPlanId,
                status: 'canceled' as unknown as CreateTestSubscriptionInput['status'],
                billingInterval: 'month'
                // Deliberately no providerSubscriptionId: with no
                // mpSubscriptionId, completeSupersessionPairing's Step 4
                // re-verify falls back to LOCAL storage
                // (billing.subscriptions.get()) instead of consulting the
                // MercadoPago adapter — avoids needing to stub
                // subscriptions.retrieve for this scenario.
            });
            oldCanceledSubId = oldCanceled.subscriptionId;
        });

        it('creates a pending_provider annual sub + checkoutUrl with previousPlanId, then confirms + supersedes on payment.updated with triggerSource="subscription-reactivation"', async () => {
            // ARRANGE
            const expectedCheckoutUrl = 'https://stub.example/checkout/chk_annual_reactivate_sub';
            mpStub.config.setSuccess(
                'checkout.create',
                providerResponseFixtures.checkout({
                    id: 'chk_annual_reactivate_sub',
                    url: expectedCheckoutUrl,
                    status: 'pending'
                })
            );

            // ACT (leg 1): reactivate the canceled subscription onto annual.
            const response = await client.post(
                '/api/v1/protected/billing/trial/reactivate-subscription',
                { planId: cheapPlanId, billingInterval: 'annual' }
            );

            // ASSERT: response shape.
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                readonly success: boolean;
                readonly data: {
                    readonly success: boolean;
                    readonly subscriptionId: string;
                    readonly previousPlanId: string | null;
                    readonly checkoutUrl: string;
                    readonly status: string;
                };
            };
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
            expect(body.data.status).toBe('pending_provider');
            expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
            expect(body.data.previousPlanId).toBe(cheapPlanId);
            const newAnnualSubId = body.data.subscriptionId;
            expect(newAnnualSubId).not.toBe(oldCanceledSubId);

            // ASSERT: the new row carries the canceled-reactivation marker
            // (NOT convertedFromTrial) — the input the webhook later reads to
            // pick the correct triggerSource.
            const newSubRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, newAnnualSubId));
            const newSubMetadata = newSubRows[0]?.metadata as Record<string, unknown> | null;
            expect(newSubMetadata?.supersedesSubscriptionId).toBe(oldCanceledSubId);
            expect(newSubMetadata?.reactivatedFromCanceled).toBe('true');
            expect(newSubMetadata?.convertedFromTrial).toBeUndefined();

            // ACT (leg 2): confirm via the payment.updated webhook.
            mpStub.config.reset();
            const webhookRes = await postApprovedPaymentWebhook({
                annualSubscriptionId: newAnnualSubId,
                planSlug: cheapPlanName
            });
            expect(webhookRes.status).toBe(200);

            // ASSERT: new sub active.
            const newSubRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, newAnnualSubId));
            expect(newSubRowsAfterWebhook[0]?.status).toBe('active');

            // ASSERT: the old (already-terminal) sub is untouched status-wise
            // — still 'canceled' — but the supersession audit trail landed.
            const oldSubRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, oldCanceledSubId));
            expect(oldSubRowsAfterWebhook[0]?.status).toBe('canceled');

            // ── KEY ASSERTION (T-019): the audit row's triggerSource reads
            // 'subscription-reactivation', NOT 'trial-reactivation' — the
            // distinguishing marker `completeReactivationSupersession`
            // derives from `metadata.convertedFromTrial` vs
            // `metadata.reactivatedFromCanceled` on the NEW subscription
            // (subscription-logic.ts:278-279), re-verified here for the
            // annual payment-confirm path (HOS-114 T-009's original
            // assertion, mirrored for HOS-123). ────────────────────────────
            const auditRowsAfterWebhook = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, newAnnualSubId));
            expect(auditRowsAfterWebhook).toHaveLength(1);
            const auditRow = auditRowsAfterWebhook[0];
            expect(auditRow?.triggerSource).toBe('subscription-reactivation');
            const auditMetadata = auditRow?.metadata as Record<string, unknown> | null;
            expect(auditMetadata?.supersededSubscriptionId).toBe(oldCanceledSubId);
            expect(auditMetadata?.reactivatedFromCanceled).toBe('true');
            expect(auditMetadata?.convertedFromTrial).toBeUndefined();
        });
    });
});
