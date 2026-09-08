/**
 * Unit tests for the addon-subscription-reconcile cron job (HOS-847 PR 7c).
 *
 * Covers:
 * - Constants: the advisory lock key does not collide with a sibling billing
 *   cron, and the reap TTL is the checkout REUSE window (3h), not the 30-minute
 *   window the checkout advertises. Both are asserted against the real
 *   constants they mirror, so the re-declaration in the job cannot drift.
 * - `reapAbandonedPendingPurchase`: a purchase is closed only after MercadoPago
 *   CONFIRMS the preapproval is terminal; an unconfirmed cancel, an unreadable
 *   preapproval and a preapproval with no local subscription row all leave the
 *   row `'pending'`; a purchase that never got a preapproval is closed without
 *   touching the provider.
 * - `reportStaleRevocations`: silent on a clean sweep, Sentry + a capturing
 *   `logger.error` when `addon-expiry` has left soft-cancelled add-ons live.
 * - Handler orchestration: advisory-lock skip, dry-run (alarm still fires, no
 *   provider calls), billing-unavailable skip, and the counter split that keeps
 *   a permanently-stuck orphan out of `errors`.
 *
 * @module test/cron/addon-subscription-reconcile
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _internals,
    addonSubscriptionReconcileJob
} from '../../src/cron/jobs/addon-subscription-reconcile.job';

// ─── Hoisted mocks (must precede the vi.mock calls) ───────────────────────────

const {
    mockBillingSubscriptionsCancel,
    mockAdapterRetrieve,
    mockCreateMercadoPagoAdapter,
    mockSentryCapture,
    mockGetDb,
    mockGetQZPayBilling
} = vi.hoisted(() => ({
    mockBillingSubscriptionsCancel: vi.fn().mockResolvedValue(undefined),
    mockAdapterRetrieve: vi.fn(),
    mockCreateMercadoPagoAdapter: vi.fn(),
    mockSentryCapture: vi.fn(),
    mockGetDb: vi.fn(),
    mockGetQZPayBilling: vi.fn()
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────
// The global `test/setup.ts` mock of `@repo/db` does not carry schema tables, so
// the two this job touches are named explicitly.
//
// `and`/`eq`/`isNull`/`lt` are ALSO stood in for. Real Drizzle returns opaque
// `SQL` objects whose only readable form is a rendered query, so a test that
// captured them could assert nothing about WHICH rows this cron touches — and
// the two population predicates are the entire point of the job. These
// stand-ins keep the call tree readable, exactly as
// `finalize-cancelled-subs.test.ts` does for the same reason.

const mockTx = {
    execute: vi.fn(),
    select: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        and: (...parts: unknown[]) => ({ _and: parts }),
        eq: (column: unknown, value: unknown) => ({ _eq: [column, value] }),
        lt: (column: unknown, value: unknown) => ({ _lt: [column, value] }),
        isNull: (column: unknown) => ({ _isNull: column }),
        billingSubscriptions: {
            id: 'SUB_ID',
            mpSubscriptionId: 'SUB_MP_SUBSCRIPTION_ID',
            productDomain: 'SUB_PRODUCT_DOMAIN',
            deletedAt: 'SUB_DELETED_AT'
        },
        billingAddonPurchases: {
            id: 'AP_ID',
            customerId: 'AP_CUSTOMER_ID',
            addonSlug: 'AP_ADDON_SLUG',
            status: 'AP_STATUS',
            mpSubscriptionId: 'AP_MP_SUBSCRIPTION_ID',
            createdAt: 'AP_CREATED_AT',
            canceledAt: 'AP_CANCELED_AT',
            updatedAt: 'AP_UPDATED_AT',
            deletedAt: 'AP_DELETED_AT',
            cancelAtPeriodEnd: 'AP_CANCEL_AT_PERIOD_END',
            currentPeriodEnd: 'AP_CURRENT_PERIOD_END'
        },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        }),
        getDb: mockGetDb,
        withTransaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx))
    };
});

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: mockCreateMercadoPagoAdapter
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Only the status set is used from this module — mock it so the test does not
// pull in Sentry/db/services transitively.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLogger() {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeCronCtx(dryRun = false) {
    return { logger: makeLogger(), startedAt: new Date(), dryRun };
}

/**
 * Builds a db mock exposing BOTH chains the reaper uses:
 * `select().from().where().limit()` (own-subscription lookup) and
 * `update().set().where().returning()` (the closing write).
 */
function makeDbMock(params: {
    readonly ownSubscriptionRows: unknown[];
    readonly returningRows: unknown[];
}) {
    const limit = vi.fn().mockResolvedValue(params.ownSubscriptionRows);
    const selectWhere = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from });

    const returning = vi.fn().mockResolvedValue(params.returningRows);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set });

    return {
        db: { select, update },
        select,
        selectWhere,
        update,
        set,
        updateWhere,
        returning,
        limit
    };
}

const CANDIDATE = {
    id: 'purchase-1',
    customerId: 'cust-1',
    addonSlug: 'extra-listing',
    mpSubscriptionId: 'mp-1'
} as const;

const BILLING = { subscriptions: { cancel: mockBillingSubscriptionsCancel } };
const ADAPTER = { subscriptions: { retrieve: mockAdapterRetrieve } };

function callReap(overrides: {
    readonly candidate?: typeof CANDIDATE | { readonly [K in keyof typeof CANDIDATE]: unknown };
    readonly db: ReturnType<typeof makeDbMock>;
    readonly logger: ReturnType<typeof makeLogger>;
}) {
    return _internals.reapAbandonedPendingPurchase({
        candidate: (overrides.candidate ?? CANDIDATE) as never,
        billing: BILLING as never,
        paymentAdapter: ADAPTER as never,
        db: overrides.db.db as never,
        logger: overrides.logger
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    capturedPhaseOneWheres.length = 0;
    // `clearAllMocks` clears recorded calls but NOT a `mockReturnValueOnce`
    // queue, so an unconsumed one-shot from a previous test would silently
    // answer the next test's first query. Reset the queued mocks outright.
    mockTx.execute.mockReset();
    mockTx.select.mockReset();
    mockAdapterRetrieve.mockReset();
    mockBillingSubscriptionsCancel.mockReset();
    mockBillingSubscriptionsCancel.mockResolvedValue(undefined);
    mockCreateMercadoPagoAdapter.mockReturnValue(ADAPTER);
    mockGetQZPayBilling.mockReturnValue(BILLING);
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('addon-subscription-reconcile constants', () => {
    it('reserves advisory lock key 1009, free of every sibling billing cron', () => {
        // 1001 webhook-retry, 1002 notification-schedule, 1003 dunning,
        // 1004 trial, 1006 abandoned-pending-subs, 1007 subscription-poll,
        // 1008 exchange-rate-fetch, 43001 addon-expiry. 1005 is free but
        // RETIRED (HOS-121) and deliberately not reused.
        const taken = new Set([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 43001]);
        expect(_internals.ADVISORY_LOCK_KEY).toBe(1009);
        expect(taken.has(_internals.ADVISORY_LOCK_KEY)).toBe(false);
    });

    it('reaps at the checkout REUSE window, never at the advertised 30 minutes', async () => {
        const { RECURRING_ADDON_REUSE_WINDOW_MS } = await import(
            '../../src/services/addon.checkout.recurring-idempotency'
        );
        const { RECURRING_ADDON_CHECKOUT_TTL_MS } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );

        // Equality is the whole point: reaping before the reuse window closes
        // would cancel a preapproval `decideRecurringAddonReuse` would still
        // hand back to a buyer who is mid-3DS.
        expect(_internals.ABANDONED_PENDING_TTL_MS).toBe(RECURRING_ADDON_REUSE_WINDOW_MS);
        expect(_internals.ABANDONED_PENDING_TTL_MS).not.toBe(RECURRING_ADDON_CHECKOUT_TTL_MS);
    });

    it('mirrors the add-on purchase statuses it reads and writes', async () => {
        const { RECURRING_ADDON_PENDING_STATUS, RECURRING_ADDON_CANCELED_STATUS } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        expect(_internals.PENDING_STATUS).toBe(RECURRING_ADDON_PENDING_STATUS);
        expect(_internals.CANCELED_STATUS).toBe(RECURRING_ADDON_CANCELED_STATUS);
        expect(_internals.ACTIVE_STATUS).toBe('active');
    });

    it('gives addon-expiry two full daily runs before calling a stale row drift', () => {
        expect(_internals.STALE_REVOCATION_GRACE_MS).toBe(48 * 60 * 60 * 1000);
        expect(_internals.STALE_REVOCATION_GRACE_MS).toBeGreaterThan(24 * 60 * 60 * 1000);
    });
});

describe('addon-subscription-reconcile job definition', () => {
    it('is registered under a stable name, enabled, on its own 6-hourly slot', () => {
        expect(addonSubscriptionReconcileJob.name).toBe('addon-subscription-reconcile');
        expect(addonSubscriptionReconcileJob.enabled).toBe(true);
        expect(addonSubscriptionReconcileJob.schedule).toBe('45 */6 * * *');
        // Does not land on the minute of the other 6-hourly billing sweeps
        // (`0 */6` featured-by-entitlement, `30 */6` entity-subscription-cache).
        expect(['0 */6 * * *', '30 */6 * * *']).not.toContain(
            addonSubscriptionReconcileJob.schedule
        );
    });
});

// ─── reapAbandonedPendingPurchase ─────────────────────────────────────────────

describe('reapAbandonedPendingPurchase', () => {
    it('closes the purchase once MercadoPago confirms the preapproval is terminal', async () => {
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: CANDIDATE.id }]
        });
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: true });
        // Cancels by the LOCAL subscription id, never by the MercadoPago id:
        // qzpay's cancel takes the local row, and the add-on's local row is
        // reachable only through `mp_subscription_id`.
        expect(mockBillingSubscriptionsCancel).toHaveBeenCalledWith('addon-sub-1');
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-1');
        expect(db.set).toHaveBeenCalledWith(
            expect.objectContaining({ status: _internals.CANCELED_STATUS })
        );
        expect(db.set.mock.calls[0]?.[0]).toHaveProperty('canceledAt');
        expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('leaves the purchase pending when the provider still reports the preapproval live', async () => {
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: CANDIDATE.id }]
        });
        mockAdapterRetrieve.mockResolvedValue({ status: 'authorized' });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: false, reason: 'cancel-unverified' });
        expect(db.update).not.toHaveBeenCalled();
        expect(mockSentryCapture).toHaveBeenCalledTimes(1);
        // `{ capture: true }` is not implicit — without it the error never
        // reaches Sentry through the logger.
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('cancel not confirmed'),
            expect.anything(),
            { capture: true }
        );
    });

    it('leaves the purchase pending when the preapproval cannot be read back', async () => {
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: CANDIDATE.id }]
        });
        mockAdapterRetrieve.mockRejectedValue(new Error('MP 503'));
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: false, reason: 'cancel-unverified' });
        expect(db.update).not.toHaveBeenCalled();
    });

    it('still verifies after a cancel call that threw, instead of giving up', async () => {
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: CANDIDATE.id }]
        });
        mockBillingSubscriptionsCancel.mockRejectedValue(new Error('already cancelled'));
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: true });
        expect(mockAdapterRetrieve).toHaveBeenCalledWith('mp-1');
    });

    it('refuses to close a purchase whose preapproval has no local subscription row', async () => {
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [{ id: CANDIDATE.id }] });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: false, reason: 'orphan-preapproval' });
        // Nothing may be cancelled (qzpay cancels by local id) and nothing may
        // be closed — a terminal local row over a possibly-live preapproval is
        // the HOS-751 failure mode.
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
        expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('closes a purchase that never got a preapproval without touching MercadoPago', async () => {
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [{ id: CANDIDATE.id }] });
        const logger = makeLogger();

        const outcome = await callReap({
            candidate: { ...CANDIDATE, mpSubscriptionId: null },
            db,
            logger
        });

        expect(outcome).toEqual({ reaped: true });
        expect(db.select).not.toHaveBeenCalled();
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockAdapterRetrieve).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("resolves the preapproval only among the add-on's OWN subscriptions", async () => {
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: CANDIDATE.id }]
        });
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });

        await callReap({ db, logger: makeLogger() });

        const terms = andTerms(db.selectWhere.mock.calls[0]?.[0]);
        expect(terms).toContainEqual({
            _eq: ['SUB_MP_SUBSCRIPTION_ID', CANDIDATE.mpSubscriptionId]
        });
        // Without the domain filter, a purchase row whose `mp_subscription_id`
        // was (by bug or manual repair) set to the customer's PLAN preapproval
        // resolves to the plan subscription — and this cron cancels the
        // subscription the customer is paying for.
        expect(terms).toContainEqual({ _eq: ['SUB_PRODUCT_DOMAIN', 'addon'] });
        expect(terms).toContainEqual({ _isNull: 'SUB_DELETED_AT' });
    });

    it('refuses to cancel a preapproval that belongs to a non-add-on subscription', async () => {
        // The lookup filters by domain, so a plan subscription is simply not
        // found: the row lands in `orphan-preapproval` — Sentry, zero writes,
        // and nothing cancelled at MercadoPago.
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [{ id: CANDIDATE.id }] });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: false, reason: 'orphan-preapproval' });
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });

    it('closes by id AND re-asserts pending, so a returning buyer is never overwritten', async () => {
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [{ id: CANDIDATE.id }] });
        const logger = makeLogger();

        await callReap({ candidate: { ...CANDIDATE, mpSubscriptionId: null }, db, logger });

        const terms = andTerms(db.updateWhere.mock.calls[0]?.[0]);
        expect(terms).toContainEqual({ _eq: ['AP_ID', CANDIDATE.id] });
        // The status re-assertion is the ONLY thing making this write
        // idempotent against `supersedePendingPurchase`: without it the cron
        // would cancel a purchase the buyer just activated.
        expect(terms).toContainEqual({ _eq: ['AP_STATUS', _internals.PENDING_STATUS] });
        expect(terms).toContainEqual({ _isNull: 'AP_DELETED_AT' });
    });

    it('reports already-closed when a returning buyer superseded the row mid-sweep', async () => {
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [] });
        const logger = makeLogger();

        const outcome = await callReap({
            candidate: { ...CANDIDATE, mpSubscriptionId: null },
            db,
            logger
        });

        expect(outcome).toEqual({ reaped: false, reason: 'already-closed' });
        // Nothing was cancelled at MercadoPago, so nothing was lost: no alarm.
        expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('pages a human when the row stopped being pending AFTER the preapproval was killed', async () => {
        // The buyer authorized between phase 1's SELECT and this cancel, so the
        // purchase is now `'active'` over a dead preapproval — never charged,
        // and reachable by no sweep (`findExpiredAddons` needs an `expires_at`
        // or `cancel_at_period_end`, and a recurring add-on has neither). A
        // silent `already-closed` here is a benefit given away for free.
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: []
        });
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const logger = makeLogger();

        const outcome = await callReap({ db, logger });

        expect(outcome).toEqual({ reaped: false, reason: 'closed-after-provider-cancel' });
        expect(mockBillingSubscriptionsCancel).toHaveBeenCalledWith('addon-sub-1');
        expect(mockSentryCapture).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('activated mid-sweep'),
            expect.objectContaining({ purchaseId: CANDIDATE.id }),
            { capture: true }
        );
    });
});

// ─── reportStaleRevocations ───────────────────────────────────────────────────

describe('reportStaleRevocations', () => {
    it('says nothing when addon-expiry is keeping up', () => {
        const logger = makeLogger();
        _internals.reportStaleRevocations({ staleRevocations: [], logger });

        expect(mockSentryCapture).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('captures to Sentry when soft-cancelled add-ons outlived their paid period', () => {
        const logger = makeLogger();
        _internals.reportStaleRevocations({
            staleRevocations: [
                {
                    id: 'purchase-9',
                    customerId: 'cust-9',
                    addonSlug: 'extra-listing',
                    currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z')
                }
            ],
            logger
        });

        expect(mockSentryCapture).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.anything(), {
            capture: true
        });
        const [[loggedMessage, loggedData]] = logger.error.mock.calls as unknown as [
            [string, { count: number; purchaseIds: string[] }]
        ];
        expect(loggedMessage).toContain('addon-expiry');
        expect(loggedData.count).toBe(1);
        expect(loggedData.purchaseIds).toEqual(['purchase-9']);
    });
});

// ─── Handler orchestration ────────────────────────────────────────────────────

/**
 * Every predicate phase 1 handed to `where()`, in call order: index 0 is the
 * reap population, index 1 the stale-revocation population. Captured rather
 * than discarded — a `where()` that drops its argument would let both
 * predicates be rewritten without a single test turning red.
 */
const capturedPhaseOneWheres: unknown[] = [];

/** Wires `mockTx` so phase 1 returns the two given populations. */
function primeTransaction(params: {
    readonly acquired: boolean;
    readonly candidates?: unknown[];
    readonly staleRevocations?: unknown[];
}) {
    mockTx.execute.mockResolvedValue({ rows: [{ acquired: params.acquired }] });
    mockTx.select
        .mockReturnValueOnce({
            from: () => ({
                where: (predicate: unknown) => {
                    capturedPhaseOneWheres.push(predicate);
                    return Promise.resolve(params.candidates ?? []);
                }
            })
        })
        .mockReturnValueOnce({
            from: () => ({
                where: (predicate: unknown) => {
                    capturedPhaseOneWheres.push(predicate);
                    return Promise.resolve(params.staleRevocations ?? []);
                }
            })
        });
}

/** The `and(...)` members of a captured predicate. */
function andTerms(predicate: unknown): unknown[] {
    const composite = predicate as { _and?: unknown[] };
    expect(
        Array.isArray(composite?._and),
        'the query lost its compound WHERE — a bare predicate here means a filter was dropped'
    ).toBe(true);
    return composite._and as unknown[];
}

/** The single `_lt` bound in a captured predicate, as a millisecond timestamp. */
function ltBoundMs(predicate: unknown, column: string): number {
    const term = andTerms(predicate).find(
        (candidate): candidate is { _lt: [string, Date] } =>
            typeof candidate === 'object' &&
            candidate !== null &&
            '_lt' in candidate &&
            (candidate as { _lt: [string, Date] })._lt[0] === column
    );
    expect(term, `no lt() bound on ${column}`).toBeDefined();
    return (term as { _lt: [string, Date] })._lt[1].getTime();
}

// ─── Phase-1 predicates: WHICH rows this cron touches ─────────────────────────
// These two WHERE clauses are the job's blast radius. Left unasserted, widening
// either one is invisible: swapping `pending` for `active` in the reap query
// turns this cron into a sweep that cancels the preapproval of every customer
// currently PAYING for a recurring add-on, every six hours.

describe('addon-subscription-reconcile phase-1 predicates', () => {
    it('reaps only PENDING purchases — never an active one somebody is paying for', async () => {
        primeTransaction({ acquired: true });

        await addonSubscriptionReconcileJob.handler(makeCronCtx() as never);

        const terms = andTerms(capturedPhaseOneWheres[0]);
        expect(terms).toContainEqual({ _eq: ['AP_STATUS', _internals.PENDING_STATUS] });
        expect(terms).not.toContainEqual({ _eq: ['AP_STATUS', _internals.ACTIVE_STATUS] });
    });

    it('reaps only purchases older than the reuse window, never one mid-authorization', async () => {
        primeTransaction({ acquired: true });

        const before = Date.now();
        await addonSubscriptionReconcileJob.handler(makeCronCtx() as never);
        const after = Date.now();

        // The cutoff is `now - TTL` and must be in the PAST: a flipped sign
        // would select every purchase created in the last three hours, i.e.
        // exactly the buyer typing their 3DS code right now.
        const cutoff = ltBoundMs(capturedPhaseOneWheres[0], 'AP_CREATED_AT');
        expect(cutoff).toBeGreaterThanOrEqual(before - _internals.ABANDONED_PENDING_TTL_MS);
        expect(cutoff).toBeLessThanOrEqual(after - _internals.ABANDONED_PENDING_TTL_MS);
        expect(cutoff).toBeLessThan(before);
    });

    it('excludes soft-deleted purchases from the reap', async () => {
        primeTransaction({ acquired: true });

        await addonSubscriptionReconcileJob.handler(makeCronCtx() as never);

        expect(andTerms(capturedPhaseOneWheres[0])).toContainEqual({ _isNull: 'AP_DELETED_AT' });
    });

    it('alarms only on ACTIVE rows that were soft-cancelled', async () => {
        primeTransaction({ acquired: true });

        await addonSubscriptionReconcileJob.handler(makeCronCtx() as never);

        const terms = andTerms(capturedPhaseOneWheres[1]);
        expect(terms).toContainEqual({ _eq: ['AP_STATUS', _internals.ACTIVE_STATUS] });
        // Without `cancel_at_period_end = true` the alarm would fire on every
        // healthy add-on whose period simply rolled over, drowning the signal
        // it exists to raise.
        expect(terms).toContainEqual({ _eq: ['AP_CANCEL_AT_PERIOD_END', true] });
        expect(terms).not.toContainEqual({ _eq: ['AP_CANCEL_AT_PERIOD_END', false] });
        expect(terms).toContainEqual({ _isNull: 'AP_DELETED_AT' });
    });

    it('gives addon-expiry the full grace before the stale alarm considers a row overdue', async () => {
        primeTransaction({ acquired: true });

        const before = Date.now();
        await addonSubscriptionReconcileJob.handler(makeCronCtx() as never);
        const after = Date.now();

        const cutoff = ltBoundMs(capturedPhaseOneWheres[1], 'AP_CURRENT_PERIOD_END');
        expect(cutoff).toBeGreaterThanOrEqual(before - _internals.STALE_REVOCATION_GRACE_MS);
        expect(cutoff).toBeLessThanOrEqual(after - _internals.STALE_REVOCATION_GRACE_MS);
        expect(cutoff).toBeLessThan(before);
    });
});

describe('addon-subscription-reconcile handler', () => {
    it('skips without querying when another replica holds the advisory lock', async () => {
        primeTransaction({ acquired: false });
        const ctx = makeCronCtx();

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.success).toBe(true);
        expect(result.message).toContain('another replica');
        expect(result.processed).toBe(0);
        expect(mockGetQZPayBilling).not.toHaveBeenCalled();
    });

    it('still raises the stale-revocation alarm in dry run, without calling MercadoPago', async () => {
        primeTransaction({
            acquired: true,
            candidates: [CANDIDATE],
            staleRevocations: [
                {
                    id: 'purchase-9',
                    customerId: 'cust-9',
                    addonSlug: 'extra-listing',
                    currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z')
                }
            ]
        });
        const ctx = makeCronCtx(true);

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.processed).toBe(1);
        expect(result.details?.staleRevocationsDetected).toBe(1);
        expect(mockSentryCapture).toHaveBeenCalledTimes(1);
        expect(mockBillingSubscriptionsCancel).not.toHaveBeenCalled();
        expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
    });

    it('leaves candidates pending when billing is not configured', async () => {
        primeTransaction({ acquired: true, candidates: [CANDIDATE] });
        mockGetQZPayBilling.mockReturnValue(undefined);
        const ctx = makeCronCtx();

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.message).toContain('billing not configured');
        expect(result.processed).toBe(0);
        expect(result.details?.pending).toBe(1);
    });

    it('counts a confirmed close as processed and an unconfirmed cancel as an error', async () => {
        primeTransaction({
            acquired: true,
            candidates: [CANDIDATE, { ...CANDIDATE, id: 'purchase-2', mpSubscriptionId: 'mp-2' }]
        });
        const db = makeDbMock({
            ownSubscriptionRows: [{ id: 'addon-sub-1' }],
            returningRows: [{ id: 'purchase-1' }]
        });
        mockGetDb.mockReturnValue(db.db);
        mockAdapterRetrieve
            .mockResolvedValueOnce({ status: 'cancelled' })
            .mockResolvedValueOnce({ status: 'authorized' });
        const ctx = makeCronCtx();

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.processed).toBe(1);
        expect(result.errors).toBe(1);
        expect(result.details?.cancelUnverified).toBe(1);
        expect(result.message).toContain('Closed 1 abandoned add-on checkout');
    });

    it('counts a mid-sweep activation separately from a benign already-closed row', async () => {
        primeTransaction({ acquired: true, candidates: [CANDIDATE] });
        const db = makeDbMock({ ownSubscriptionRows: [{ id: 'addon-sub-1' }], returningRows: [] });
        mockGetDb.mockReturnValue(db.db);
        mockAdapterRetrieve.mockResolvedValue({ status: 'cancelled' });
        const ctx = makeCronCtx();

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.details?.closedAfterProviderCancel).toBe(1);
        expect(result.details?.alreadyClosed).toBe(0);
        // Not transient: the next run does not re-select the row, so folding it
        // into `errors` would be a one-shot red that no retry can clear.
        expect(result.errors).toBe(0);
        expect(result.message).toContain('manual reconciliation');
    });

    it('keeps a permanently-stuck orphan out of `errors` so a real failure stays visible', async () => {
        primeTransaction({ acquired: true, candidates: [CANDIDATE] });
        const db = makeDbMock({ ownSubscriptionRows: [], returningRows: [] });
        mockGetDb.mockReturnValue(db.db);
        const ctx = makeCronCtx();

        const result = await addonSubscriptionReconcileJob.handler(ctx as never);

        expect(result.details?.orphanPreapproval).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.message).toContain('manual reconciliation');
    });
});
