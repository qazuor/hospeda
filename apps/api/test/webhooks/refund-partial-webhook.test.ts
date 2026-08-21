/**
 * HOS-704 regression: a PARTIAL refund notified by webhook must not be applied
 * as a FULL refund.
 *
 * ## What this file pins
 *
 * The webhook entry point (`handlePaymentUpdated`) builds the `data` payload
 * that `processPaymentUpdated` consumes, and `applyWebhookRefundLifecycle`
 * (inside `payment-logic.ts`) turns `data.transaction_amount_refunded` into the
 * `refundAmount` handed to `applyRefundLifecycle`.
 *
 * `applyRefundLifecycle`'s own contract (see `refund-lifecycle.service.ts`,
 * `isFullRefund`) is explicit: `refundAmount === undefined` means FULL refund —
 * it sets `refunded_amount = payment.amount`, cancels the linked subscription
 * and revokes entitlements. So "the refunded amount never reaches the service"
 * and "every refund is treated as total" are the same statement.
 *
 * This suite therefore drives the REAL chain
 *   `handlePaymentUpdated` → `processPaymentUpdated` → `applyWebhookRefundLifecycle`
 * with only the leaf (`applyRefundLifecycle`) and the DB mocked, and asserts on
 * the argument that decides partial-vs-full. It is deliberately written against
 * the OUTCOME, not against any particular plumbing: it does not care whether the
 * refunded amount reaches `data` from the payment adapter, from a raw MercadoPago
 * lookup, or from anywhere else — only that a 30% refund arrives as a partial
 * amount and never as an implicit full one.
 *
 * ## Where the amount comes from
 *
 * MercadoPago has always returned the figure as `transaction_amount_refunded`
 * on the `payments.retrieve` response the handler already fetches — qzpay's
 * `mapToProviderPayment` simply dropped it. `QZPayProviderPayment.refundedAmount`
 * (qzpay-mercadopago) now carries it through, which is the seam the stub below
 * drives.
 *
 * ## Units (money is centavos everywhere in this repo)
 *
 *   MercadoPago REST           : major units — 1000.00 ARS charged, 300.00 refunded
 *   qzpay adapter (`amount`,
 *   `refundedAmount`)          : centavos    — 100000 and 30000
 *   `data.transaction_amount_refunded`: MAJOR units, per the contract documented
 *       in `payment-logic.ts` ("MP payload: `transaction_amount_refunded` in major
 *       units (e.g. 150.00 ARS) → `Math.round(150.00 * 100)` = 15000 centavos")
 *       and mirrored by `subscription-poll.job.ts` (`succeeded.amount / 100`).
 *   `refundAmount` handed to `applyRefundLifecycle`: centavos — 30000
 *
 * @module test/webhooks/refund-partial-webhook
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Scenario constants (single source of truth for the numbers below).
// ---------------------------------------------------------------------------

/** MP payment id echoed by the IPN body and by the retrieved payment. */
const MP_PAYMENT_ID = '111222333';
/** Original charge, in centavos — what `billing_payments.amount` holds. */
const PAYMENT_AMOUNT_CENTAVOS = 100_000;
/** Refunded slice, in centavos — 30% of the charge. */
const PARTIAL_REFUND_CENTAVOS = 30_000;

// ---------------------------------------------------------------------------
// Module mocks (must be declared before the imports of the code under test).
// ---------------------------------------------------------------------------

const mockGetWebhookDependencies = vi.hoisted(() => vi.fn());
const mockMarkEventProcessedByProviderId = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMarkEventFailedByProviderId = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

/**
 * Local `billing_payments` row returned by the first `select()` inside the
 * refund lifecycle's `getDb()` scope. A non-null `subscriptionId` keeps the
 * addon-purchase guard out of the way.
 */
const dbState = vi.hoisted(() => ({
    paymentRows: [] as Array<{
        id: string;
        customerId: string;
        subscriptionId: string | null;
        amount: number;
    }>,
    addonRows: [] as Array<{ id: string }>
}));

// Partial mock: every pure extractor (`extractPaymentInfo`, …) stays REAL so the
// payload the handler actually builds is the payload under test. Only the two
// side-effecting helpers are stubbed.
vi.mock('../../src/routes/webhooks/mercadopago/utils', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/routes/webhooks/mercadopago/utils')>();
    return {
        ...actual,
        getWebhookDependencies: mockGetWebhookDependencies,
        markEventProcessedByProviderId: mockMarkEventProcessedByProviderId,
        markEventFailedByProviderId: mockMarkEventFailedByProviderId
    };
});

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailureNotifications: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@repo/db', () => {
    let selectCount = 0;
    function makeSelectChain<T>(rows: T[]) {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => rows
        };
        return chain;
    }
    return {
        AccommodationModel: vi.fn(function () {
            return { findIdsByOwnerId: vi.fn(async () => []) };
        }),
        entityViewModel: {
            insertView: vi.fn(),
            getStatsForEntities: vi.fn(async () => []),
            purgeOlderThan: vi.fn(async () => 0)
        },
        getDb: vi.fn(() => {
            selectCount = 0;
            return {
                select: vi.fn(() => {
                    const i = selectCount;
                    selectCount += 1;
                    return makeSelectChain(i === 0 ? dbState.paymentRows : dbState.addonRows);
                }),
                update: vi.fn(() => ({
                    set: () => ({ where: async () => undefined })
                }))
            };
        }),
        billingWebhookEvents: {
            id: 'ID',
            providerEventId: 'PROVIDER_EVENT_ID',
            status: 'STATUS',
            provider: 'PROVIDER',
            type: 'TYPE',
            payload: 'PAYLOAD',
            error: 'ERROR',
            processedAt: 'PROCESSED_AT',
            createdAt: 'CREATED_AT'
        },
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            status: 'STATUS',
            deletedAt: 'DELETED_AT'
        },
        billingPayments: {
            id: 'PAYMENT_ID',
            customerId: 'CUSTOMER_ID',
            subscriptionId: 'SUBSCRIPTION_ID',
            amount: 'AMOUNT',
            providerPaymentIds: 'PROVIDER_PAYMENT_IDS'
        },
        billingAddonPurchases: {
            id: 'ADDON_PURCHASE_ID',
            paymentId: 'PAYMENT_ID_COL'
        },
        and: (...args: unknown[]) => ({ _and: args }),
        or: (...args: unknown[]) => ({ _or: args }),
        eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
        isNull: (a: unknown) => ({ _isNull: a }),
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })
    };
});

vi.mock('../../src/services/refund-lifecycle.service', () => ({
    applyRefundLifecycle: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/addon.service', () => ({
    AddonService: vi.fn().mockImplementation(function () {
        return { confirmPurchase: vi.fn().mockResolvedValue({ success: true, data: undefined }) };
    })
}));

vi.mock('../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/plan-upgrade-restoration.service', () => ({
    applyUpgradeRestorationsOrWarn: vi.fn().mockResolvedValue({
        restored: { accommodations: [], promotions: [], photosByAccommodation: {} },
        stillRestricted: { accommodations: [], promotions: [] }
    })
}));

vi.mock('../../src/services/subscription-pause.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, resolveOwnerUserId: vi.fn().mockResolvedValue('usr-1') };
});

vi.mock('../../src/services/billing/reactivation-supersession-complete', () => ({
    completeSupersessionPairing: vi.fn().mockResolvedValue('completed')
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: vi.fn().mockReturnValue({}),
    getAddonBySlug: vi.fn().mockReturnValue(undefined)
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        resolveOwnerPlanGrantsFeatured: vi.fn().mockResolvedValue(false),
        syncFeaturedByEntitlementForOwner: vi.fn().mockResolvedValue(undefined),
        getPromoCodeById: vi.fn(),
        resolveFullPlanPriceCentavos: vi.fn()
    };
});

const { mockPostHogCapture, mockGetPostHogClient } = vi.hoisted(() => ({
    mockPostHogCapture: vi.fn(),
    mockGetPostHogClient: vi.fn(() => ({ capture: mockPostHogCapture }))
}));

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: mockGetPostHogClient,
    captureServerAnalyticsEvent: vi.fn(),
    isPostHogEnabled: () => false,
    shutdownPostHog: vi.fn(),
    _resetPostHogClientForTests: vi.fn()
}));

vi.mock('../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn(),
    captureBillingError: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { handlePaymentUpdated } from '../../src/routes/webhooks/mercadopago/payment-handler';
import { applyRefundLifecycle } from '../../src/services/refund-lifecycle.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** MercadoPago IPN body for `payment.updated` — carries only `data.id`. */
function makeRefundEvent(): QZPayWebhookEvent {
    return {
        id: 'mp-event-refund-1',
        type: 'payment.updated',
        data: { id: MP_PAYMENT_ID },
        created: new Date('2026-08-20T10:00:00.000Z')
    };
}

function makeMockContext() {
    const store: Record<string, unknown> = { requestId: 'req-refund-1' };
    return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        })
    };
}

/**
 * Webhook dependencies whose payment adapter reports a partially refunded
 * payment.
 *
 * `refundedAmount` is the field described in the file header — the refunded
 * slice in centavos, alongside the `amount` the adapter already returns in
 * centavos.
 */
function makeDependenciesWithPartialRefund(): unknown {
    return {
        billing: {
            customers: {
                get: vi.fn().mockResolvedValue({
                    id: 'cust-1',
                    email: 'user@test.com',
                    metadata: { name: 'Test User', userId: 'usr-1' }
                })
            },
            subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            plans: { get: vi.fn(), list: vi.fn() },
            payments: { record: vi.fn() }
        },
        paymentAdapter: {
            payments: {
                retrieve: vi.fn().mockResolvedValue({
                    id: MP_PAYMENT_ID,
                    status: 'refunded',
                    amount: PAYMENT_AMOUNT_CENTAVOS,
                    refundedAmount: PARTIAL_REFUND_CENTAVOS,
                    currency: 'ARS',
                    metadata: { customerId: 'cust-1' }
                })
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HOS-704 — partial refund via payment.updated webhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMarkEventProcessedByProviderId.mockResolvedValue(undefined);
        mockMarkEventFailedByProviderId.mockResolvedValue(undefined);
        mockGetWebhookDependencies.mockReturnValue(makeDependenciesWithPartialRefund());
        dbState.paymentRows = [
            {
                id: 'pay-local-1',
                customerId: 'cust-1',
                subscriptionId: 'sub-1',
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        dbState.addonRows = [];
    });

    it('hands the refund lifecycle the PARTIAL amount, not an implicit full refund', async () => {
        await handlePaymentUpdated(makeMockContext() as never, makeRefundEvent());

        expect(applyRefundLifecycle).toHaveBeenCalledTimes(1);

        const call = vi.mocked(applyRefundLifecycle).mock.calls[0]?.[0];
        expect(call).toBeDefined();

        // `undefined` is exactly what `isFullRefund` reads as "full refund" —
        // the branch that sets refunded_amount = payment.amount, cancels the
        // subscription and revokes entitlements.
        expect(call?.refundAmount).not.toBeUndefined();
        expect(call?.refundAmount).toBe(PARTIAL_REFUND_CENTAVOS);
    });

    it('keeps the refunded amount strictly below the charge so no cancellation is triggered', async () => {
        await handlePaymentUpdated(makeMockContext() as never, makeRefundEvent());

        const call = vi.mocked(applyRefundLifecycle).mock.calls[0]?.[0];
        expect(call).toBeDefined();

        const refundAmount = call?.refundAmount;
        expect(typeof refundAmount).toBe('number');
        // Mirrors `isFullRefund`: a refund is full when the amount is undefined
        // or >= payment.amount. Neither may hold for a 30% refund.
        expect(refundAmount as number).toBeLessThan(PAYMENT_AMOUNT_CENTAVOS);
    });

    it('acknowledges the event (no dead-letter retry) while applying the partial refund', async () => {
        await handlePaymentUpdated(makeMockContext() as never, makeRefundEvent());

        expect(mockMarkEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-refund-1'
        });
        expect(mockMarkEventFailedByProviderId).not.toHaveBeenCalled();
    });
});
