/**
 * Unit tests for the abandoned-pending-subs cron job (SPEC-126 D6, HOS-151 Bug B).
 *
 * Covers:
 * - Constants (TTL, lock key, status sets) so they don't drift from the
 *   `/start-paid` route's expiresAt and from sibling cron lock keys.
 * - Job definition shape (name, schedule, enabled, timeout).
 * - `reapPendingCandidate` (HOS-151 Bug B core): a row holding a live
 *   `mp_subscription_id` is only abandoned AFTER MercadoPago confirms the
 *   preapproval is cancelled (cancel + verify via retrieve); a failed/unconfirmed
 *   cancel leaves the row pending and is captured to Sentry; rows with no
 *   preapproval id are abandoned directly.
 * - HOS-1326: the row ACTUALLY LANDS in `abandoned` — see
 *   {@link makeSubscriptionStore} and the "lands in abandoned" describe block.
 * - Handler orchestration: advisory-lock skip, transition-guard skip, dry-run
 *   count, billing-unavailable skip, and best-effort user notifications.
 *
 * ---
 * WHY THE HARNESS LOOKS LIKE THIS (HOS-1326)
 *
 * Until HOS-1326 this file could not see its own subject's central bug, for two
 * independent reasons, and fixing the cron without fixing both would have left
 * a green that still meant nothing:
 *
 * 1. it mocked `billing.subscriptions.cancel` to a no-op. The real call also
 *    writes `status: 'canceled'` on the LOCAL row (qzpay-core 7.0.0), and that
 *    write was the whole bug — mocked away, the effect under test never
 *    happened in the test;
 * 2. `makeDbMock` returned its rows regardless of the `where(...)` it was
 *    handed, so an UPDATE whose WHERE matched NOTHING still "returned" a row.
 *    That is precisely the observation the bug hinges on.
 *
 * {@link makeSubscriptionStore} fixes both: it holds a real mutable status and
 * refuses the abandon UPDATE when that status has left {@link
 * _internals.PENDING_STATUSES}, exactly as the SQL does. `makeDbMock` is kept for
 * the tests that assert *whether* the write was attempted (concurrency guards),
 * where the row-echo is the point.
 *
 * @module test/cron/abandoned-pending-subs
 */

import * as serviceCore from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _internals,
    abandonedPendingSubsJob
} from '../../src/cron/jobs/abandoned-pending-subs.job';

// ─── Hoisted mocks (must be before vi.mock calls) ─────────────────────────────

const {
    mockBillingCustomersGet,
    mockBillingPlansGet,
    mockBillingSubscriptionsCancel,
    mockSendNotification,
    mockAdapterCancel,
    mockAdapterRetrieve,
    mockCreateMercadoPagoAdapter,
    mockSentryCapture,
    mockGetDb,
    mockFindByLocalSubscriptionId,
    mockFindUnlinkedChargeByLocalSubscriptionId
} = vi.hoisted(() => ({
    mockBillingCustomersGet: vi.fn(),
    mockBillingPlansGet: vi.fn(),
    mockBillingSubscriptionsCancel: vi.fn().mockResolvedValue(undefined),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    mockAdapterCancel: vi.fn().mockResolvedValue(undefined),
    mockAdapterRetrieve: vi.fn(),
    mockCreateMercadoPagoAdapter: vi.fn(),
    mockSentryCapture: vi.fn(),
    mockGetDb: vi.fn(),
    mockFindByLocalSubscriptionId: vi.fn(),
    mockFindUnlinkedChargeByLocalSubscriptionId: vi.fn()
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────
// Minimal mock for @repo/db so the handler can acquire the advisory lock, SELECT
// candidates, and (post-commit) run per-row abandon UPDATEs via getDb().

const mockTx = {
    execute: vi.fn(),
    select: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        // HOS-1084: the lifecycle sites now reconcile through
        // `subscription-linked-entities.service`, which reaches the shared
        // `entity_subscriptions` status cache at module scope. Named
        // explicitly because this file replaces the @repo/db mock wholesale.
        ENTITY_SUBSCRIPTION_STATUS_NONE: 'none',
        entitySubscriptions: {
            id: 'id',
            subscriptionId: 'subscription_id',
            productDomain: 'product_domain',
            entityType: 'entity_type',
            entityId: 'entity_id',
            status: 'status',
            planId: 'plan_id'
        },
        billingSubscriptions: {
            id: 'ID',
            status: 'STATUS',
            createdAt: 'CREATED_AT',
            deletedAt: 'DELETED_AT',
            updatedAt: 'UPDATED_AT',
            customerId: 'CUSTOMER_ID',
            planId: 'PLAN_ID',
            mpSubscriptionId: 'MP_SUBSCRIPTION_ID'
        },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        }),
        getDb: mockGetDb,
        withTransaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
        billingPendingCheckoutModel: {
            findByLocalSubscriptionId: mockFindByLocalSubscriptionId,
            findUnlinkedChargeByLocalSubscriptionId: mockFindUnlinkedChargeByLocalSubscriptionId
        }
    };
});

// ─── Billing / adapter / notification / Sentry / logger mocks ─────────────────

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: vi.fn(() => ({
        customers: { get: mockBillingCustomersGet },
        plans: { get: mockBillingPlansGet },
        subscriptions: { cancel: mockBillingSubscriptionsCancel }
    }))
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: mockCreateMercadoPagoAdapter
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Only the CONFIRMED_TERMINAL_STATUSES set is used from this module — mock it to
// avoid pulling in the module's heavy dependency tree (Sentry, db, services).
vi.mock('../../src/services/billing/reactivation-supersession-complete.js', () => ({
    CONFIRMED_TERMINAL_STATUSES: new Set([
        'canceled',
        'cancelled',
        'incomplete_expired',
        'finished',
        'expired'
    ])
}));

vi.mock('@sentry/node', () => ({
    captureException: mockSentryCapture
}));

vi.mock('../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Builds a minimal CronJobContext for the handler. */
function makeCronCtx(dryRun = false) {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun
    };
}

/** Minimal logger for direct reapPendingCandidate unit tests. */
function makeLogger() {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

/**
 * Builds a `db` mock whose single `update(...).set(...).where(...).returning()`
 * chain resolves to `returningRows`. Returns the db plus the leaf spies so a
 * test can assert whether the abandon write ran.
 */
function makeDbMock(returningRows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    return { db: { update }, update, set, where, returning };
}

/**
 * A `db` mock that holds ONE mutable `billing_subscriptions` row and honours the
 * abandon UPDATE's status precondition instead of echoing rows unconditionally
 * (HOS-1326).
 *
 * `makeDbMock` above answers "was an UPDATE attempted?"; this answers "what
 * status did the row END UP in?", which is a different and, for this job, the
 * load-bearing question. The reaper's write is
 * `UPDATE ... SET status = 'abandoned' WHERE id = ? AND status IN (pending) AND
 * <mp guard> AND deleted_at IS NULL RETURNING ...`, so a row whose status has
 * already left the pending set is a NO-OP that returns zero rows. This mock
 * reproduces exactly that: every `.set({ status })` applies only while the
 * CURRENT status is in `_internals.PENDING_STATUSES`, and it reads that set from
 * the module under test rather than re-typing the spellings, so widening the
 * real precondition widens the mock with it.
 *
 * Every write the reaper performs — including any it should NOT be performing —
 * goes through this one chain, which is what lets a test assert that nothing
 * knocked the row out of the pending set on the way to `abandoned`.
 *
 * @param initial - The row as the Phase-1 SELECT would have found it.
 * @returns The `db` stand-in, the live row (read it after the call), and the
 *   spies.
 */
function makeSubscriptionStore(initial: {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
    readonly status: string;
    readonly mpSubscriptionId: string | null;
}) {
    const row = { ...initial };
    /** Every `.set(...)` payload the code under test issued, in order. */
    const writes: Array<Record<string, unknown>> = [];

    const update = vi.fn().mockImplementation(() => ({
        set: (patch: Record<string, unknown>) => {
            writes.push(patch);
            return {
                where: () => ({
                    returning: async () => {
                        // The real WHERE: the row must STILL be pending.
                        if (!_internals.PENDING_STATUSES.includes(row.status)) {
                            return [];
                        }
                        if (typeof patch.status === 'string') {
                            row.status = patch.status;
                        }
                        return [{ id: row.id, customerId: row.customerId, planId: row.planId }];
                    }
                })
            };
        }
    }));

    return { db: { update }, row, update, writes };
}

const ABANDONED_ROW = { id: 'sub-1', customerId: 'cust-1', planId: 'plan-1' };

// ─── Constants + definition ───────────────────────────────────────────────────

describe('abandoned-pending-subs internals', () => {
    it('reserves advisory lock key 1006 (no overlap with sibling crons)', () => {
        // Sibling keys: 1003 dunning, 1004 trial-expiry (1005 free — HOS-121).
        expect(_internals.ADVISORY_LOCK_KEY).toBe(1006);
    });

    it('uses a 30-minute TTL matching the start-paid route expiresAt', () => {
        expect(_internals.PENDING_PROVIDER_TTL_MS).toBe(30 * 60 * 1000);
    });

    it('matches both qzpay-vocabulary and Hospeda-vocabulary pending statuses', () => {
        expect(_internals.PENDING_STATUSES).toContain('incomplete');
        expect(_internals.PENDING_STATUSES).toContain('pending_provider');
    });

    it('writes canonical abandoned (Hospeda enum) as the terminal status', () => {
        expect(_internals.ABANDONED_STATUS).toBe('abandoned');
    });
});

describe('abandonedPendingSubsJob definition', () => {
    it('is registered with the expected name', () => {
        expect(abandonedPendingSubsJob.name).toBe('abandoned-pending-subs');
    });

    it('runs hourly at minute 0', () => {
        expect(abandonedPendingSubsJob.schedule).toBe('0 * * * *');
    });

    it('is enabled by default', () => {
        expect(abandonedPendingSubsJob.enabled).toBe(true);
    });

    it('uses a 2-minute timeout', () => {
        expect(abandonedPendingSubsJob.timeoutMs).toBe(2 * 60 * 1000);
    });
});

// ─── reapPendingCandidate — HOS-151 Bug B core ────────────────────────────────

describe('reapPendingCandidate (HOS-151 Bug B: cancel + verify before abandon)', () => {
    const paymentAdapter = {
        subscriptions: { cancel: mockAdapterCancel, retrieve: mockAdapterRetrieve }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapterCancel.mockResolvedValue(undefined);
        mockBillingSubscriptionsCancel.mockResolvedValue(undefined);
        // HOS-276: no reconcile_assisted correlation row by default — tests that
        // exercise it override this explicitly.
        mockFindUnlinkedChargeByLocalSubscriptionId.mockResolvedValue(null);
    });

    it('abandons a row directly when it has NO preapproval id (nothing to cancel)', async () => {
        const { db, update, returning } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: true, info: ABANDONED_ROW });
        // No preapproval → never cancels or verifies against MP.
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledOnce();
        expect(returning).toHaveBeenCalledOnce();
    });

    it('treats an empty-string preapproval id as "nothing to cancel"', async () => {
        const { db } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: ''
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome.abandoned).toBe(true);
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
    });

    it('does NOT abandon an mp-null row while a still-valid Path C checkout is in progress (FIX B)', async () => {
        const { db, update } = makeDbMock([ABANDONED_ROW]);
        // A pending correlation row whose own TTL has not yet elapsed → the
        // customer may still be on MercadoPago's hosted page.
        mockFindByLocalSubscriptionId.mockResolvedValue({
            id: 'pc-1',
            localSubscriptionId: 'sub-1',
            status: 'pending',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'checkout-in-progress' });
        // Row is left pending — no abandon write, no MP calls.
        expect(update).not.toHaveBeenCalled();
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it('abandons an mp-null row when its Path C checkout TTL has already elapsed (FIX B)', async () => {
        const { db, update } = makeDbMock([ABANDONED_ROW]);
        mockFindByLocalSubscriptionId.mockResolvedValue({
            id: 'pc-1',
            localSubscriptionId: 'sub-1',
            status: 'pending',
            expiresAt: new Date(Date.now() - 60 * 1000) // expired
        });

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: true, info: ABANDONED_ROW });
        expect(update).toHaveBeenCalledOnce();
    });

    it('abandons an mp-null row when no Path C checkout correlation row exists (FIX B)', async () => {
        const { db, update } = makeDbMock([ABANDONED_ROW]);
        mockFindByLocalSubscriptionId.mockResolvedValue(null);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: true, info: ABANDONED_ROW });
        expect(update).toHaveBeenCalledOnce();
    });

    it('HOS-276: does NOT abandon an mp-null row whose correlation row already resolved to reconcile_assisted', async () => {
        // No in-progress `pending` checkout (that guard already passed), but a
        // REAL charge landed and the heuristic linking path could not
        // auto-resolve it — the row must be left for manual reconciliation,
        // never silently abandoned.
        mockFindByLocalSubscriptionId.mockResolvedValue(null);
        mockFindUnlinkedChargeByLocalSubscriptionId.mockResolvedValue({
            id: 'pc-1',
            localSubscriptionId: 'sub-1',
            status: 'reconcile_assisted'
        });
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'reconcile-assisted-manual' });
        expect(update).not.toHaveBeenCalled();
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it('cancels then verifies via retrieve, and abandons once MP confirms cancelled', async () => {
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        // HOS-1326: the cancel goes to the PROVIDER, addressed by the
        // preapproval id and with `false` (irreversible), never to
        // `billing.subscriptions.cancel(localRowId)` — which would also write a
        // local status and is asserted absent for that reason.
        expect(mockAdapterCancel).toHaveBeenCalledWith('mp-pre-123', false);
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-pre-123');
        expect(update).toHaveBeenCalledOnce();
        expect(outcome).toEqual({ abandoned: true, info: ABANDONED_ROW });
        expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('does NOT abandon and captures to Sentry when MP still reports a live status', async () => {
        // The preapproval is still 'authorized' (live/chargeable) after cancel.
        mockAdapterRetrieve.mockResolvedValue({ status: 'authorized' });
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'cancel-unverified' });
        // CRITICAL: the row is NOT abandoned while its preapproval is live.
        expect(update).not.toHaveBeenCalled();
        expect(mockSentryCapture).toHaveBeenCalledOnce();
    });

    it('still abandons when the cancel call throws but retrieve confirms cancelled', async () => {
        mockAdapterCancel.mockRejectedValueOnce(new Error('MP 500'));
        mockAdapterRetrieve.mockResolvedValue({ status: 'canceled' });
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        // The cancel error is swallowed; retrieve() is the source of truth.
        expect(outcome.abandoned).toBe(true);
        expect(update).toHaveBeenCalledOnce();
    });

    it('does NOT abandon and captures to Sentry when retrieve itself throws', async () => {
        mockAdapterRetrieve.mockRejectedValue(new Error('MP unreachable'));
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'cancel-unverified' });
        expect(update).not.toHaveBeenCalled();
        expect(mockSentryCapture).toHaveBeenCalledOnce();
    });

    it('returns already-reaped when the guarded UPDATE matches no row (concurrent run)', async () => {
        const { db } = makeDbMock([]); // returning() empty → another run won already

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'already-reaped' });
    });

    it('FIX 2: does NOT abandon an mp-null candidate whose row got linked mid-sweep (guarded UPDATE no-op)', async () => {
        // Candidate was SELECTed with mp_subscription_id === null. Between that
        // snapshot and this UPDATE, the link-preapproval flow set the mp id
        // (status stays pending_provider) and marked the correlation row linked —
        // so findByLocalSubscriptionId no longer returns an in-progress checkout.
        // Without FIX 2's `isNull(mp_subscription_id)` guard the status-only WHERE
        // would still match and wrongly abandon a row holding a LIVE preapproval.
        // With the guard, the UPDATE matches no row → already-reaped (no-op).
        mockFindByLocalSubscriptionId.mockResolvedValue(null);
        const { db, update, returning } = makeDbMock([]); // guard filters the row out

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        // The abandon UPDATE was attempted (the guard lives in its WHERE), but it
        // matched nothing, so the linked row is left intact rather than abandoned.
        expect(update).toHaveBeenCalledOnce();
        expect(returning).toHaveBeenCalledOnce();
        expect(outcome).toEqual({ abandoned: false, reason: 'already-reaped' });
        // No MP calls for an mp-null candidate.
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
    });
});

// ─── HOS-1326: the row actually LANDS in `abandoned` ──────────────────────────

describe('reapPendingCandidate (HOS-1326: the reaped row lands in `abandoned`)', () => {
    const paymentAdapter = {
        subscriptions: { cancel: mockAdapterCancel, retrieve: mockAdapterRetrieve }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapterCancel.mockResolvedValue(undefined);
        mockBillingSubscriptionsCancel.mockResolvedValue(undefined);
        mockFindByLocalSubscriptionId.mockResolvedValue(null);
        mockFindUnlinkedChargeByLocalSubscriptionId.mockResolvedValue(null);
    });

    // THE regression test for HOS-1326.
    //
    // Every other test in this file about the preapproval-holding path asserts
    // the OUTCOME OBJECT the function returns, over a db mock that echoes a row
    // no matter what the WHERE says. This one asserts the STATUS THE ROW ENDS UP
    // WITH, over a store that applies the same precondition the SQL does — so a
    // write that knocks the row out of the pending set before the abandon UPDATE
    // is observable here and nowhere else.
    //
    // Pre-fix, `billing.subscriptions.cancel(candidate.id)` wrote
    // `status: 'canceled'` on this very row (qzpay-core 7.0.0) between the two
    // steps, the abandon UPDATE matched nothing, and the candidate came back
    // `already-reaped` with the row stuck on the qzpay spelling of a word that
    // was wrong anyway. Production agreed: the only `abandoned` rows there were
    // the ones that never had a preapproval to cancel.
    it('a candidate WITH a preapproval ends on `abandoned`, not on a cancellation spelling', async () => {
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const store = makeSubscriptionStore({
            id: 'sub-mp',
            customerId: 'cust-1',
            planId: 'plan-1',
            status: 'incomplete', // as qzpay-core's mode:'paid' insert leaves it
            mpSubscriptionId: 'mp-pre-123'
        });

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-mp',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: store.db as any,
            logger: makeLogger()
        });

        // The whole point: the ROW, not just the return value.
        expect(store.row.status).toBe('abandoned');
        expect(outcome).toEqual({
            abandoned: true,
            info: { id: 'sub-mp', customerId: 'cust-1', planId: 'plan-1' }
        });

        // Exactly ONE local write happened, and it wrote the terminal status.
        // Nothing wrote a cancellation on the way — in either spelling, which is
        // asserted explicitly because the two vocabularies live in this one
        // column and `canceled` is the one that looks like a typo (HOS-1329).
        expect(store.writes).toHaveLength(1);
        expect(store.writes[0]?.status).toBe('abandoned');
        for (const write of store.writes) {
            expect(write.status).not.toBe('canceled');
            expect(write.status).not.toBe('cancelled');
        }
    });

    it('a candidate with NO preapproval ends on `abandoned` too', async () => {
        const store = makeSubscriptionStore({
            id: 'sub-null',
            customerId: 'cust-1',
            planId: 'plan-1',
            status: 'pending_provider',
            mpSubscriptionId: null
        });

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-null',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            },
            paymentAdapter: paymentAdapter as any,
            db: store.db as any,
            logger: makeLogger()
        });

        expect(outcome.abandoned).toBe(true);
        expect(store.row.status).toBe('abandoned');
    });

    // The store is only a useful witness if it can actually say NO. Drive it
    // from a row that is already terminal and confirm the abandon UPDATE
    // no-ops — the same shape the pre-fix bug produced, reached here by data
    // instead of by a code path, so the mock cannot silently degrade into the
    // unconditional row-echo it replaced.
    it('the store refuses the abandon UPDATE on a row that already left the pending set', async () => {
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const store = makeSubscriptionStore({
            id: 'sub-gone',
            customerId: 'cust-1',
            planId: 'plan-1',
            status: 'canceled', // what the pre-fix cancel left behind
            mpSubscriptionId: 'mp-pre-123'
        });

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-gone',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            paymentAdapter: paymentAdapter as any,
            db: store.db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'already-reaped' });
        expect(store.row.status).toBe('canceled');
    });
});

// ─── Handler orchestration ────────────────────────────────────────────────────

describe('abandonedPendingSubsJob handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Lock acquired by default.
        mockTx.execute.mockResolvedValue({ rows: [{ acquired: true }] });
        // Default candidate SELECT: empty.
        mockTx.select.mockReturnValue({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([])
        });
        // Adapter constructs fine by default.
        mockCreateMercadoPagoAdapter.mockReturnValue({
            subscriptions: { cancel: mockAdapterCancel, retrieve: mockAdapterRetrieve }
        });
        mockAdapterCancel.mockResolvedValue(undefined);
        mockBillingSubscriptionsCancel.mockResolvedValue(undefined);
        mockBillingCustomersGet.mockResolvedValue({
            id: 'cust-1',
            email: 'user@example.com',
            metadata: { name: 'Test User' }
        });
        mockBillingPlansGet.mockResolvedValue({ id: 'plan-1', name: 'Owner Básico' });
        mockSendNotification.mockResolvedValue(undefined);
        // Default getDb: abandon UPDATE echoes one row.
        mockGetDb.mockReturnValue(makeDbMock([ABANDONED_ROW]).db);
        // HOS-276: no reconcile_assisted correlation row by default.
        mockFindUnlinkedChargeByLocalSubscriptionId.mockResolvedValue(null);
    });

    /** Configure the candidate SELECT to resolve `rows`. */
    function withCandidates(rows: unknown[]) {
        mockTx.select.mockReturnValue({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(rows)
        });
    }

    it('skips when another replica holds the advisory lock', async () => {
        mockTx.execute.mockResolvedValue({ rows: [{ acquired: false }] });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.message).toContain('another replica');
    });

    it('skips status writes and logs error when the transition guard is invalid', async () => {
        const guardSpy = vi
            .spyOn(serviceCore, 'checkSubscriptionStatusTransition')
            .mockReturnValue({
                valid: false,
                reason: 'Transition pending_provider → abandoned is not permitted (test override)'
            });

        const ctx = makeCronCtx(false);
        const result = await abandonedPendingSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockGetDb).not.toHaveBeenCalled();
        expect(ctx.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('invalid transition guard'),
            expect.objectContaining({ from: 'pending_provider', to: 'abandoned' })
        );

        guardSpy.mockRestore();
    });

    it('dry-run counts candidates without cancelling, writing, or notifying', async () => {
        mockTx.select.mockReturnValue({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ id: 'sub-dry-1' }, { id: 'sub-dry-2' }])
        });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(true));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('leaves candidates pending (0 processed) when the MP adapter cannot be constructed', async () => {
        withCandidates([
            { id: 'sub-1', customerId: 'cust-1', planId: 'plan-1', mpSubscriptionId: 'mp-pre-1' }
        ]);
        mockCreateMercadoPagoAdapter.mockImplementation(() => {
            throw new Error('MP creds missing');
        });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockGetDb).not.toHaveBeenCalled();
        expect(result.message).toContain('adapter unavailable');
    });

    it('abandons a no-preapproval candidate and sends its SUBSCRIPTION_CANCELLED notification', async () => {
        withCandidates([
            { id: 'sub-abc', customerId: 'cust-1', planId: 'plan-1', mpSubscriptionId: null }
        ]);
        mockGetDb.mockReturnValue(
            makeDbMock([{ id: 'sub-abc', customerId: 'cust-1', planId: 'plan-1' }]).db
        );
        mockBillingCustomersGet.mockResolvedValue({
            id: 'cust-1',
            email: 'owner@example.com',
            metadata: { name: 'Ana García' }
        });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(mockAdapterCancel).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockSendNotification).toHaveBeenCalledOnce();
        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'subscription_cancelled',
                recipientEmail: 'owner@example.com',
                recipientName: 'Ana García',
                customerId: 'cust-1',
                planName: 'Owner Básico',
                idempotencyKey: 'abandoned-sub-sub-abc'
            })
        );
    });

    it('cancels + verifies a candidate that holds a live preapproval before abandoning it', async () => {
        withCandidates([
            { id: 'sub-mp', customerId: 'cust-1', planId: 'plan-1', mpSubscriptionId: 'mp-pre-9' }
        ]);
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        mockGetDb.mockReturnValue(
            makeDbMock([{ id: 'sub-mp', customerId: 'cust-1', planId: 'plan-1' }]).db
        );

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.processed).toBe(1);
        // HOS-1326: the whole sweep holds a `billing` client (it needs it for the
        // notification loop) and must still never route a cancel through it —
        // `billing.subscriptions.cancel` writes a local status, which is the bug.
        expect(mockAdapterCancel).toHaveBeenCalledWith('mp-pre-9', false);
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-pre-9');
        expect(result.errors).toBe(0);
    });

    it('leaves a live-preapproval candidate pending and reports it via errors when cancel is unconfirmed', async () => {
        withCandidates([
            { id: 'sub-live', customerId: 'cust-1', planId: 'plan-1', mpSubscriptionId: 'mp-live' }
        ]);
        mockAdapterRetrieve.mockResolvedValue({ status: 'authorized' });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(1);
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(mockSentryCapture).toHaveBeenCalledOnce();
    });

    it('HOS-276: leaves a reconcile_assisted mp-null candidate pending, surfaced in its own field — NOT in errors', async () => {
        withCandidates([
            {
                id: 'sub-reconcile',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: null
            }
        ]);
        mockFindByLocalSubscriptionId.mockResolvedValue(null);
        mockFindUnlinkedChargeByLocalSubscriptionId.mockResolvedValue({
            id: 'pc-1',
            localSubscriptionId: 'sub-reconcile',
            status: 'reconcile_assisted'
        });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        // `reconcile_assisted` is an expected "needs manual reconciliation"
        // signal, not an error — it must NOT pin the hourly `errors` count
        // non-zero forever. It gets its own dedicated field instead.
        expect(result.errors).toBe(0);
        expect(result.details?.reconcileAssistedManual).toBe(1);
        expect(result.message).toContain('reconcile_assisted');
        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('HOS-276: a cancel-unverified live preapproval STILL counts in errors, unlike reconcile_assisted', async () => {
        withCandidates([
            {
                id: 'sub-live-2',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-live-2'
            }
        ]);
        mockAdapterRetrieve.mockResolvedValue({ status: 'authorized' });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.success).toBe(true);
        expect(result.errors).toBe(1);
        expect(result.details?.cancelUnverified).toBe(1);
        expect(result.details?.reconcileAssistedManual).toBe(0);
    });

    it('continues the sweep when one notification fails (non-fatal)', async () => {
        withCandidates([
            { id: 'sub-ok', customerId: 'cust-1', planId: 'plan-1', mpSubscriptionId: null },
            { id: 'sub-fail', customerId: 'cust-2', planId: 'plan-1', mpSubscriptionId: null }
        ]);
        // getDb() is called ONCE and shared across candidates — its single
        // update chain must return a different row per (sequential) abandon call.
        const returning = vi
            .fn()
            .mockResolvedValueOnce([{ id: 'sub-ok', customerId: 'cust-1', planId: 'plan-1' }])
            .mockResolvedValueOnce([{ id: 'sub-fail', customerId: 'cust-2', planId: 'plan-1' }]);
        const where = vi.fn().mockReturnValue({ returning });
        const set = vi.fn().mockReturnValue({ where });
        mockGetDb.mockReturnValue({ update: vi.fn().mockReturnValue({ set }) });
        mockBillingCustomersGet
            .mockResolvedValueOnce({
                id: 'cust-1',
                email: 'ok@example.com',
                metadata: { name: 'OK' }
            })
            .mockResolvedValueOnce({ id: 'cust-2', email: 'fail@example.com', metadata: {} });
        mockSendNotification
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('SMTP timeout'));

        const ctx = makeCronCtx(false);
        const result = await abandonedPendingSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(mockSendNotification).toHaveBeenCalledTimes(2);
        expect(ctx.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to send abandoned-sub notification'),
            expect.objectContaining({ subscriptionId: 'sub-fail' })
        );
    });

    it('falls back to the email prefix when customer metadata.name is absent', async () => {
        withCandidates([
            {
                id: 'sub-noname',
                customerId: 'cust-noname',
                planId: 'plan-1',
                mpSubscriptionId: null
            }
        ]);
        mockGetDb.mockReturnValue(
            makeDbMock([{ id: 'sub-noname', customerId: 'cust-noname', planId: 'plan-1' }]).db
        );
        mockBillingCustomersGet.mockResolvedValueOnce({
            id: 'cust-noname',
            email: 'juanperez@example.com',
            metadata: {}
        });

        await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ recipientName: 'juanperez' })
        );
    });

    it('warns and skips the notification when the customer is not found', async () => {
        withCandidates([
            { id: 'sub-ghost', customerId: 'cust-ghost', planId: 'plan-1', mpSubscriptionId: null }
        ]);
        mockGetDb.mockReturnValue(
            makeDbMock([{ id: 'sub-ghost', customerId: 'cust-ghost', planId: 'plan-1' }]).db
        );
        mockBillingCustomersGet.mockResolvedValueOnce(null);

        const ctx = makeCronCtx(false);
        const result = await abandonedPendingSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(ctx.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Customer not found'),
            expect.objectContaining({ subscriptionId: 'sub-ghost' })
        );
    });

    // HOS-123 T-020 (preserved through the HOS-151 Bug B rewrite): an abandoned
    // annual-reactivation pending row is reaped exactly like any other pending
    // row. The cron cancels only the candidate's OWN preapproval and abandons
    // only the candidate's OWN row — it never references, cancels, or completes
    // the supersession of the OLD (superseded) subscription. Structurally the job
    // does not even import completeSupersessionPairing; this asserts the id never
    // leaks into any DB / provider / notification call.
    it('reaps an annual-reactivation candidate without ever touching the superseded old subscription', async () => {
        const newPendingId = 'sub-annual-pending-reactivation';
        const supersededOldId = 'sub-old-superseded-by-abandoned-reactivation';
        withCandidates([
            {
                id: newPendingId,
                customerId: 'cust-annual',
                planId: 'plan-annual',
                mpSubscriptionId: 'mp-annual-pre'
            }
        ]);
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        mockGetDb.mockReturnValue(
            makeDbMock([{ id: newPendingId, customerId: 'cust-annual', planId: 'plan-annual' }]).db
        );
        mockBillingCustomersGet.mockResolvedValue({
            id: 'cust-annual',
            email: 'annual@example.com',
            metadata: { name: 'Annual Reactivator' }
        });
        mockBillingPlansGet.mockResolvedValue({ id: 'plan-annual', name: 'Owner Pro (annual)' });

        const result = await abandonedPendingSubsJob.handler(makeCronCtx(false));

        expect(result.processed).toBe(1);
        expect(mockAdapterCancel).toHaveBeenCalledWith('mp-annual-pre', false);
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-annual-pre');
        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ idempotencyKey: `abandoned-sub-${newPendingId}` })
        );

        // The superseded old id never appears anywhere in this run.
        const allCalls = JSON.stringify([
            ...mockAdapterCancel.mock.calls,
            ...mockBillingSubscriptionsCancel.mock.calls,
            ...mockAdapterRetrieve.mock.calls,
            ...mockBillingCustomersGet.mock.calls,
            ...mockSendNotification.mock.calls
        ]);
        expect(allCalls).not.toContain(supersededOldId);
    });
});
