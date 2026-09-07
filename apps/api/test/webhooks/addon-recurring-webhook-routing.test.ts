/**
 * HOS-847 PR 5 — an add-on's own preapproval charge never reaches the
 * plan-subscription handler.
 *
 * ## Why this drives the REAL handler
 *
 * The defect this PR prevents is not visible from either half on its own. PR 4
 * gives a recurring add-on its own MercadoPago preapproval AND its own
 * `billing_subscriptions` row, and `findLocalSubscriptionByPreapprovalId`
 * filters by nothing but `mp_subscription_id`. So the add-on's row resolves
 * perfectly, and `handleSubscriptionAuthorizedPayment` then does a full plan
 * renewal on it: a `billing_payments` row attributed to the customer's plan, a
 * plan-price divergence check, a promo-cycle decrement, and a card-first trial
 * conversion.
 *
 * A test of the add-on service alone cannot see that, and a test of the plan
 * handler alone has no add-on to route. So this file calls
 * `handleSubscriptionAuthorizedPayment` itself, with a database in which BOTH
 * lookups would succeed, and asserts which one won.
 *
 * The control test at the end is what makes that assertion worth anything: with
 * the add-on lookup missing, the very same fixture DOES run the whole plan path.
 * Without it, every assertion here would pass just as happily against a handler
 * that had stopped doing anything at all.
 *
 * @module test/webhooks/addon-recurring-webhook-routing
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Row fixtures the mocked `getDb()` answers with, driven per test.
// ---------------------------------------------------------------------------

const PREAPPROVAL_ID = 'preapproval-shared-1';

/** `billing_addon_purchases` rows for the HOS-847 routing lookup. */
const addonPurchaseRows: { rows: Array<Record<string, unknown>> } = { rows: [] };
/** `billing_subscriptions` rows for the PLAN lookup. */
const planSubRows: { rows: Array<Record<string, unknown>> } = { rows: [] };
/** `billing_payments` dedupe rows. */
const dedupeRows: { rows: Array<{ id: string }> } = { rows: [] };

const { mockTx, mockUpdateSet } = vi.hoisted(() => ({
    mockTx: {
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        insert: vi.fn(() => ({ values: vi.fn() }))
    },
    mockUpdateSet: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    markEventProcessedByProviderId: vi.fn(),
    markEventFailedByProviderId: vi.fn(),
    getWebhookDependencies: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

vi.mock('../../src/services/billing/link-preapproval.service', () => ({
    linkPreapprovalToLocalSub: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));

vi.mock('../../src/middlewares/billing', () => ({ getQZPayBilling: vi.fn() }));

vi.mock('../../src/utils/mp-authorized-payment', () => ({
    fetchAuthorizedPaymentDetails: vi.fn()
}));

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

vi.mock('../../src/services/promo-renewal-mp.service', () => ({
    restoreFullPriceMutation: vi.fn()
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    resolveRenewalPromoEffect: vi.fn(async () => ({
        success: true,
        data: { action: 'noop', remainingCyclesAfter: null }
    })),
    BILLING_EVENT_TYPES: { TRIAL_RECONCILED: 'TRIAL_RECONCILED' },
    checkSubscriptionStatusTransition: vi.fn(() => ({ valid: true })),
    detectExternalChargeInterference: vi.fn(() => null),
    resolveFullPlanPriceCentavos: vi.fn(async () => null),
    detectPlanPriceDivergence: vi.fn(() => null),
    resolveDiscountAwareExpectedCentavos: vi.fn(async () => ({ indeterminate: true })),
    resolveIntervalScopedPlanPriceCentavos: vi.fn(async () => null),
    withServiceTransaction: vi.fn(async (cb: (ctx: { tx: unknown }) => Promise<unknown>) =>
        cb({ tx: mockTx })
    )
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        mpSubscriptionId: 'mp_subscription_id',
        billingInterval: 'billing_interval',
        currentPeriodStart: 'current_period_start',
        currentPeriodEnd: 'current_period_end',
        metadata: 'metadata',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    }
}));

vi.mock('@repo/db', () => {
    const chainOver = (rows: unknown[]) => {
        const chain = {
            from: vi.fn(() => chain),
            where: vi.fn(() => chain),
            limit: vi.fn(() => Promise.resolve(rows))
        };
        return chain;
    };
    return {
        getDb: vi.fn(() => ({
            // Dispatch by PROJECTION, never by call order: the whole subject of
            // this file is which lookup runs first, so an order-indexed mock
            // would encode the answer into the fixture.
            select: vi.fn((projection?: Record<string, unknown>) => {
                if (projection !== undefined && 'addonSlug' in projection) {
                    return chainOver(addonPurchaseRows.rows);
                }
                if (projection !== undefined && 'trialEnd' in projection) {
                    return chainOver(planSubRows.rows);
                }
                return chainOver(dedupeRows.rows);
            }),
            update: vi.fn(() => ({
                set: vi.fn((payload: Record<string, unknown>) => {
                    mockUpdateSet(payload);
                    return { where: vi.fn(() => Promise.resolve(undefined)) };
                })
            }))
        })),
        billingPayments: { id: 'id', providerPaymentIds: 'provider_payment_ids', deletedAt: 'd' },
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            planId: 'plan_id',
            status: 'status',
            trialEnd: 'trial_end',
            billingInterval: 'billing_interval',
            mpSubscriptionId: 'mp_subscription_id',
            deletedAt: 'deleted_at'
        },
        billingSubscriptionEvents: { id: 'id' },
        billingPlanPriceChanges: { id: 'id', planId: 'p', billingInterval: 'b', status: 's' },
        billingPlanPriceChangeTargets: { id: 'id', subscriptionId: 's', status: 'st' },
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
        inArray: vi.fn((a: unknown, b: unknown) => ({ inArray: [a, b] })),
        isNull: vi.fn((a: unknown) => ({ isNull: a })),
        sql: Object.assign(
            (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
            {}
        )
    };
});

import { resolveRenewalPromoEffect, withServiceTransaction } from '@repo/service-core';
import { handleSubscriptionAuthorizedPayment } from '../../src/routes/webhooks/mercadopago/subscription-payment-handler';
import {
    getWebhookDependencies,
    markEventProcessedByProviderId
} from '../../src/routes/webhooks/mercadopago/utils';
import { linkPreapprovalToLocalSub } from '../../src/services/billing/link-preapproval.service';
import { fetchAuthorizedPaymentDetails } from '../../src/utils/mp-authorized-payment';

const mockPaymentsRecord = vi.fn();

function makeEvent(): QZPayWebhookEvent {
    return {
        id: 'mp-event-1',
        type: 'invoice.paid',
        data: { id: 'auth-pay-1' }
    } as unknown as QZPayWebhookEvent;
}

function makeContext() {
    return { get: vi.fn(() => 'req-1') };
}

function fetchOk() {
    return {
        kind: 'ok' as const,
        details: {
            authorizedPaymentId: 'auth-pay-1',
            preapprovalId: PREAPPROVAL_ID,
            transactionAmount: 5000,
            currencyId: 'ARS',
            paymentId: 'mp-pay-1',
            status: 'processed',
            paymentStatus: 'approved',
            debitDate: null,
            couponAmount: null,
            campaignId: null
        }
    };
}

/**
 * The `billing_subscriptions` row BOTH paths would resolve from the shared
 * preapproval id. `trialing` on purpose: it makes the plan path's trial
 * conversion reachable, so "the conversion did not run" is a real observation
 * rather than a vacuous one.
 */
function planSubscriptionRow() {
    return {
        id: 'addon-own-sub-1',
        customerId: 'cust-1',
        planId: 'plan-1',
        status: 'trialing',
        trialEnd: new Date(Date.now() + 86_400_000),
        billingInterval: 'month'
    };
}

function addonPurchaseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'purchase-1',
        customerId: 'cust-1',
        subscriptionId: 'plan-sub-1',
        addonSlug: 'extra-accommodations-5',
        status: 'active',
        mpSubscriptionId: PREAPPROVAL_ID,
        billingInterval: 'monthly',
        currentPeriodEnd: new Date('2026-06-10T12:00:00.000Z'),
        metadata: {},
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    addonPurchaseRows.rows = [];
    planSubRows.rows = [planSubscriptionRow()];
    dedupeRows.rows = [];
    mockPaymentsRecord.mockResolvedValue({ id: 'billing-payment-1' });
    vi.mocked(getWebhookDependencies).mockReturnValue({
        billing: { payments: { record: mockPaymentsRecord } },
        paymentAdapter: {}
    } as never);
    vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk() as never);
    vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({ outcome: 'not_found' } as never);
});

describe('an add-on preapproval charge is intercepted before the plan handler', () => {
    beforeEach(() => {
        // Both lookups resolve. That is the real production shape and the whole
        // hazard: PR 4 writes a `billing_subscriptions` row for the add-on's own
        // preapproval, and the plan lookup has no product-domain filter.
        addonPurchaseRows.rows = [addonPurchaseRow()];
    });

    it('books the charge as an ADD-ON renewal, not as a plan renewal', async () => {
        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        const recorded = mockPaymentsRecord.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(recorded.metadata).toMatchObject({
            flow: 'addon-recurring',
            addonSlug: 'extra-accommodations-5',
            purchaseId: 'purchase-1'
        });
        // Attributed to the customer's PLAN subscription (what the purchase row's
        // `subscription_id` holds), never to the add-on's own preapproval row.
        expect(recorded.subscriptionId).toBe('plan-sub-1');
        // And NOT the plan handler's own metadata shape.
        expect(recorded.metadata).not.toHaveProperty('mpAuthorizedPaymentId');
    });

    it('runs none of the plan-renewal machinery', async () => {
        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert: the three things the plan handler would have done to this
        // customer's real subscription on the strength of one add-on's charge.
        expect(resolveRenewalPromoEffect).not.toHaveBeenCalled();
        expect(withServiceTransaction).not.toHaveBeenCalled();
        expect(linkPreapprovalToLocalSub).not.toHaveBeenCalled();
    });

    it('still acknowledges the event', async () => {
        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith(
            expect.objectContaining({ providerEventId: 'mp-event-1' })
        );
    });

    it('advances the add-on period when the charge lands at the end of the paid window', async () => {
        // Arrange: a real renewal — the window closed, MercadoPago charged.
        addonPurchaseRows.rows = [
            addonPurchaseRow({ currentPeriodEnd: new Date(Date.now() - 60_000) })
        ];

        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert
        const periodWrite = mockUpdateSet.mock.calls
            .map((call) => call[0] as Record<string, unknown>)
            .find((payload) => 'currentPeriodEnd' in payload);
        expect(periodWrite).toBeDefined();
    });

    it('a redelivery of the same MercadoPago payment books nothing and moves no period', async () => {
        // Arrange: the ledger already holds this payment id, and the period is
        // past — so only the dedupe can stop a second advance.
        dedupeRows.rows = [{ id: 'billing-payment-1' }];
        addonPurchaseRows.rows = [
            addonPurchaseRow({ currentPeriodEnd: new Date(Date.now() - 60_000) })
        ];

        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert
        expect(mockPaymentsRecord).not.toHaveBeenCalled();
        expect(
            mockUpdateSet.mock.calls
                .map((call) => call[0] as Record<string, unknown>)
                .find((payload) => 'currentPeriodEnd' in payload)
        ).toBeUndefined();
        // Still acked — a redelivery is not a failure.
        expect(markEventProcessedByProviderId).toHaveBeenCalled();
    });
});

describe('CONTROL: the identical fixture without an add-on row runs the full plan path', () => {
    it('records a PLAN renewal, converts the trial and resolves the promo effect', async () => {
        // Arrange: same subscription row, same charge, same everything — the
        // ONLY difference is that no `billing_addon_purchases` row claims this
        // preapproval.
        addonPurchaseRows.rows = [];

        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert: this is what the add-on tests above are asserting the ABSENCE
        // of. If this test ever goes quiet, those assertions have stopped
        // proving anything.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(mockPaymentsRecord.mock.calls[0]?.[0]).toMatchObject({
            subscriptionId: 'addon-own-sub-1',
            metadata: { mpAuthorizedPaymentId: 'auth-pay-1' }
        });
        expect(withServiceTransaction).toHaveBeenCalled();
        expect(resolveRenewalPromoEffect).toHaveBeenCalled();
    });

    it('does not claim a purchase row whose mp_subscription_id is a DIFFERENT preapproval', async () => {
        // Arrange: a row came back from the lookup, but it does not describe
        // this preapproval. The routing must refuse it rather than swallow a
        // real plan renewal on the strength of a row it did not verify.
        addonPurchaseRows.rows = [addonPurchaseRow({ mpSubscriptionId: 'some-other-preapproval' })];

        // Act
        await handleSubscriptionAuthorizedPayment(makeContext() as never, makeEvent());

        // Assert: the plan path ran.
        expect(mockPaymentsRecord.mock.calls[0]?.[0]).toMatchObject({
            metadata: { mpAuthorizedPaymentId: 'auth-pay-1' }
        });
    });
});
