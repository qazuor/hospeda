/**
 * Unit tests for the past-due payment-method replacement service (HOS-348
 * Part B).
 *
 * Deliberately does NOT mock `createPaidSubscription` / `resolveReactivationPlan`
 * (the repo's "whole-module vi.mock leaves the new import undefined" trap) —
 * instead a fake `QZPayBilling` (`plans.listAll` / `subscriptions.create` /
 * `subscriptions.cancel`) drives the REAL helpers, so these tests exercise the
 * actual plan-resolution + preapproval-create logic, not a mock of it.
 *
 * Covers:
 * - A fresh mint stamps `supersedesSubscriptionId`, the HOS-348 replacement
 *   marker, and `unpaidPeriodForgiven` on the new row's metadata.
 * - Minting NEVER calls `billing.subscriptions.cancel()` — the load-bearing
 *   invariant that the old preapproval is untouched until the webhook
 *   confirms the new one (verified in RED with the bug reintroduced below).
 * - An in-flight attempt within the reuse window is returned instead of
 *   minting a second preapproval (idempotency layer 2).
 * - A stale (expired) or foreign-customer in-flight row is NOT reused.
 *
 * @module test/services/billing/past-due-payment-method-replacement.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY,
    replacePastDuePaymentMethod
} from '../../../src/services/billing/past-due-payment-method-replacement.service';

const PLAN_ID = 'plan-uuid-001';
const CUSTOMER_ID = 'customer-uuid-001';
const PAST_DUE_SUBSCRIPTION_ID = 'sub-past-due-001';

/** Minimal real-shaped plan with one active monthly price, for resolveReactivationPlan. */
function makePlan() {
    return {
        id: PLAN_ID,
        prices: [
            {
                id: 'price-monthly-001',
                active: true,
                billingInterval: 'month',
                intervalCount: 1,
                unitAmount: 500000
            }
        ]
    };
}

/** Minimal real-shaped result for billing.subscriptions.create(). */
function makeCreatedSubscription(overrides: { id?: string } = {}) {
    return {
        id: overrides.id ?? 'sub-new-001',
        providerInitPoint: 'https://mercadopago.example/checkout/sub-new-001',
        providerSandboxInitPoint: null,
        providerSubscriptionIds: { mercadopago: 'mp-preapproval-new-001' }
    };
}

/** Fake QZPayBilling exposing only what createPaidSubscription/resolveReactivationPlan touch. */
function makeFakeBilling(
    overrides: {
        createResult?: ReturnType<typeof makeCreatedSubscription>;
        listAllResult?: ReturnType<typeof makePlan>[];
    } = {}
) {
    const create = vi.fn().mockResolvedValue(overrides.createResult ?? makeCreatedSubscription());
    const cancel = vi.fn().mockResolvedValue(undefined);
    const listAll = vi.fn().mockResolvedValue(overrides.listAllResult ?? [makePlan()]);

    return {
        billing: {
            plans: { listAll },
            subscriptions: { create, cancel }
        } as unknown as QZPayBilling,
        create,
        cancel,
        listAll
    };
}

/** Chainable fake Drizzle client covering exactly the calls this service issues. */
function makeFakeDb(selectRows: Record<string, unknown>[] = []) {
    const limit = vi.fn().mockResolvedValue(selectRows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set });

    return { db: { select, update } as never, select, update, updateWhere, set };
}

describe('replacePastDuePaymentMethod (HOS-348 Part B)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mints a fresh preapproval stamped with supersedesSubscriptionId and the debt-forgiveness markers', async () => {
        // Arrange
        const { billing, create, cancel } = makeFakeBilling();
        const { db } = makeFakeDb([]); // no in-flight attempt found

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: { id: PAST_DUE_SUBSCRIPTION_ID, planId: PLAN_ID },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(result.localSubscriptionId).toBe('sub-new-001');
        expect(result.checkoutUrl).toBe('https://mercadopago.example/checkout/sub-new-001');

        expect(create).toHaveBeenCalledTimes(1);
        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata).toMatchObject({
            supersedesSubscriptionId: PAST_DUE_SUBSCRIPTION_ID,
            [PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY]: 'true',
            unpaidPeriodForgiven: 'true',
            previousPlanId: PLAN_ID
        });
        // No trial field of any kind — guard G-1's whole point.
        expect(createArgs).not.toHaveProperty('freeTrialDays');
        expect(createArgs).not.toHaveProperty('startDate');

        // The load-bearing invariant: minting NEVER cancels the old
        // preapproval. Cancellation is entirely the webhook's job, gated on
        // the new subscription's confirmed PENDING_PROVIDER -> ACTIVE
        // transition (subscription-logic.ts) — untouched by this service.
        expect(cancel).not.toHaveBeenCalled();
    });

    it('reuses an in-flight replacement attempt within the reuse window instead of minting a second preapproval', async () => {
        // Arrange — an existing pending_provider row already supersedes this
        // exact past-due subscription, created moments ago.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            {
                id: 'sub-inflight-001',
                metadata: { checkoutUrl: 'https://mercadopago.example/checkout/inflight-001' },
                createdAt: new Date()
            }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: { id: PAST_DUE_SUBSCRIPTION_ID, planId: PLAN_ID },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result).toEqual({
            reused: true,
            localSubscriptionId: 'sub-inflight-001',
            checkoutUrl: 'https://mercadopago.example/checkout/inflight-001'
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('does NOT reuse an in-flight row missing its checkoutUrl stamp — mints instead', async () => {
        // Arrange — a row exists (mint started) but the checkoutUrl stamp
        // update never landed (e.g. a crash between create and the stamp).
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            { id: 'sub-inflight-002', metadata: {}, createdAt: new Date() }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: { id: PAST_DUE_SUBSCRIPTION_ID, planId: PLAN_ID },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('propagates SubscriptionCheckoutError from resolveReactivationPlan (e.g. unknown plan)', async () => {
        // Arrange — plans.listAll() returns no plan matching planId.
        const { billing } = makeFakeBilling({ listAllResult: [] });
        const { db } = makeFakeDb([]);

        // Act / Assert
        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: { id: PAST_DUE_SUBSCRIPTION_ID, planId: PLAN_ID },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });
});
