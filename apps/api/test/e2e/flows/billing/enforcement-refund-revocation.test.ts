/**
 * SPEC-145 T-018 (spec T-145-14) — Refund and cancellation revocation at route level
 *
 * Validates that entitlement gates block access IMMEDIATELY after a subscription
 * is terminated via two distinct lifecycle paths, without any manual cache clear
 * between the termination action and the route assertion.
 *
 * Scenarios:
 *
 * 1. REFUND REVOCATION
 *    - Customer on owner-pro (has VIEW_ADVANCED_STATS) → gated route 200.
 *    - Seed a billing_payments row linked to the subscription and a billing_customer
 *      MP provider payment id. Fire a payment.updated webhook with status=refunded.
 *      Webhook path: processPaymentUpdated → applyWebhookRefundLifecycle
 *        → applyRefundLifecycle (payment-logic.ts + refund-lifecycle.service.ts)
 *        → subscription.status flipped to CANCELLED
 *        → clearEntitlementCache called (outside transaction, always)
 *    - Same gated route → 403 IMMEDIATELY (no manual cache clear — webhook cleared it).
 *
 * 2. CANCELLATION REVOCATION
 *    - A second customer on owner-pro → gated route 200.
 *    - Cancel via admin route: POST /api/v1/admin/billing/subscriptions/:id/cancel
 *      { immediate: true } (mirrors subscription-cancel.test.ts happy path).
 *      The onAfterSubscriptionCancel hook (qzpay-admin-hooks.ts) calls
 *      clearEntitlementCache after the qzpay-core cancel commits.
 *    - Same gated route → 403 IMMEDIATELY (no manual cache clear).
 *
 * Real paths used:
 *
 *   REFUND:
 *     POST /api/v1/webhooks/mercadopago?source_news=webhooks
 *     → payment-handler.ts → processPaymentUpdated (payment-logic.ts:679)
 *     → applyWebhookRefundLifecycle (payment-logic.ts:553)
 *     → applyRefundLifecycle (refund-lifecycle.service.ts:122)
 *     → billing_subscriptions.status = CANCELLED
 *     → clearEntitlementCache(customerId) (refund-lifecycle.service.ts:370)
 *
 *   CANCEL:
 *     POST /api/v1/admin/billing/subscriptions/:id/cancel { immediate: true }
 *     → qzpay-hono admin tier (createAdminRoutes/billing.routes.ts)
 *     → onBeforeSubscriptionCancel (double-cancel guard)
 *     → billing.subscriptions.cancel(id, { cancelAtPeriodEnd: false })
 *     → onAfterSubscriptionCancel (qzpay-admin-hooks.ts)
 *     → clearEntitlementCache(customerId)
 *
 * Cache-clear gaps documented:
 *   - REFUND path: clearEntitlementCache IS called unconditionally by
 *     applyRefundLifecycle (outside the transaction). No gap — test DOES NOT
 *     call clearEntitlementCache manually between webhook and assertion.
 *   - CANCEL path: clearEntitlementCache IS called by onAfterSubscriptionCancel.
 *     No gap — test DOES NOT call clearEntitlementCache manually.
 *
 * Fixture strategy (mirrors enforcement-plan-change.test.ts):
 *   - Plans seeded in beforeEach (survive testDb.clean() truncation).
 *   - Fresh user + billing customer + subscription per describe block.
 *   - One cold clearEntitlementCache(customerId) during setup only.
 *   - The billing_payments row for the refund scenario is seeded directly
 *     via raw SQL using the providerPaymentIds JSONB column that the webhook
 *     lookup reads (`billing_payments.provider_payment_ids->>'mercadopago'`).
 *
 * @module test/e2e/flows/billing/enforcement-refund-revocation
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// The billing instance initialises the adapter at construction time; without
// the stub it reaches for live MP credentials and throws at boot.
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
                    'mp-stub adapter not initialized — enforcement-refund-revocation.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { mountQZPayAdminTier } from '../../../../src/routes/billing/admin/index.js';
import { createMockActor, createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key string constants
// Copied as literals to avoid mock entanglement with @repo/billing.
// ---------------------------------------------------------------------------
const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats',
    VIEW_ADVANCED_STATS: 'view_advanced_stats',
    CREATE_PROMOTIONS: 'create_promotions'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Stats actor for the VIEW_ADVANCED_STATS-gated route.
 * Needs CONVERSATION_VIEW_OWN so the route-level permission guard passes
 * before the entitlement gate fires.
 */
function makeStatsActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.CONVERSATION_VIEW_OWN
        ],
        userId
    );
}

/**
 * Admin actor for the subscription-cancel admin route.
 * Must include ACCESS_API_ADMIN + BILLING_READ_ALL (sibling route collision
 * documented in subscription-cancel.test.ts) + MANAGE_SUBSCRIPTIONS.
 */
function makeAdminActor(adminUserId: string): ReturnType<typeof createMockAdminActor> {
    return createMockAdminActor({
        id: adminUserId,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.MANAGE_SUBSCRIPTIONS,
            PermissionEnum.BILLING_READ_ALL
        ]
    });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Assert a 403 ENTITLEMENT_REQUIRED gate block. */
async function expectEntitlementBlock(res: Response): Promise<void> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/** Assert the entitlement gate passed (NOT 403 ENTITLEMENT_REQUIRED). */
async function expectGatePassed(res: Response): Promise<void> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Gate should have passed but got 403 ENTITLEMENT_REQUIRED'
        ).not.toBe('ENTITLEMENT_REQUIRED');
    }
}

// ---------------------------------------------------------------------------
// Webhook helpers
// ---------------------------------------------------------------------------

/**
 * Build and sign a payment.updated IPN payload with the given status.
 * The `data.id` field is what applyWebhookRefundLifecycle reads as mpPaymentId.
 */
function buildSignedRefundWebhook(opts: {
    readonly providerPaymentId: string;
}): { readonly body: string; readonly headers: Record<string, string> } {
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

// ---------------------------------------------------------------------------
// Payment seed helper
// ---------------------------------------------------------------------------

/**
 * Insert a billing_payments row linked to the given subscription, in
 * 'succeeded' state, ready to trigger the refund lifecycle when MP fires a
 * payment.updated with status=refunded.
 *
 * The applyWebhookRefundLifecycle function resolves the local payment row via:
 *   SELECT ... FROM billing_payments
 *   WHERE billing_payments.provider_payment_ids->>'mercadopago' = ${mpPaymentId}
 *
 * So providerPaymentIds MUST carry the same key we pass to the webhook.
 */
async function seedSubscriptionPayment(input: {
    readonly customerId: string;
    readonly subscriptionId: string;
    readonly providerPaymentId: string;
    readonly amount: number;
}): Promise<string> {
    const paymentId = randomUUID();
    const providerPaymentIds = { mercadopago: input.providerPaymentId };
    // Dynamic import avoids module-level import of `sql` which would conflict
    // with the vi.mock intercept scope at the top of the file.
    const { sql } = await import('@repo/db');
    await testDb.getDb().execute(sql`
            INSERT INTO billing_payments (
                id, customer_id, subscription_id,
                amount, currency, status,
                provider, provider_payment_ids,
                metadata, livemode
            ) VALUES (
                ${paymentId},
                ${input.customerId},
                ${input.subscriptionId},
                ${input.amount},
                'ARS',
                'succeeded',
                'mercadopago',
                ${JSON.stringify(providerPaymentIds)}::jsonb,
                ${'{"source":"test-refund-revocation"}'}::jsonb,
                false
            )
        `);
    return paymentId;
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-018 — refund and cancel revoke access at route level', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan id — seeded in beforeEach.
    let ownerProPlanId: string;

    // Gated route under test (requires VIEW_ADVANCED_STATS).
    const GATED_ROUTE = '/api/v1/protected/accommodations/my/favorites-breakdown';

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        // Mount the qzpay admin tier before initApp() so admin cancel routes
        // are registered. Mirrors subscription-cancel.test.ts.
        mountQZPayAdminTier();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // owner-pro: has VIEW_ADVANCED_STATS — the entitlement the gated route requires.
        const ownerPro = await createTestPlan({
            name: `RevocationTest-OwnerPro-${randomUUID().slice(0, 8)}`,
            entitlements: [
                E.PUBLISH_ACCOMMODATIONS,
                E.EDIT_ACCOMMODATION_INFO,
                E.VIEW_BASIC_STATS,
                E.VIEW_ADVANCED_STATS,
                E.CREATE_PROMOTIONS
            ]
        });
        ownerProPlanId = ownerPro.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Scenario 1: REFUND REVOCATION
    //
    // Path: POST /webhooks/mercadopago (payment.updated status=refunded)
    //       → applyWebhookRefundLifecycle → applyRefundLifecycle
    //       → subscription cancelled + clearEntitlementCache (unconditional)
    //
    // NO manual clearEntitlementCache between webhook POST and gate assertion.
    // =========================================================================

    it('REFUND REVOCATION: gated route drops from 200 to 403 after refund webhook fires (no manual cache clear)', async () => {
        // ── Arrange: customer on owner-pro ────────────────────────────────────

        const user = await createTestUser({
            email: `refund-revoc-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        const sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerProPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-refund-revocation' }
        });

        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const statsActor = makeStatsActor(user.id);
        const statsClient = new E2EApiClient(app, statsActor);

        // ── Step 1: gate PASSES before the refund ────────────────────────────
        const before = await statsClient.get(GATED_ROUTE);
        await expectGatePassed(before);
        expect(before.status, `Expected 200 before refund but got ${before.status}`).toBe(200);

        // ── Step 2: seed a billing_payments row linked to the subscription ───
        // applyWebhookRefundLifecycle looks up the local payment by:
        //   billing_payments.provider_payment_ids->>'mercadopago' = mpPaymentId
        // The row must be in 'succeeded' state so the transition to CANCELLED
        // passes the state-machine guard in refund-lifecycle.service.ts.
        const providerPaymentId = `pay_refund_revoc_${randomUUID()}`;
        await seedSubscriptionPayment({
            customerId: customer.customerId,
            subscriptionId: sub.subscriptionId,
            providerPaymentId,
            amount: 50_000 // 500 ARS in centavos
        });

        // ── Step 3: fire the payment.updated webhook with status=refunded ────
        //
        // The webhook dispatch chain:
        //   processPaymentUpdated checks paymentInfo.status === 'refunded'
        //   → applyWebhookRefundLifecycle({ mpPaymentId, data, source })
        //   → resolves local payment row via providerPaymentIds JSONB lookup
        //   → calls applyRefundLifecycle({ payment, refundAmount, source:'webhook' })
        //   → detects isFullRefund (transaction_amount_refunded absent → full)
        //   → transitions subscription → CANCELLED
        //   → clearEntitlementCache(customerId)  [outside transaction, unconditional]
        //
        // The stub must respond to:
        //   webhooks.verifySignature → true (signature check passes)
        //   webhooks.constructEvent  → the event object that payment-handler dispatches
        //   payments.retrieve        → the payment object with status='refunded'

        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_refund_revoc_test',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'refunded',
                amount: 50_000,
                currency: 'ARS',
                // No annualSubscriptionId, planChangeUpgradeId, or addonSlug metadata —
                // this is a plain subscription payment refund. applyWebhookRefundLifecycle
                // reads data.transaction_amount_refunded (absent here) → full refund.
                metadata: {
                    customerId: customer.customerId,
                    source: 'test-refund-revocation'
                }
            })
        );

        const { body: whBody, headers: whHeaders } = buildSignedRefundWebhook({
            providerPaymentId
        });

        const whRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...whHeaders
            },
            body: whBody
        });

        // Webhook endpoint always returns 200 (fail-safe — MP retries on non-2xx).
        expect(whRes.status, `webhook returned ${whRes.status}`).toBe(200);

        // Verify subscription was cancelled (confirms applyRefundLifecycle ran).
        const { billingSubscriptions, eq } = await import('@repo/db');
        const subRows = await testDb
            .getDb()
            .select({ status: billingSubscriptions.status })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, sub.subscriptionId));
        // applyRefundLifecycle writes SubscriptionStatusEnum.CANCELLED ('cancelled').
        expect(subRows[0]?.status, 'subscription should be cancelled after refund lifecycle').toBe(
            'cancelled'
        );

        // ── Step 4: gate BLOCKS immediately — no manual cache clear ──────────
        // applyRefundLifecycle calls clearEntitlementCache unconditionally (outside
        // the transaction). The next request re-loads from DB → cancelled sub
        // → tourist-free fallback (no VIEW_ADVANCED_STATS) → 403.
        const afterRefund = await statsClient.get(GATED_ROUTE);
        await expectEntitlementBlock(afterRefund);
    });

    // =========================================================================
    // Scenario 2: CANCELLATION REVOCATION
    //
    // Path: POST /api/v1/admin/billing/subscriptions/:id/cancel { immediate:true }
    //       → qzpay-hono admin tier → billing.subscriptions.cancel
    //       → onAfterSubscriptionCancel (qzpay-admin-hooks.ts)
    //       → clearEntitlementCache(customerId)
    //
    // NO manual clearEntitlementCache between cancel POST and gate assertion.
    // =========================================================================

    it('CANCELLATION REVOCATION: gated route drops from 200 to 403 after admin cancel fires (no manual cache clear)', async () => {
        // ── Arrange: second customer on owner-pro (isolated from scenario 1) ─

        const user = await createTestUser({
            email: `cancel-revoc-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        const sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerProPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-cancel-revocation' }
        });

        // Cold cache after setup — only manual cache clear in this test.
        clearEntitlementCache(customer.customerId);

        const statsActor = makeStatsActor(user.id);
        const statsClient = new E2EApiClient(app, statsActor);

        // Admin user + client.
        const adminUser = await createTestUser({
            email: `cancel-revoc-admin-${randomUUID().slice(0, 8)}@example.com`
        });
        const adminClient = new E2EApiClient(app, makeAdminActor(adminUser.id));

        // ── Step 1: gate PASSES before the cancel ────────────────────────────
        const before = await statsClient.get(GATED_ROUTE);
        await expectGatePassed(before);
        expect(before.status, `Expected 200 before cancel but got ${before.status}`).toBe(200);

        // ── Step 2: admin cancel via the qzpay-hono admin route ──────────────
        // { immediate: true } causes qzpay-core to flip status='canceled' (US spelling).
        // onAfterSubscriptionCancel (qzpay-admin-hooks.ts) then calls
        // clearEntitlementCache(customerId). No manual cache clear needed.
        const cancelRes = await adminClient.post(
            `/api/v1/admin/billing/subscriptions/${sub.subscriptionId}/cancel`,
            { immediate: true }
        );

        expect(cancelRes.status, `cancel returned ${cancelRes.status}`).toBe(200);
        const cancelBody = (await cancelRes.json()) as {
            readonly success: boolean;
            readonly data: { readonly id: string; readonly status: string };
        };
        expect(cancelBody.success).toBe(true);
        expect(cancelBody.data.id).toBe(sub.subscriptionId);

        // ── Step 3: gate BLOCKS immediately — no manual cache clear ──────────
        // onAfterSubscriptionCancel cleared the cache. Next request re-loads from
        // DB → canceled sub → tourist-free fallback → no VIEW_ADVANCED_STATS → 403.
        const afterCancel = await statsClient.get(GATED_ROUTE);
        await expectEntitlementBlock(afterCancel);
    });
});
