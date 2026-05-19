/**
 * Admin refund flow — SPEC-143 T-143-34.
 *
 * Validates the admin-initiated refund flow end-to-end:
 *
 * ```
 * POST /api/v1/protected/billing/payments/{id}/refund
 *      { amount?: number, reason?: string }
 *
 * → qzpay-hono refund route (billing.routes.ts:333)
 *   ─ billingAdminGuardMiddleware blocks non-admin actors
 *   ─ billing.payments.refund({ paymentId, amount?, reason? })
 *     ─ storage.payments.findById(paymentId)
 *     ─ storage.payments.update(id, {
 *         status: refundAmount >= payment.amount
 *           ? 'refunded'
 *           : 'partially_refunded',
 *         metadata: { ...prev, refundedAmount, refundReason? }
 *       })
 *     ─ emitter.emit('payment.refunded', updated)  (in-process only)
 * → 200 { success: true, data: payment }
 * ```
 *
 * IMPORTANT contracts pinned by this suite:
 *
 *   1. The task notes describe a richer flow that does NOT exist in the
 *      codebase: "Active subscription → refund payment via admin → MP
 *      refund webhook → payment row flipped + entitlements end-dated".
 *      The reality is much smaller — this test pins what is REALLY there
 *      and documents the gaps for follow-up specs.
 *
 *   2. GAP — no MercadoPago refund API call. `billing.payments.refund`
 *      is a LOCAL DB UPDATE only. The user's card is NOT actually
 *      credited; the row in `billing_payments` is flipped to 'refunded'
 *      but MP never sees it. Real refunds today have to be issued
 *      manually from the MP dashboard.
 *
 *   3. GAP — no entitlement end-dating. A refunded payment leaves the
 *      customer's `billing_customer_entitlements` untouched, so the
 *      user keeps access to whatever the original payment granted.
 *
 *   4. GAP — no subscription state change. The linked subscription
 *      stays `active` post-refund. There is no policy in code about
 *      whether a refunded recurring charge should past_due or cancel
 *      the subscription.
 *
 *   5. GAP — `billing_payments.refunded_amount` (integer column) is
 *      NOT updated by `payments.refund`. The refunded amount is stored
 *      only in `metadata.refundedAmount` (JSONB). The dedicated column
 *      stays 0. Reporting code that joins by the column will miss
 *      every refund issued through this path.
 *
 *   6. The admin guard requires `ACCESS_API_ADMIN`. `createMockAdminActor`
 *      does NOT include it by default; tests must override the
 *      `permissions` array explicitly (documented engram gotcha).
 *
 *   7. GAP — the qzpay-hono pre-built refund endpoint is effectively
 *      dead code for cross-customer admin refunds in production. The
 *      `billingOwnershipMiddleware` (apps/api/src/middlewares/billing-ownership.middleware.ts)
 *      fails closed when the actor has no `billingCustomerId` in
 *      context, and admin users do not have a billing customer
 *      associated with someone else's payment. The middleware has NO
 *      admin bypass. Result: an ADMIN trying to refund a customer's
 *      payment hits 403 even though `billing-admin-guard` already
 *      allowed them through. The only path that works today: the
 *      admin user MUST also be the customer of the targeted payment
 *      (self-refund). Tests below use that workaround to exercise the
 *      refund logic at all. A follow-up spec is needed to either add
 *      an admin bypass to billingOwnershipMiddleware or build a
 *      hospeda-side admin refund route that does not flow through the
 *      ownership middleware (the pattern used by subscription-cancel
 *      in SPEC-143 T-143-27).
 *
 * @module test/e2e/flows/billing/refund
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
                    'mp-stub adapter not initialized — refund.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingCustomerEntitlements, eq, sql } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-34 — admin refund', () => {
    let app: ReturnType<typeof initApp>;
    let adminClient: E2EApiClient;
    let _seed: TestBillingPlansSeed;
    let customerId: string;
    let subscriptionId: string;

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

        // The admin user IS ALSO the customer of the seeded payment. See
        // file-level note 7 — `billingOwnershipMiddleware` fails closed
        // for cross-customer admin refunds, so the only working path today
        // is admin self-refund. The user is set up with admin perms +
        // its own billing customer + a subscription so refund tests can
        // exercise the qzpay-hono pre-built endpoint at all.
        const adminUser = await createTestUser({
            email: `refund-admin-cust-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: adminUser.id,
            email: adminUser.email
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: _seed.cheap.planId,
            status: 'active'
        });
        subscriptionId = sub.subscriptionId;

        // createMockAdminActor() does NOT include ACCESS_API_ADMIN by default
        // (engram gotcha + see file-level note 6). The override REPLACES the
        // default permissions array, so we re-include only what the refund
        // path touches: API entry (PUBLIC + PRIVATE + ADMIN), and the
        // granular PAYMENT_REFUND permission for downstream service checks.
        const actor = createMockAdminActor({
            id: adminUser.id,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.PAYMENT_REFUND,
                PermissionEnum.PAYMENT_VIEW
            ]
        });
        adminClient = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Insert a `billing_payments` row in `succeeded` state, ready to be
     * refunded. The qzpay-drizzle bug captured in T-143-33 (provider hardcoded
     * to 'stripe', providerPaymentIds dropped) is sidestepped here because we
     * INSERT directly via raw SQL with the real provider + ids — tests for
     * the refund flow itself should not be coupled to that upstream bug.
     */
    async function seedSucceededPayment(input: {
        readonly amount: number;
        readonly providerPaymentId?: string;
    }): Promise<string> {
        const paymentId = randomUUID();
        const providerPaymentIds = {
            mercadopago: input.providerPaymentId ?? `pay_seed_${Date.now()}`
        };
        await testDb.getDb().execute(sql`
            INSERT INTO billing_payments (
                id, customer_id, subscription_id,
                amount, currency, status,
                provider, provider_payment_ids,
                metadata, livemode
            ) VALUES (
                ${paymentId}, ${customerId}, ${subscriptionId},
                ${input.amount}, 'ARS', 'succeeded',
                'mercadopago', ${JSON.stringify(providerPaymentIds)}::jsonb,
                ${'{"source":"test-seed"}'}::jsonb, false
            )
        `);
        return paymentId;
    }

    /**
     * Fetch a payment row by id with the fields these tests assert against.
     * Returns null when no row matches (used by the 404 sanity check).
     */
    async function fetchPayment(id: string): Promise<{
        status: string;
        amount: number;
        refunded_amount: number | null;
        metadata: Record<string, unknown> | null;
    } | null> {
        const rows = (
            await testDb.getDb().execute(sql`
                SELECT status, amount, refunded_amount, metadata
                FROM billing_payments
                WHERE id = ${id}
            `)
        ).rows as Array<{
            status: string;
            amount: number;
            refunded_amount: number | null;
            metadata: Record<string, unknown> | null;
        }>;
        return rows[0] ?? null;
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('full refund flips status to "refunded" and stores refundedAmount + refundReason in metadata', async () => {
        // ARRANGE — a succeeded payment of 10_000 centavos (100 ARS).
        const paymentId = await seedSucceededPayment({ amount: 10_000 });

        // ACT — admin refunds the full amount with a reason.
        const response = await adminClient.post(
            `/api/v1/protected/billing/payments/${paymentId}/refund`,
            { amount: 10_000, reason: 'requested-by-customer' }
        );

        // ASSERT — 200 success envelope with the updated payment.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: { readonly status: string; readonly id: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('refunded');
        expect(body.data.id).toBe(paymentId);

        // ASSERT — DB row reflects the full refund: status flipped,
        // metadata enriched with refundedAmount + refundReason. The
        // refundedAmount is stored as the same units as `amount`
        // (centavos in this codebase).
        const row = await fetchPayment(paymentId);
        expect(row?.status).toBe('refunded');
        expect(row?.amount).toBe(10_000);
        expect(row?.metadata).toMatchObject({
            refundedAmount: 10_000,
            refundReason: 'requested-by-customer'
        });
    });

    it('partial refund (amount < payment.amount) flips status to "partially_refunded" and tracks the partial amount in metadata', async () => {
        // ARRANGE — payment of 10_000 centavos.
        const paymentId = await seedSucceededPayment({ amount: 10_000 });

        // ACT — admin refunds half (5_000 centavos) without a reason. The
        // reason key MUST be absent from metadata when omitted in the body
        // (the helper only sets `refundReason` if `input.reason !== undefined`).
        const response = await adminClient.post(
            `/api/v1/protected/billing/payments/${paymentId}/refund`,
            { amount: 5_000 }
        );

        // ASSERT — 200 with status flipped to partially_refunded.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: { readonly status: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('partially_refunded');

        // ASSERT — DB row carries the partial state.
        const row = await fetchPayment(paymentId);
        expect(row?.status).toBe('partially_refunded');
        expect(row?.metadata).toMatchObject({ refundedAmount: 5_000 });
        // refundReason must NOT be present when the body omitted it (the
        // helper only sets the key when input.reason !== undefined).
        expect(row?.metadata).not.toHaveProperty('refundReason');
    });

    it('returns 403 (NOT 404) when the targeted payment id does not exist — billing-ownership middleware fails closed before reaching the refund logic', async () => {
        // ARRANGE — a freshly-minted UUID that we KNOW does not point at
        // any seeded row. Sanity-check the absence so a flake in the seed
        // path surfaces as a clear assertion rather than a misleading
        // status code.
        const ghostId = randomUUID();
        const sanity = await fetchPayment(ghostId);
        expect(sanity).toBeNull();

        // ACT
        const response = await adminClient.post(
            `/api/v1/protected/billing/payments/${ghostId}/refund`,
            { amount: 1_000 }
        );

        // ASSERT — 403, NOT 404. `billingOwnershipMiddleware`
        // (billing-ownership.middleware.ts) runs BEFORE the qzpay-hono
        // refund handler. It calls `getResourceCustomerId('payments', id)`
        // which returns null when the payment row does not exist, and
        // the middleware fails closed with 403 ("does not belong to
        // user"). The QZPayNotFoundError that qzpay-core would otherwise
        // throw is unreachable through this path. A future fix that adds
        // an admin bypass or moves the 404 ahead of the ownership check
        // would flip this assertion to `.toBe(404)`.
        expect(response.status).toBe(403);
    });

    it('PINS GAPS: refund does not call MP, does not end-date entitlements, does not change subscription, and does not write the refunded_amount column', async () => {
        // BUG/GAP REGISTRY ENTRY (file-level notes 2-5):
        //
        // This test pins the SHAPE OF THE GAPS so a future spec that
        // closes any of them surfaces here as an INVERTED assertion
        // failure. Each gap is captured separately so the failure
        // mode is unambiguous when one is fixed.

        // ARRANGE — payment + a pre-existing customer entitlement that a
        // "correct" refund flow should end-date. The entitlement seed
        // uses `source='subscription'` (not 'addon') so the addon
        // recalculation paths do not touch it.
        const paymentId = await seedSucceededPayment({ amount: 7_500 });

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

        // Sanity — the entitlement is there pre-refund.
        const preGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(eq(billingCustomerEntitlements.customerId, customerId));
        expect(preGrants).toHaveLength(1);

        // ACT — full refund.
        const response = await adminClient.post(
            `/api/v1/protected/billing/payments/${paymentId}/refund`,
            { amount: 7_500, reason: 'gap-pin' }
        );
        expect(response.status).toBe(200);

        // ASSERT (GAP 2) — no MP refund call landed. The mp-stub records
        // every adapter operation it intercepts; `payments.refund` should
        // have ZERO calls because qzpay-core's refund only updates local
        // DB. When the upstream fix integrates the MP refund API, flip to
        // `toHaveLength(1)` here.
        expect(mpStub.config.getCalls('payments.refund')).toHaveLength(0);

        // ASSERT (GAP 3) — entitlements are UNCHANGED. The refund left
        // the customer's grants intact, so the user keeps access. When
        // the fix end-dates entitlements via the payment.refunded event,
        // this assertion must flip to `toHaveLength(0)` (or assert an
        // `endDate` timestamp on the row).
        const postGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(eq(billingCustomerEntitlements.customerId, customerId));
        expect(postGrants).toHaveLength(1);

        // ASSERT (GAP 4) — the subscription's status is still 'active'.
        // A refunded recurring charge does not transition the sub to
        // past_due or cancelled. When the fix introduces a policy
        // (whatever it ends up being), update this assertion.
        const subRow = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_subscriptions WHERE id = ${subscriptionId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(subRow?.status).toBe('active');

        // ASSERT (GAP 5) — the dedicated `refunded_amount` integer column
        // is NOT updated by `payments.refund`. The amount lives only in
        // metadata.refundedAmount JSONB. When the fix writes the column,
        // flip to `expect(row?.refunded_amount).toBe(7_500)`.
        const row = await fetchPayment(paymentId);
        expect(row?.refunded_amount).toBe(0);
        expect(row?.metadata).toMatchObject({ refundedAmount: 7_500 });
    });
});
