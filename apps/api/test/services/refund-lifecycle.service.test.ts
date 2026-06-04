/**
 * Tests for the Refund Lifecycle Service (SPEC-194 T-006/T-007)
 *
 * `applyRefundLifecycle` applies the correct side effects when a payment is
 * refunded:
 *
 * - Full refund  → subscription transitions to `cancelled`, audit event
 *                  inserted, entitlement cache cleared.
 * - Partial refund → audit-intent warn logged; subscription unchanged, no DB
 *                    writes, no cache clear.
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
 * Build a DB mock that handles the select-then-update-then-insert sequence used
 * by applyRefundLifecycle on the full-refund path.
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

    // ── Partial refund ──────────────────────────────────────────────────────

    describe('partial refund (refundAmount < payment.amount)', () => {
        it('does NOT update the subscription status', async () => {
            const { db, spies } = buildDbMock();
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(spies.update).not.toHaveBeenCalled();
            expect(spies.insert).not.toHaveBeenCalled();
        });

        it('does NOT clear the entitlement cache', async () => {
            const { db } = buildDbMock();
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 400,
                adminUserId: ADMIN_USER_ID
            });

            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('logs a structured audit-intent warn with a TODO(SPEC-194 T-019) note', async () => {
            const { db } = buildDbMock();
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 600,
                adminUserId: ADMIN_USER_ID
            });

            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: SUBSCRIPTION_ID,
                    refundAmount: 600,
                    originalAmount: 1000
                }),
                expect.stringContaining('T-019')
            );
        });
    });

    // ── Full refund — happy path ────────────────────────────────────────────

    describe('full refund — explicit amount equal to payment.amount', () => {
        it('updates the subscription status to cancelled', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            });

            expect(spies.update).toHaveBeenCalledTimes(1);
            const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.status).toBe('cancelled');
            expect(setArg.canceledAt).toBeInstanceOf(Date);
            expect(setArg.updatedAt).toBeInstanceOf(Date);
        });

        it('inserts an audit event with the correct triggerSource and metadata', async () => {
            const { db, spies } = buildDbMock('active');
            vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

            await applyRefundLifecycle({
                payment: buildPayment({ amount: 1000 }),
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
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
                    paymentId: PAYMENT_ID,
                    refundAmount: 1000,
                    adminUserId: ADMIN_USER_ID
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

            expect(spies.update).toHaveBeenCalledTimes(1);
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

            expect(spies.update).not.toHaveBeenCalled();
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

            expect(spies.update).toHaveBeenCalledTimes(1);
            const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.status).toBe('cancelled');
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

            expect(spies.update).toHaveBeenCalledTimes(1);
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
            expect(spies.update).not.toHaveBeenCalled();
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });
});
