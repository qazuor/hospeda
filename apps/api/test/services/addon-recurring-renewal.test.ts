/**
 * `settleRecurringAddonCharge` — what one MercadoPago charge against a
 * recurring add-on's preapproval actually does (HOS-847 PR 5).
 *
 * ## What is mocked, and what that means the assertions are worth
 *
 * `@repo/db` is replaced so the period UPDATE can be observed directly (the
 * `set({...})` payload IS the behaviour under test), and the ACTIVATION module
 * is replaced because its own contract is covered next door. The LEDGER is NOT
 * mocked: `recordAddonPayment` runs for real over the same fake db, because the
 * link between "the ledger inserted nothing" and "the period must not move" is
 * exactly the coupling a redelivery exercises, and a mocked ledger would let
 * that coupling be wrong while every test stayed green.
 *
 * Each test therefore asserts on `updateSet` — the argument the production code
 * hands Drizzle — rather than on a return value it could have computed without
 * touching the database.
 *
 * @module test/services/addon-recurring-renewal
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MPAuthorizedPaymentDetails } from '../../src/utils/mp-authorized-payment.js';

const {
    mockActivate,
    mockPaymentsRecord,
    mockDedupeRows,
    mockPurchaseRows,
    mockUpdateSet,
    mockRecordOrphanPayment
} = vi.hoisted(() => ({
    mockActivate: vi.fn(),
    mockPaymentsRecord: vi.fn(),
    /** Rows the `billing_payments` dedupe lookup answers with. */
    mockDedupeRows: { rows: [] as Array<{ id: string; status: string }> },
    /** Rows the `billing_addon_purchases` re-read answers with. */
    mockPurchaseRows: { rows: [] as Array<Record<string, unknown>> },
    /** Captures every `update(...).set(payload)` payload, in order. */
    mockUpdateSet: vi.fn(),
    mockRecordOrphanPayment: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: mockRecordOrphanPayment
}));

vi.mock('../../src/services/addon-recurring-activation.service', () => ({
    activateRecurringAddonPurchase: mockActivate
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
        currentPeriodEnd: 'current_period_end',
        currentPeriodStart: 'current_period_start',
        metadata: 'metadata',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    }
}));

vi.mock('@repo/db', () => {
    const builder = (rows: unknown[]) => {
        const chain = {
            from: vi.fn(() => chain),
            where: vi.fn(() => chain),
            limit: vi.fn(() => Promise.resolve(rows))
        };
        return chain;
    };
    return {
        getDb: vi.fn(() => ({
            select: vi.fn((projection?: Record<string, unknown>) =>
                projection !== undefined && 'addonSlug' in projection
                    ? builder(mockPurchaseRows.rows)
                    : builder(mockDedupeRows.rows)
            ),
            update: vi.fn(() => ({
                set: vi.fn((payload: Record<string, unknown>) => {
                    mockUpdateSet(payload);
                    return { where: vi.fn(() => Promise.resolve(undefined)) };
                })
            }))
        })),
        billingPayments: {
            id: 'id',
            status: 'status',
            updatedAt: 'updated_at',
            providerPaymentIds: 'provider_payment_ids'
        },
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
        isNull: vi.fn((a: unknown) => ({ isNull: a }))
    };
});

import { settleRecurringAddonCharge } from '../../src/services/addon-recurring-renewal.service.js';

const PREAPPROVAL_ID = 'preapproval-addon-1';

function makePurchase(overrides: Record<string, unknown> = {}) {
    return {
        id: 'purchase-1',
        customerId: 'cust-1',
        subscriptionId: 'plan-sub-1',
        addonSlug: 'extra-accommodations-5',
        status: 'active',
        mpSubscriptionId: PREAPPROVAL_ID,
        billingInterval: 'monthly',
        currentPeriodEnd: new Date('2026-06-10T12:00:00.000Z'),
        purchasedAt: new Date('2026-05-10T12:00:00.000Z'),
        metadata: {},
        ...overrides
    } as never;
}

function makeDetails(overrides: Partial<MPAuthorizedPaymentDetails> = {}) {
    return {
        authorizedPaymentId: 'auth-pay-1',
        preapprovalId: PREAPPROVAL_ID,
        transactionAmount: 5000,
        currencyId: 'ARS',
        paymentId: 'mp-pay-1',
        status: 'processed',
        paymentStatus: 'approved',
        debitDate: null,
        couponAmount: null,
        campaignId: null,
        ...overrides
    } as MPAuthorizedPaymentDetails;
}

const billing = { payments: { record: mockPaymentsRecord } } as never;

/** The period fields out of the captured `set()` payloads, if any. */
function capturedPeriodWrite(): Record<string, unknown> | undefined {
    return mockUpdateSet.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .find((payload) => 'currentPeriodEnd' in payload);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockDedupeRows.rows = [];
    mockPurchaseRows.rows = [];
    mockPaymentsRecord.mockResolvedValue({ id: 'billing-payment-1' });
    mockActivate.mockResolvedValue({ activated: false, reason: 'already-settled' });
});

describe('settleRecurringAddonCharge — the ledger', () => {
    it('books the charge as addon-recurring, attributed to the plan subscription', async () => {
        // Arrange
        const purchase = makePurchase();

        // Act
        await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert: the flow value is what separates a renewal from the one-time
        // purchase in `billing_payments`, and the amount crosses to centavos.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(mockPaymentsRecord.mock.calls[0]?.[0]).toMatchObject({
            customerId: 'cust-1',
            subscriptionId: 'plan-sub-1',
            amount: 500_000,
            currency: 'ARS',
            status: 'succeeded',
            providerPaymentId: 'mp-pay-1',
            metadata: {
                flow: 'addon-recurring',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-1'
            }
        });
    });

    it('attributes the charge to NOTHING rather than to the purchase id when there is no plan subscription', async () => {
        // Arrange: `billing_payments.subscription_id` is a nullable FK onto
        // `billing_subscriptions.id`. A `billing_addon_purchases` id is not in
        // that table, so passing it raises SQLSTATE 23503 on EVERY charge — and
        // this module swallows the failure into the orphan queue and reports
        // `inserted: false`, so the period would never advance and the caller
        // would never see an error.
        const purchase = makePurchase({ subscriptionId: null });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(mockPaymentsRecord.mock.calls[0]?.[0]?.subscriptionId).toBeUndefined();
        expect(outcome.ledgerInserted).toBe(true);
    });

    it('books the money even when the activation throws', async () => {
        // Arrange: `activateRecurringAddonPurchase` is NOT total — its catalog
        // and base-plan reads precede its own try block. With the ledger write
        // ordered after it, a throw here left MercadoPago's money with no
        // billing_payments row, no orphan-queue row (the queue lives inside
        // recordAddonPayment, which never ran) and a consumed webhook event.
        const purchase = makePurchase({ status: 'pending', currentPeriodEnd: null });
        mockActivate.mockRejectedValue(new Error('catalog service unavailable'));

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert: the charge is on the ledger, the caller is told nothing was
        // activated, and nothing threw out of this function.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(outcome.ledgerInserted).toBe(true);
        expect(outcome.activated).toBe(false);
        expect(mockRecordOrphanPayment).not.toHaveBeenCalled();
    });

    it('records a REJECTED charge with its real status and advances nothing', async () => {
        // Arrange: MercadoPago tried and failed. The ledger records what the
        // provider did, not what we hoped for.
        const purchase = makePurchase();

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails({ paymentStatus: 'rejected' }),
            status: 'failed',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(mockPaymentsRecord.mock.calls[0]?.[0]).toMatchObject({ status: 'failed' });
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });
});

describe('settleRecurringAddonCharge — idempotency under a MercadoPago redelivery', () => {
    it('a redelivered payment id neither books the charge again nor advances the period', async () => {
        // Arrange: the ledger already holds a row for this MercadoPago payment
        // id — the state a redelivery finds. The purchase is deliberately given
        // a period end already in the PAST, so the window check alone would say
        // "advance"; only the ledger's dedupe stops it. The stored row is
        // already `succeeded`, which is what a plain redelivery finds — an
        // in_process row completing into approved is a different case, covered
        // below.
        mockDedupeRows.rows = [{ id: 'billing-payment-1', status: 'succeeded' }];
        const purchase = makePurchase({
            currentPeriodEnd: new Date('2026-05-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(mockPaymentsRecord).not.toHaveBeenCalled();
        expect(outcome.ledgerInserted).toBe(false);
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });

    it('CONTROL: the same charge with an empty ledger DOES book and advance', async () => {
        // Arrange: identical to the test above except the dedupe lookup misses.
        // Without this control, the assertions above would pass just as happily
        // against a function that never advances anything at all.
        mockDedupeRows.rows = [];
        const purchase = makePurchase({
            currentPeriodEnd: new Date('2026-05-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(outcome.ledgerInserted).toBe(true);
        expect(outcome.periodAdvanced).toBe(true);
        expect(capturedPeriodWrite()).toMatchObject({
            currentPeriodStart: new Date('2026-05-10T12:00:00.000Z'),
            currentPeriodEnd: new Date('2026-06-10T12:00:00.000Z')
        });
    });

    it('a fresh charge INSIDE the paid window books the money but leaves the period alone', async () => {
        // Arrange: the initial charge, seconds after activation opened the
        // window. A different defence from the one above — this charge is new to
        // the ledger, so only the window check can stop it.
        const purchase = makePurchase({
            currentPeriodEnd: new Date('2026-07-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:04.000Z'),
            triggerSource: 'test'
        });

        // Assert: the money is on record, the customer got no second month.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(outcome.ledgerInserted).toBe(true);
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });
});

describe('settleRecurringAddonCharge — one payment id resolving in two deliveries', () => {
    it('advances the period when a stored in_process row is completed by the approved delivery', async () => {
        // Arrange: MercadoPago sent this charge first as `in_process` (issuer
        // review) and now as `approved`. It is ONE payment id, so the dedupe
        // finds the row the first delivery inserted. Gating on `inserted` alone
        // means the period NEVER advances for money that did arrive, and the
        // ledger row stays `processing` forever.
        mockDedupeRows.rows = [{ id: 'billing-payment-1', status: 'processing' }];
        const purchase = makePurchase({
            currentPeriodEnd: new Date('2026-05-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert: no second insert, the stored row is moved to its terminal
        // status, and the period advances off the back of it.
        expect(mockPaymentsRecord).not.toHaveBeenCalled();
        expect(outcome.ledgerInserted).toBe(false);
        expect(outcome.periodAdvanced).toBe(true);
        expect(
            mockUpdateSet.mock.calls
                .map((call) => call[0] as Record<string, unknown>)
                .some((payload) => payload.status === 'succeeded')
        ).toBe(true);
        expect(capturedPeriodWrite()).toMatchObject({
            currentPeriodStart: new Date('2026-05-10T12:00:00.000Z')
        });
    });

    it('leaves an ALREADY terminal row alone and advances nothing', async () => {
        // Arrange: the control. A plain redelivery of an approved charge finds a
        // row that is already `succeeded` — nothing to advance, nothing to
        // rewrite. Without this, the test above would pass against code that
        // advanced on every redelivery.
        mockDedupeRows.rows = [{ id: 'billing-payment-1', status: 'succeeded' }];
        const purchase = makePurchase({
            currentPeriodEnd: new Date('2026-05-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });
});

describe('settleRecurringAddonCharge — a purchase that is no longer live', () => {
    it.each([
        ['canceled'],
        ['expired']
    ])('records the money for a %s purchase but writes NO period', async (status) => {
        // Arrange: `supersedePendingPurchase` marks a superseded purchase
        // `canceled` after cancelling its preapproval; a late first charge
        // against that preapproval still arrives. A period written onto a
        // dead row looks exactly like a healthy subscription to PR 7's
        // reconciler — the one thing that would otherwise catch it.
        const purchase = makePurchase({
            status,
            currentPeriodEnd: new Date('2026-05-10T12:00:00.000Z')
        });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert: the money exists and a refund needs its ledger row, so it
        // is recorded; nothing else happens.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(outcome.ledgerInserted).toBe(true);
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });
});

describe('settleRecurringAddonCharge — a settled charge can activate', () => {
    it('activates a still-pending purchase and re-reads it before touching the period', async () => {
        // Arrange: the `preapproval.updated` webhook never arrived (HOS-159), so
        // this charge is the first evidence the customer paid. Activation writes
        // the period; the in-memory row still says null.
        const purchase = makePurchase({ status: 'pending', currentPeriodEnd: null });
        mockActivate.mockResolvedValue({ activated: true });
        mockPurchaseRows.rows = [
            {
                id: 'purchase-1',
                customerId: 'cust-1',
                subscriptionId: 'plan-sub-1',
                addonSlug: 'extra-accommodations-5',
                status: 'active',
                mpSubscriptionId: PREAPPROVAL_ID,
                billingInterval: 'monthly',
                currentPeriodEnd: new Date('2026-07-10T12:00:00.000Z'),
                metadata: {}
            }
        ];

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:04.000Z'),
            triggerSource: 'test'
        });

        // Assert: the activation ran, and the freshly-read period (not the stale
        // null the caller handed in) is what the window check saw — a stale null
        // would have opened a SECOND period for this same charge.
        expect(mockActivate).toHaveBeenCalledTimes(1);
        expect(outcome.activated).toBe(true);
        expect(outcome.periodAdvanced).toBe(false);
        expect(capturedPeriodWrite()).toBeUndefined();
    });

    it('does NOT activate on a charge that did not succeed', async () => {
        // Arrange
        const purchase = makePurchase({ status: 'pending', currentPeriodEnd: null });

        // Act
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails({ paymentStatus: 'rejected' }),
            status: 'failed',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert: a rejected charge grants nothing. This is the entitlement half
        // of "an error here charges for real or gives it away free".
        expect(mockActivate).not.toHaveBeenCalled();
        expect(outcome.activated).toBe(false);
    });

    it('does NOT activate a purchase that is already active', async () => {
        // Arrange: the ordinary monthly renewal.
        const purchase = makePurchase();

        // Act
        await settleRecurringAddonCharge({
            billing,
            purchase,
            details: makeDetails(),
            status: 'succeeded',
            settledAt: new Date('2026-06-10T12:00:00.000Z'),
            triggerSource: 'test'
        });

        // Assert
        expect(mockActivate).not.toHaveBeenCalled();
    });
});
