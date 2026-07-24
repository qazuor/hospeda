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
 * - Handler orchestration: advisory-lock skip, transition-guard skip, dry-run
 *   count, billing-unavailable skip, and best-effort user notifications.
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
    mockAdapterRetrieve,
    mockCreateMercadoPagoAdapter,
    mockSentryCapture,
    mockGetDb,
    mockFindByLocalSubscriptionId,
    mockFindReconcileAssistedByLocalSubscriptionId
} = vi.hoisted(() => ({
    mockBillingCustomersGet: vi.fn(),
    mockBillingPlansGet: vi.fn(),
    mockBillingSubscriptionsCancel: vi.fn().mockResolvedValue(undefined),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    mockAdapterRetrieve: vi.fn(),
    mockCreateMercadoPagoAdapter: vi.fn(),
    mockSentryCapture: vi.fn(),
    mockGetDb: vi.fn(),
    mockFindByLocalSubscriptionId: vi.fn(),
    mockFindReconcileAssistedByLocalSubscriptionId: vi.fn()
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
            findReconcileAssistedByLocalSubscriptionId:
                mockFindReconcileAssistedByLocalSubscriptionId
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

vi.mock('@repo/billing', () => ({
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
    const billing = {
        subscriptions: { cancel: mockBillingSubscriptionsCancel }
    };
    const paymentAdapter = {
        subscriptions: { retrieve: mockAdapterRetrieve }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockBillingSubscriptionsCancel.mockResolvedValue(undefined);
        // HOS-276: no reconcile_assisted correlation row by default — tests that
        // exercise it override this explicitly.
        mockFindReconcileAssistedByLocalSubscriptionId.mockResolvedValue(null);
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
            billing: billing as any,
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: true, info: ABANDONED_ROW });
        // No preapproval → never cancels or verifies against MP.
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
            billing: billing as any,
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome.abandoned).toBe(true);
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
            billing: billing as any,
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'checkout-in-progress' });
        // Row is left pending — no abandon write, no MP calls.
        expect(update).not.toHaveBeenCalled();
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
            billing: billing as any,
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
            billing: billing as any,
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
        mockFindReconcileAssistedByLocalSubscriptionId.mockResolvedValue({
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
            billing: billing as any,
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(outcome).toEqual({ abandoned: false, reason: 'reconcile-assisted-manual' });
        expect(update).not.toHaveBeenCalled();
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
            billing: billing as any,
            paymentAdapter: paymentAdapter as any,
            db: db as any,
            logger: makeLogger()
        });

        expect(mockBillingSubscriptionsCancel).toHaveBeenCalledWith('sub-1');
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
            billing: billing as any,
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
        mockBillingSubscriptionsCancel.mockRejectedValueOnce(new Error('MP 500'));
        mockAdapterRetrieve.mockResolvedValue({ status: 'canceled' });
        const { db, update } = makeDbMock([ABANDONED_ROW]);

        const outcome = await _internals.reapPendingCandidate({
            candidate: {
                id: 'sub-1',
                customerId: 'cust-1',
                planId: 'plan-1',
                mpSubscriptionId: 'mp-pre-123'
            },
            billing: billing as any,
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
            billing: billing as any,
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
            billing: billing as any,
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
            billing: billing as any,
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
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
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
            subscriptions: { retrieve: mockAdapterRetrieve }
        });
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
        mockFindReconcileAssistedByLocalSubscriptionId.mockResolvedValue(null);
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
        expect(mockBillingSubscriptionsCancel).toHaveBeenCalledWith('sub-mp');
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
        mockFindReconcileAssistedByLocalSubscriptionId.mockResolvedValue({
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
        expect(mockBillingSubscriptionsCancel).toHaveBeenCalledWith(newPendingId);
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-annual-pre');
        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ idempotencyKey: `abandoned-sub-${newPendingId}` })
        );

        // The superseded old id never appears anywhere in this run.
        const allCalls = JSON.stringify([
            ...mockBillingSubscriptionsCancel.mock.calls,
            ...mockAdapterRetrieve.mock.calls,
            ...mockBillingCustomersGet.mock.calls,
            ...mockSendNotification.mock.calls
        ]);
        expect(allCalls).not.toContain(supersededOldId);
    });
});
