/**
 * Tests for the Refund Lifecycle Service (SPEC-194 T-006/T-007/T-019)
 *
 * `applyRefundLifecycle` applies the correct side effects when a payment is
 * refunded:
 *
 * - Full refund  → atomic triple-write in a single transaction: persist
 *                  refunded_amount (= payment.amount) on billing_payments,
 *                  transition subscription to `cancelled`, insert audit event.
 *                  clearEntitlementCache runs OUTSIDE the transaction.
 * - Partial refund → atomic SQL increment on billing_payments via RETURNING,
 *                    insert `payment.partial_refund` audit event; subscription
 *                    unchanged, no cache clear. When accumulated total >=
 *                    payment.amount, the full cancel+revoke path is taken.
 * - No subscription linked → no-op (logs info, no DB writes).
 * - Invalid transition (e.g. sub already cancelled) → skip status write, still
 *   clear cache (idempotent).
 * - DB errors → logged; cache cleared defensively; function does not throw.
 *
 * Regression: items 1–3 (SPEC-194 adversarial review)
 * - Item 1 (BLOCKER): accumulated-to-full now writes payment.amount, not partialAmount.
 * - Item 2 (BLOCKER): full-refund triple-write is wrapped in withServiceTransaction.
 * - Item 3 (MAJOR): partial accumulation uses atomic SQL increment (RETURNING).
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
        eq: vi.fn((col: unknown, val: unknown) => ({ _type: 'eq', col, val })),
        sql: Object.assign(
            vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
                _type: 'sql',
                strings,
                values
            })),
            { raw: vi.fn((s: string) => ({ _type: 'sql_raw', s })) }
        )
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
// withServiceTransaction is overridden to run the callback with the same db
// mock's transaction method so assertions on tx writes still work.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const { getDb } = await import('@repo/db');
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        })
    };
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
 * Build a DB mock for the full-refund path (items 1–2 fix).
 *
 * Full refund path (after fix):
 *   select[0] → subscription status (pre-transaction check)
 *   db.transaction(tx => ...)
 *     tx.update[0] → billingPayments.refundedAmount (payment.amount)
 *     tx.update[1] → billingSubscriptions.status → cancelled
 *     tx.insert[0] → billingSubscriptionEvents
 *
 * The transaction mock delegates to db.transaction() so the withServiceTransaction
 * override (in the @repo/service-core mock above) can call it with the tx proxy.
 *
 * @param subscriptionStatus - The status returned by the initial SELECT query.
 */
function buildDbMock(subscriptionStatus = 'active') {
    const selectWhere = vi.fn().mockResolvedValue([{ status: subscriptionStatus }]);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    // updateWhere used by the tx-internal writes. Needs to support the
    // full chain: update(...).set(...).where(...) — no .returning() on these.
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    // transaction mock: delegates to the callback with `this` db as tx proxy
    // (same shape so assertions on tx.update / tx.insert apply).
    const txProxy = { update, insert, select };
    const transaction = vi
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txProxy));

    const db = { select, update, insert, transaction };

    return {
        db,
        spies: {
            select,
            selectFrom,
            selectWhere,
            update,
            updateSet,
            updateWhere,
            insert,
            insertValues,
            transaction
        }
    };
}

/**
 * Build a DB mock for the partial-refund path (item 3 fix — atomic increment).
 *
 * Partial refund path (after fix):
 *   update[0].set(...).where(...).returning(...) → [{ refundedAmount: priorAmount + partial }]
 *   insert[0] → billingSubscriptionEvents (partial_refund event)
 *
 * Note: there is NO initial SELECT anymore — the atomic UPDATE RETURNING replaces it.
 *
 * @param returnedAccumulated - What the atomic increment RETURNS (post-update value).
 *   This should be priorAmount + partialAmount, capped at payment.amount.
 */
function buildPartialRefundDbMock(returnedAccumulated: number) {
    // Partial path: update().set().where().returning() → [{ refundedAmount: returnedAccumulated }]
    const updateReturning = vi.fn().mockResolvedValue([{ refundedAmount: returnedAccumulated }]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    // select is NOT called on the pure-partial path after the fix
    const select = vi.fn();

    // transaction is NOT called on the pure-partial path
    const transaction = vi.fn();

    const db = { select, update, insert, transaction };

    return {
        db,
        spies: {
            select,
            update,
            updateSet,
            updateWhere,
            updateReturning,
            insert,
            insertValues,
            transaction
        }
    };
}

/**
 * Build a DB mock for accumulated-partials-reach-full path (items 1+3 fix).
 *
 * After the fix:
 *   update[0].set(...).where(...).returning(...) → [{ refundedAmount: payment.amount }]
 *   (falls through to full-cancel path)
 *   select[0] → billingSubscriptions.status
 *   db.transaction(tx => ...)
 *     tx.update[1] → billingPayments.refundedAmount (payment.amount — idempotent)
 *     tx.update[2] → billingSubscriptions.status → cancelled
 *     tx.insert[0] → billingSubscriptionEvents (full_refund event)
 *
 * Item 1 regression: effectiveRefundedAmount must be payment.amount (1000), NOT
 * the raw partialAmount (e.g. 300 when prior=700).
 */
function buildAccumulatedFullDbMock(
    accumulatedReturnedValue: number,
    subscriptionStatus = 'active'
) {
    // Atomic increment returns accumulated = payment.amount (full reached).
    const updateReturning = vi
        .fn()
        .mockResolvedValue([{ refundedAmount: accumulatedReturnedValue }]);
    // tx-internal writes (inside transaction) have no .returning()
    const txUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const txUpdateSet = vi.fn().mockReturnValue({ where: txUpdateWhere });

    // The update spy needs to differentiate: the first call (partial atomic increment)
    // returns the chain with .returning(); subsequent calls (inside tx) return the
    // chain without .returning().
    let updateCallCount = 0;
    const update = vi.fn().mockImplementation(() => {
        updateCallCount++;
        if (updateCallCount === 1) {
            // First call: atomic increment on billingPayments — needs .returning()
            return {
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({ returning: updateReturning })
                })
            };
        }
        // Subsequent calls: inside tx — no .returning()
        return { set: txUpdateSet };
    });

    const selectWhere = vi.fn().mockResolvedValue([{ status: subscriptionStatus }]);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    const txProxy = { update, insert, select };
    const transaction = vi
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txProxy));

    const db = { select, update, insert, transaction };

    return {
        db,
        spies: {
            select,
            selectWhere,
            update,
            updateReturning,
            txUpdateSet,
            txUpdateWhere,
            insert,
            insertValues,
            transaction
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

    // ── Partial refund (T-019 + item 3: atomic increment) ──────────────────

    describe('partial refund (refundAmount < payment.amount) — T-019 / item-3 atomic increment', () => {
        it('calls atomic UPDATE RETURNING instead of SELECT-then-UPDATE', async () => {
            // returnedAccumulated = 400 (prior=0 + partial=400, below payment.amount=1000)
            const { db, spies } = buildPartialRefundDbMock(400);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            // No SELECT on the partial path — atomic update replaces it.
            expect(spies.select).not.toHaveBeenCalled();
            // The update must have been called (for the atomic increment).
            expect(spies.update).toHaveBeenCalledTimes(1);
            // .returning() must have been invoked on the update chain.
            expect(spies.updateReturning).toHaveBeenCalledTimes(1);
        });

        it('inserts a payment.partial_refund audit event with correct accumulated value', async () => {
            // returnedAccumulated = 500 (e.g. prior=200 + partial=300)
            const { db, spies } = buildPartialRefundDbMock(500);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300,
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
                    partialRefundAmount: 300,
                    newAccumulatedRefundedAmount: 500,
                    paymentAmount: 1000,
                    adminUserId: ADMIN_USER_ID,
                    source: 'admin'
                })
            });
        });

        it('does NOT update subscription status for a pure partial refund', async () => {
            const { db, spies } = buildPartialRefundDbMock(400);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            // No transaction should be opened; only one update (atomic increment).
            expect(spies.transaction).not.toHaveBeenCalled();
            // The single update call is the atomic increment, not a status update.
            expect(spies.update).toHaveBeenCalledTimes(1);
        });

        it('does NOT clear the entitlement cache', async () => {
            const { db } = buildPartialRefundDbMock(400);
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('logs info after a successful partial refund', async () => {
            const { db } = buildPartialRefundDbMock(600);
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

    // ── Accumulated partials reach full (items 1+3 fix) ───────────────────

    describe('partial refund that accumulates to full amount — T-019 / items 1+3', () => {
        it('REGRESSION item-1: writes payment.amount (not partialAmount) when accumulated reaches full', async () => {
            // Fixture: prior=7000, partial=3000 → returned=10000 (=payment.amount).
            // The BUG was that effectiveRefundedAmount was set to refundAmount (3000)
            // instead of payment.amount (10000). After the fix, the tx must write 10000.
            const { db, spies } = buildAccumulatedFullDbMock(10000, 'active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 10000 }),
                refundAmount: 3000,
                adminUserId: ADMIN_USER_ID
            });

            // Transaction must have been opened (full cancel path).
            expect(spies.transaction).toHaveBeenCalledTimes(1);
            // The insert (audit event) must have been called once.
            expect(spies.insert).toHaveBeenCalledTimes(1);
            const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            // Audit metadata must record payment.amount (10000), not partialAmount (3000).
            expect((eventArg.metadata as Record<string, unknown>).refundAmount).toBe(10000);
            // Cache must be cleared.
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('writes full_refund audit event (not partial_refund) when accumulated reaches full', async () => {
            // prior=700, partial=300 → accumulated=1000 = payment.amount
            const { db, spies } = buildAccumulatedFullDbMock(1000, 'active');
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

        it('clears entitlement cache when accumulated partials reach full', async () => {
            const { db } = buildAccumulatedFullDbMock(1000, 'active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 300,
                adminUserId: ADMIN_USER_ID
            });

            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // ── Full refund — happy path (item 2: atomic triple-write in tx) ────────

    describe('full refund — explicit amount equal to payment.amount', () => {
        it('REGRESSION item-2: wraps billingPayments + subscription + audit in a single transaction', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // withServiceTransaction (mocked to db.transaction) must be called once.
            expect(spies.transaction).toHaveBeenCalledTimes(1);
            // Two updates inside the transaction.
            expect(spies.update).toHaveBeenCalledTimes(2);
            // One insert inside the transaction.
            expect(spies.insert).toHaveBeenCalledTimes(1);
        });

        it('persists refundedAmount equal to payment.amount inside the transaction', async () => {
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

        it('updates subscription status to cancelled inside the transaction', async () => {
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
            const statusUpdate = setArgs.find((a) => a.status === 'cancelled');
            expect(statusUpdate).toBeDefined();
            expect(statusUpdate?.canceledAt).toBeInstanceOf(Date);
            expect(statusUpdate?.updatedAt).toBeInstanceOf(Date);
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

        it('clears the entitlement cache OUTSIDE the transaction', async () => {
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

            expect(spies.transaction).toHaveBeenCalledTimes(1);
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

            // No transaction on invalid transition.
            expect(spies.transaction).not.toHaveBeenCalled();
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
            const transaction = vi.fn();
            vi.mocked(getDb).mockReturnValue({
                select,
                update,
                insert,
                transaction
            } as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            expect(update).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
            expect(transaction).not.toHaveBeenCalled();
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // ── Full refund — DB transaction failure ──────────────────────────────

    describe('full refund when transaction fails', () => {
        it('clears the cache even if the transaction throws', async () => {
            const selectWhere = vi.fn().mockResolvedValue([{ status: 'active' }]);
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
            const select = vi.fn().mockReturnValue({ from: selectFrom });
            // transaction throws to simulate mid-write failure
            const transaction = vi.fn().mockRejectedValue(new Error('DB unavailable'));
            const update = vi.fn();
            const insert = vi.fn();
            vi.mocked(getDb).mockReturnValue({
                select,
                update,
                insert,
                transaction
            } as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment(),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            // Fail-open: cache is cleared despite transaction failure.
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('does not propagate the DB error to the caller', async () => {
            const selectWhere = vi.fn().mockRejectedValue(new Error('DB timeout'));
            const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
            const select = vi.fn().mockReturnValue({ from: selectFrom });
            vi.mocked(getDb).mockReturnValue({
                select,
                update: vi.fn(),
                insert: vi.fn(),
                transaction: vi.fn()
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

            expect(spies.transaction).toHaveBeenCalledTimes(1);
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

            expect(spies.transaction).toHaveBeenCalledTimes(1);
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
            expect(spies.transaction).not.toHaveBeenCalled();
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
