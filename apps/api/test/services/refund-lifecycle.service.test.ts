/**
 * Tests for the Refund Lifecycle Service (SPEC-194 T-006/T-007/T-019)
 *
 * `applyRefundLifecycle` applies the correct side effects when a payment is
 * refunded:
 *
 * - Full refund  → persist refunded_amount on billing_payments, transition
 *                  subscription to `cancelled`, insert audit event, clear cache.
 * - Partial refund → accumulate refunded_amount on billing_payments, insert
 *                    `payment.partial_refund` audit event; subscription unchanged,
 *                    no cache clear. When accumulated total reaches payment.amount,
 *                    the full cancel path is taken instead.
 * - No subscription linked → no-op (logs info, no DB writes).
 * - Invalid transition (e.g. sub already cancelled) → skip status write, still
 *   clear cache (idempotent).
 * - DB errors → logged; cache cleared defensively; function does not throw.
 *
 * @module test/services/refund-lifecycle.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq: vi.fn((col: unknown, val: unknown) => ({ _type: 'eq', col, val }))
    };
});

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        previousStatus: 'previous_status',
        newStatus: 'new_status',
        triggerSource: 'trigger_source',
        metadata: 'metadata'
    },
    billingPayments: {
        id: 'id',
        customerId: 'customer_id',
        refundedAmount: 'refunded_amount',
        updatedAt: 'updated_at'
    }
}));

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        SubscriptionStatusEnum: {
            CANCELLED: 'cancelled',
            ACTIVE: 'active',
            PAST_DUE: 'past_due',
            PAUSED: 'paused',
            TRIALING: 'trialing',
            PENDING_PROVIDER: 'pending_provider',
            EXPIRED: 'expired',
            ABANDONED: 'abandoned'
        }
    };
});

// importOriginal spread preserves checkSubscriptionStatusTransition as a real
// pure function so the state-machine logic is exercised in these tests.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { applyRefundLifecycle } from '../../src/services/refund-lifecycle.service';
import { apiLogger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = 'sub-test-0001';
const CUSTOMER_ID = 'cus_test_0001';
const PAYMENT_ID = 'pay_test_0001';
const ADMIN_USER_ID = 'admin-001';

type Payment = Parameters<typeof applyRefundLifecycle>[0]['payment'];

/** Build a minimal QZPayPayment fixture linked to SUBSCRIPTION_ID. */
function buildPayment(overrides: Partial<Payment> = {}): Payment {
    return {
        id: PAYMENT_ID,
        customerId: CUSTOMER_ID,
        amount: 1000,
        status: 'refunded',
        subscriptionId: SUBSCRIPTION_ID,
        invoiceId: null,
        paymentMethodId: null,
        providerPaymentIds: {},
        failureCode: null,
        failureMessage: null,
        metadata: {},
        livemode: false,
        currency: 'ARS' as Payment['currency'],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

/**
 * Build a DB mock that handles the select-then-update(×2)-then-insert sequence
 * used by applyRefundLifecycle on the full-refund path.
 *
 * Full refund path:
 *   select[0] → subscription status
 *   update[0] → billingPayments.refundedAmount
 *   update[1] → billingSubscriptions.status
 *   insert[0] → billingSubscriptionEvents
 *
 * @param subscriptionStatus - The status returned by the SELECT query.
 */
function buildDbMock(subscriptionStatus = 'active') {
    const selectWhere = vi.fn().mockResolvedValue([{ status: subscriptionStatus }]);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return {
        db: { select, update, insert },
        spies: {
            select,
            selectFrom,
            selectWhere,
            update,
            updateSet,
            updateWhere,
            insert,
            insertValues
        }
    };
}

/**
 * Build a DB mock for the partial-refund path (T-019).
 *
 * Partial refund path (pure partial, no accumulation to full):
 *   select[0] → billingPayments.refundedAmount (prior value)
 *   update[0] → billingPayments.refundedAmount (accumulated)
 *   insert[0] → billingSubscriptionEvents (partial_refund event)
 *
 * @param priorRefundedAmount - Current value of billing_payments.refunded_amount.
 */
function buildPartialRefundDbMock(priorRefundedAmount = 0) {
    const selectWhere = vi.fn().mockResolvedValue([{ refundedAmount: priorRefundedAmount }]);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return {
        db: { select, update, insert },
        spies: {
            select,
            selectFrom,
            selectWhere,
            update,
            updateSet,
            updateWhere,
            insert,
            insertValues
        }
    };
}

/**
 * Build a DB mock for accumulated-partials-reach-full (T-019).
 *
 * This path:
 *   select[0] → billingPayments.refundedAmount (prior value)
 *   [detects accumulated >= payment.amount, falls through to full cancel path]
 *   select[1] → billingSubscriptions.status
 *   update[0] → billingPayments.refundedAmount (to payment.amount)
 *   update[1] → billingSubscriptions.status → cancelled
 *   insert[0] → billingSubscriptionEvents (full_refund event)
 */
function buildAccumulatedFullDbMock(priorRefundedAmount: number, subscriptionStatus = 'active') {
    const rows = [[{ refundedAmount: priorRefundedAmount }], [{ status: subscriptionStatus }]];
    let selectCount = 0;

    const selectWhere = vi.fn().mockImplementation(() => {
        const i = selectCount;
        selectCount += 1;
        return Promise.resolve(rows[i] ?? []);
    });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return {
        db: { select, update, insert },
        spies: {
            select,
            selectFrom,
            selectWhere,
            update,
            updateSet,
            updateWhere,
            insert,
            insertValues
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyRefundLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── No subscription linked ──────────────────────────────────────────────

    describe('when the payment has no linked subscription', () => {
        it('returns without touching the DB or clearing cache', async () => {
            const { db, spies } = buildDbMock();
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            const payment = buildPayment({ subscriptionId: null });

            await applyRefundLifecycle({ payment, refundAmount: 1000, adminUserId: ADMIN_USER_ID });

            expect(spies.select).not.toHaveBeenCalled();
            expect(spies.update).not.toHaveBeenCalled();
            expect(spies.insert).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('logs an info message explaining why no action was taken', async () => {
            const { db } = buildDbMock();
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ subscriptionId: null }),
                refundAmount: 500,
                adminUserId: ADMIN_USER_ID
            });

            expect(vi.mocked(apiLogger.info)).toHaveBeenCalledWith(
                expect.objectContaining({ paymentId: PAYMENT_ID }),
                expect.stringContaining('no linked subscription')
            );
        });
    });

    // ── Partial refund (T-019) ──────────────────────────────────────────────

    describe('partial refund (refundAmount < payment.amount) — T-019', () => {
        it('reads prior refunded_amount from billing_payments', async () => {
            const { db, spies } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(spies.select).toHaveBeenCalledTimes(1);
        });

        it('writes accumulated refunded_amount to billing_payments', async () => {
            const { db, spies } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(spies.update).toHaveBeenCalledTimes(1);
            const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.refundedAmount).toBe(400);
            expect(setArg.updatedAt).toBeInstanceOf(Date);
        });

        it('accumulates partial amounts across multiple partial refunds', async () => {
            const { db, spies } = buildPartialRefundDbMock(200); // prior = 200
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300, // new partial = 300 → total 500
                adminUserId: ADMIN_USER_ID
            });

            const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.refundedAmount).toBe(500); // 200 + 300
        });

        it('caps accumulated at payment.amount (pure partial capped below full)', async () => {
            // prior=600, partial=300 → 900 (still < 1000 → pure partial path).
            // The written refundedAmount must be 900, NOT 901 or more.
            const { db, spies } = buildPartialRefundDbMock(600);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300,
                adminUserId: ADMIN_USER_ID
            });

            const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg).toBeDefined();
            expect(setArg.refundedAmount).toBe(900); // 600 + 300, below 1000
        });

        it('inserts a payment.partial_refund audit event in billing_subscription_events', async () => {
            const { db, spies } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID,
                source: 'admin'
            });

            expect(spies.insert).toHaveBeenCalledTimes(1);
            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(eventArg).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                triggerSource: 'partial-refund',
                metadata: expect.objectContaining({
                    action: 'payment.partial_refund',
                    paymentId: PAYMENT_ID,
                    partialRefundAmount: 400,
                    priorRefundedAmount: 0,
                    newAccumulatedRefundedAmount: 400,
                    paymentAmount: 1000,
                    adminUserId: ADMIN_USER_ID,
                    source: 'admin'
                })
            });
        });

        it('does NOT update the subscription status for a pure partial refund', async () => {
            const { db, spies } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            // Only the billingPayments update should fire — NOT a billingSubscriptions update.
            // (Both would use the same `update` spy, but status = 'cancelled' must NOT appear.)
            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            const hasStatusUpdate = setArgs.some((a) => a.status === 'cancelled');
            expect(hasStatusUpdate).toBe(false);
        });

        it('does NOT clear the entitlement cache', async () => {
            const { db } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('logs info (not warn) after a successful partial refund', async () => {
            const { db } = buildPartialRefundDbMock(0);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 600,
                adminUserId: ADMIN_USER_ID
            });

            expect(vi.mocked(apiLogger.info)).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: SUBSCRIPTION_ID,
                    partialRefundAmount: 600,
                    newAccumulatedRefundedAmount: 600
                }),
                expect.stringContaining('partial refund recorded')
            );
        });
    });

    // ── Accumulated partials reach full (T-019) ────────────────────────────

    describe('partial refund that accumulates to full amount — T-019', () => {
        it('flips to full cancel path when accumulated total equals payment.amount', async () => {
            // prior=700, new partial=300 → 1000 = payment.amount → full cancel
            const { db, spies } = buildAccumulatedFullDbMock(700, 'active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300,
                adminUserId: ADMIN_USER_ID
            });

            // Subscription update (to cancelled) + billingPayments update both happen.
            expect(spies.update).toHaveBeenCalledTimes(2);
            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(true);
            expect(spies.insert).toHaveBeenCalledTimes(1);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('flips to full cancel path when accumulated total exceeds payment.amount', async () => {
            // prior=800, new partial=400 → 1200 capped to 1000 → >= payment.amount → full
            const { db, spies } = buildAccumulatedFullDbMock(800, 'active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(true);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('writes full_refund audit event (not partial_refund) when accumulated reaches full', async () => {
            const { db, spies } = buildAccumulatedFullDbMock(700, 'active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300,
                adminUserId: ADMIN_USER_ID,
                source: 'admin'
            });

            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(eventArg).toMatchObject({
                triggerSource: 'admin-refund',
                metadata: expect.objectContaining({
                    action: 'payment.full_refund',
                    source: 'admin'
                })
            });
        });
    });

    // ── Full refund — happy path ────────────────────────────────────────────

    describe('full refund — explicit amount equal to payment.amount', () => {
        it('updates both billing_payments.refunded_amount and subscription status', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // Both update calls fire: billingPayments + billingSubscriptions.
            expect(spies.update).toHaveBeenCalledTimes(2);
            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            // Payment refunded_amount update.
            expect(setArgs.some((a) => typeof a.refundedAmount === 'number')).toBe(true);
            // Subscription status update.
            const statusUpdate = setArgs.find((a) => a.status === 'cancelled');
            expect(statusUpdate).toBeDefined();
            expect(statusUpdate?.canceledAt).toBeInstanceOf(Date);
            expect(statusUpdate?.updatedAt).toBeInstanceOf(Date);
        });

        it('persists refundedAmount equal to the passed refundAmount', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            const paymentUpdate = setArgs.find((a) => typeof a.refundedAmount === 'number');
            expect(paymentUpdate?.refundedAmount).toBe(1000);
        });

        it('inserts an audit event with the correct triggerSource, action, and metadata', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID,
                source: 'admin'
            });

            expect(spies.insert).toHaveBeenCalledTimes(1);
            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(eventArg).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                previousStatus: 'active',
                newStatus: 'cancelled',
                triggerSource: 'admin-refund',
                metadata: expect.objectContaining({
                    action: 'payment.full_refund',
                    paymentId: PAYMENT_ID,
                    refundAmount: 1000,
                    adminUserId: ADMIN_USER_ID,
                    source: 'admin'
                })
            });
        });

        it('clears the entitlement cache for the customer', async () => {
            const { db } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            expect(clearEntitlementCache).toHaveBeenCalledTimes(1);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // ── Full refund — refundAmount undefined (implicit full) ───────────────

    describe('full refund — refundAmount undefined', () => {
        it('treats undefined refundAmount as a full refund and cancels the subscription', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 2000 }),
                refundAmount: undefined,
                adminUserId: ADMIN_USER_ID
            });

            expect(spies.update).toHaveBeenCalledTimes(2);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('records payment.amount in the audit event when refundAmount is undefined', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 2000 }),
                refundAmount: undefined,
                adminUserId: ADMIN_USER_ID
            });

            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as {
                metadata: { refundAmount: number };
            };
            // Falls back to payment.amount when refundAmount is undefined
            expect(eventArg.metadata.refundAmount).toBe(2000);
        });

        it('persists payment.amount as refundedAmount when refundAmount is undefined', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 2000 }),
                refundAmount: undefined,
                adminUserId: ADMIN_USER_ID
            });

            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            const paymentUpdate = setArgs.find((a) => typeof a.refundedAmount === 'number');
            expect(paymentUpdate?.refundedAmount).toBe(2000);
        });
    });

    // ── Full refund — subscription already cancelled (invalid transition) ───

    describe('full refund on an already-cancelled subscription', () => {
        it('skips the status write when the transition is invalid', async () => {
            const { db, spies } = buildDbMock('cancelled');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // Transition is invalid → subscription update NOT called; insert NOT called.
            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(false);
            expect(spies.insert).not.toHaveBeenCalled();
        });

        it('still clears the entitlement cache even when the transition is skipped', async () => {
            const { db } = buildDbMock('cancelled');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // Idempotent: cache clear is always safe — clears stale entry if present.
            expect(clearEntitlementCache).toHaveBeenCalledTimes(1);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('logs a warn explaining the invalid transition', async () => {
            const { db } = buildDbMock('cancelled');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: SUBSCRIPTION_ID,
                    from: 'cancelled',
                    to: 'cancelled'
                }),
                expect.stringContaining('invalid status transition')
            );
        });
    });

    // ── Full refund — subscription row not found ────────────────────────────

    describe('full refund when subscription row is missing from DB', () => {
        it('clears the cache and returns without writing', async () => {
            const selectWhere = vi.fn().mockResolvedValue([]); // no rows
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
            const select = vi.fn().mockReturnValue({ from: selectFrom });
            const update = vi.fn();
            const insert = vi.fn();
            vi.mocked(getDb).mockReturnValue({
                select,
                update,
                insert
            } as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            expect(update).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // ── Full refund — DB error on write ────────────────────────────────────

    describe('full refund when DB write fails', () => {
        it('clears the cache even if the update throws', async () => {
            const selectWhere = vi.fn().mockResolvedValue([{ status: 'active' }]);
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
            const select = vi.fn().mockReturnValue({ from: selectFrom });
            const updateWhere = vi.fn().mockRejectedValue(new Error('DB unavailable'));
            const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
            const update = vi.fn().mockReturnValue({ set: updateSet });
            const insert = vi.fn();
            vi.mocked(getDb).mockReturnValue({
                select,
                update,
                insert
            } as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // Fail-open: cache is cleared despite DB write failure.
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('does not propagate the DB error to the caller', async () => {
            const selectWhere = vi.fn().mockRejectedValue(new Error('DB timeout'));
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
            const select = vi.fn().mockReturnValue({ from: selectFrom });
            vi.mocked(getDb).mockReturnValue({
                select,
                update: vi.fn(),
                insert: vi.fn()
            } as unknown as ReturnType<typeof getDb>);

            await expect(
                applyRefundLifecycle({
                    payment: buildPayment(),
                    refundAmount: 1000,
                    adminUserId: ADMIN_USER_ID
                })
            ).resolves.toBeUndefined();
        });
    });

    // ── Refund from other terminal states (paused, past_due) ───────────────

    describe('full refund on a paused subscription', () => {
        it('transitions paused → cancelled (valid per state machine)', async () => {
            const { db, spies } = buildDbMock('paused');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(true);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    describe('full refund on a past_due subscription', () => {
        it('transitions past_due → cancelled (valid per state machine)', async () => {
            const { db, spies } = buildDbMock('past_due');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(true);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    describe('full refund on an expired subscription', () => {
        it('skips the status write (expired is terminal) but still clears cache', async () => {
            const { db, spies } = buildDbMock('expired');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // expired → cancelled is NOT a valid transition
            const setArgs = vi
                .mocked(spies.updateSet)
                .mock.calls.map((call) => call[0] as Record<string, unknown>);
            expect(setArgs.some((a) => a.status === 'cancelled')).toBe(false);
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // ── Source field audit trail ───────────────────────────────────────────

    describe('source field in audit trail', () => {
        it('includes source=admin in full-refund audit event when source is admin', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID,
                source: 'admin'
            });

            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            const meta = eventArg.metadata as Record<string, unknown>;
            expect(meta.source).toBe('admin');
        });

        it('includes source=webhook in full-refund audit event when source is webhook', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: 'webhook',
                source: 'webhook'
            });

            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            const meta = eventArg.metadata as Record<string, unknown>;
            expect(meta.source).toBe('webhook');
        });

        it('defaults source to admin when not provided', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
                // source not provided
            });

            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            const meta = eventArg.metadata as Record<string, unknown>;
            expect(meta.source).toBe('admin');
        });
    });
});
