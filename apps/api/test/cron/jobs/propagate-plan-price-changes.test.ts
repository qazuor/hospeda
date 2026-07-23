/**
 * Unit tests for the HOS-176 plan price-change propagation cron internals.
 *
 * Covers the two risk-bearing helpers with mocked collaborators (no live DB / MP):
 *   - `resolveDiscountAwareTargetCentavos` — discount-aware target amount.
 *   - `applyMpAmount` — bounded-retry MP amount mutation.
 *
 * @module test/cron/jobs/propagate-plan-price-changes
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock handles ──────────────────────────────────────────────────
const { mockLoadDiscountState, mockGetPromoCodeById, mockCalculateEffect } = vi.hoisted(() => ({
    mockLoadDiscountState: vi.fn(),
    mockGetPromoCodeById: vi.fn(),
    mockCalculateEffect: vi.fn()
}));

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));
const { mockCaptureException } = vi.hoisted(() => ({ mockCaptureException: vi.fn() }));
// HOS-176 Increment A collaborators (notice phase).
const { mockSendNotification } = vi.hoisted(() => ({ mockSendNotification: vi.fn() }));
// Delivery-aware send (item b fix): the cron gates the ledger insert on `delivered`.
const { mockTrySendNotification } = vi.hoisted(() => ({ mockTrySendNotification: vi.fn() }));
const { mockPlanDisplayName } = vi.hoisted(() => ({ mockPlanDisplayName: vi.fn(() => 'Plan') }));
// Mock env so importing the job never triggers eager env validation (the job reads
// env.HOSPEDA_BILLING_PRICE_INCREASE_ENABLED only in the handler, not at import).
const { mockEnv } = vi.hoisted(() => ({
    mockEnv: { HOSPEDA_BILLING_PRICE_INCREASE_ENABLED: false }
}));

// Structured helpers + identifiable table columns so the applyChange integration
// test can run a stateful fake db that interprets the drizzle query builder. Pure
// helpers / other tests don't inspect these values, so the structure is harmless.
vi.mock('@repo/db', () => {
    const col = (name: string) => ({ __col: name });
    const tbl = (name: string, cols: Record<string, unknown>) => ({ __table: name, ...cols });
    return {
        and: (...conds: unknown[]) => ({ __op: 'and', conds }),
        or: (...conds: unknown[]) => ({ __op: 'or', conds }),
        asc: (c: unknown) => ({ __op: 'asc', col: c }),
        eq: (c: unknown, val: unknown) => ({ __op: 'eq', col: c, val }),
        gt: (c: unknown, val: unknown) => ({ __op: 'gt', col: c, val }),
        inArray: (c: unknown, vals: unknown[]) => ({ __op: 'in', col: c, vals }),
        isNotNull: (c: unknown) => ({ __op: 'notnull', col: c }),
        isNull: (c: unknown) => ({ __op: 'isnull', col: c }),
        lte: (c: unknown, val: unknown) => ({ __op: 'lte', col: c, val }),
        // Capture the FIRST interpolated table object so the fake-db harness can tell a
        // `NOT EXISTS (... FROM <notices>)` (notice-phase pagination) from a
        // `NOT EXISTS (... FROM <targets>)` (decrease apply). Count(*) fragments interpolate
        // no table → `notExistsTable` stays null.
        sql: (_strings: unknown, ...vals: unknown[]) => {
            const tableArg = vals.find(
                (v) => v && typeof v === 'object' && '__table' in (v as Record<string, unknown>)
            ) as { __table?: string } | undefined;
            return { __sql: true, notExistsTable: tableArg?.__table ?? null };
        },
        getDb: mockGetDb,
        billingPlanPriceChanges: tbl('changes', {
            id: col('id'),
            planId: col('planId'),
            billingInterval: col('billingInterval'),
            oldAmount: col('oldAmount'),
            newAmount: col('newAmount'),
            direction: col('direction'),
            status: col('status'),
            noticeSentAt: col('noticeSentAt'),
            effectiveAt: col('effectiveAt'),
            metadata: col('metadata'),
            createdAt: col('createdAt')
        }),
        billingPlanPriceChangeTargets: tbl('targets', {
            id: col('id'),
            priceChangeId: col('priceChangeId'),
            subscriptionId: col('subscriptionId'),
            mpSubscriptionId: col('mpSubscriptionId'),
            targetAmount: col('targetAmount'),
            attemptCount: col('attemptCount'),
            status: col('status')
        }),
        billingPlanPriceChangeNotices: tbl('notices', {
            id: col('id'),
            priceChangeId: col('priceChangeId'),
            subscriptionId: col('subscriptionId'),
            customerId: col('customerId'),
            notifiedAt: col('notifiedAt')
        }),
        billingSubscriptions: tbl('subs', {
            id: col('id'),
            customerId: col('customerId'),
            mpSubscriptionId: col('mpSubscriptionId'),
            planId: col('planId'),
            billingInterval: col('billingInterval'),
            status: col('status'),
            trialEnd: col('trialEnd')
        })
    };
});

vi.mock('@repo/service-core', () => ({
    loadSubscriptionDiscountState: mockLoadDiscountState,
    getPromoCodeById: mockGetPromoCodeById,
    calculatePromoCodeEffect: mockCalculateEffect
}));

vi.mock('../../../src/middlewares/billing.js', () => ({ getQZPayBilling: vi.fn() }));
vi.mock('@sentry/node', () => ({ captureException: mockCaptureException }));
// HOS-176 Increment A: notice-phase collaborators (mocked to keep the cron unit
// test light — the real modules pull in @repo/notifications + env validation).
vi.mock('@repo/notifications', () => ({
    NotificationType: { PLAN_PRICE_CHANGE_NOTICE: 'plan_price_change_notice' }
}));
vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification,
    trySendNotification: mockTrySendNotification
}));
vi.mock('../../../src/services/billing/plan-change-reason.js', () => ({
    planDisplayNameFromPlan: mockPlanDisplayName
}));
vi.mock('../../../src/utils/env.js', () => ({ env: mockEnv }));

import { _internals } from '../../../src/cron/jobs/propagate-plan-price-changes.job.js';

const {
    resolveDiscountAwareTargetCentavos,
    applyMpAmount,
    nextTargetStatusOnFailure,
    nextDeferStatus,
    shouldFinalize,
    ensureTargets,
    applyChange,
    affectedStatusesForDirection,
    classifyTargetAmountGuard,
    findDueChanges,
    runIncreaseNoticePhase,
    MP_MAX_TRANSACTION_AMOUNT_ARS,
    INCREASE_NOTICE_GRACE_MS
} = _internals;

describe('resolveDiscountAwareTargetCentavos', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns { amount } (full new price) when the sub has no discount', async () => {
        mockLoadDiscountState.mockResolvedValue(null);
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ amount: 15000 });
    });

    it('returns { amount } (full price) when the discount is exhausted (remaining <= 0)', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 0
        });
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ amount: 15000 });
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
    });

    it('applies the discount to the NEW price when the discount is active', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: { kind: 'discount' } }
        });
        mockCalculateEffect.mockReturnValue({ type: 'apply-discount', finalAmount: 7500 });

        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ amount: 7500 });
        // The discount is computed on the NEW full price, not a stale value.
        expect(mockCalculateEffect).toHaveBeenCalledWith({ kind: 'discount' }, 15000);
    });

    it('DEFERS (not full price) when loading discount state throws — a throw is not proof of no discount (W2res)', async () => {
        mockLoadDiscountState.mockRejectedValue(new Error('db down'));
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ defer: true });
    });

    it('DEFERS (not full price) for an active promo-holder whose promo lookup throws (W2res)', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockRejectedValue(new Error('promo service down'));
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ defer: true });
    });

    it('DEFERS for an active promo-holder whose promo lookup returns !success (deleted/transient — Part B budget)', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({ success: false });
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ defer: true });
    });

    it('returns { amount } (full price) when the promo lookup succeeds but has no amount effect', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({ success: true, data: {} });
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ amount: 15000 });
        expect(mockCalculateEffect).not.toHaveBeenCalled();
    });

    it('returns { amount } (full price), NOT defer, for a non-apply-discount effect (trial_extension/comp) — kills the C1 wedge', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: { kind: 'trial_extension' } }
        });
        // A non-amount effect does not reduce the recurring charge → full price.
        mockCalculateEffect.mockReturnValue({ type: 'extend-trial', extraDays: 7 });

        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toEqual({ amount: 15000 });
    });
});

describe('nextTargetStatusOnFailure (W1)', () => {
    it('keeps a target pending while under the cumulative budget', () => {
        expect(nextTargetStatusOnFailure({ attemptCount: 0 })).toEqual({
            status: 'pending',
            nextAttempt: 1
        });
        expect(nextTargetStatusOnFailure({ attemptCount: 3 })).toEqual({
            status: 'pending',
            nextAttempt: 4
        });
    });

    it('marks a target failed once the budget is reached', () => {
        // MAX_TARGET_TICK_ATTEMPTS = 5 → the 5th failure (attemptCount 4 → 5) is terminal.
        const r = nextTargetStatusOnFailure({
            attemptCount: _internals.MAX_TARGET_TICK_ATTEMPTS - 1
        });
        expect(r).toEqual({ status: 'failed', nextAttempt: _internals.MAX_TARGET_TICK_ATTEMPTS });
    });
});

describe('shouldFinalize (I1)', () => {
    it('finalizes only when no pending/deferred targets AND no new subs found this tick', () => {
        expect(shouldFinalize({ pendingCount: 0, deferredCount: 0, newSubsFound: 0 })).toBe(true);
    });

    it('does NOT finalize while pending targets remain', () => {
        expect(shouldFinalize({ pendingCount: 3, deferredCount: 0, newSubsFound: 0 })).toBe(false);
    });

    it('does NOT finalize while new (un-targeted) subs were found this tick — overflow batching', () => {
        expect(shouldFinalize({ pendingCount: 0, deferredCount: 0, newSubsFound: 500 })).toBe(
            false
        );
    });
});

describe('nextDeferStatus (C1 / Part B)', () => {
    it('keeps a target deferred while under the cumulative budget', () => {
        expect(nextDeferStatus({ attemptCount: 0 })).toEqual({
            status: 'deferred',
            nextAttempt: 1
        });
        expect(nextDeferStatus({ attemptCount: 3 })).toEqual({
            status: 'deferred',
            nextAttempt: 4
        });
    });

    it('marks a target skipped once the budget is reached (terminal — keeps OLD amount)', () => {
        const r = nextDeferStatus({ attemptCount: _internals.MAX_TARGET_TICK_ATTEMPTS - 1 });
        expect(r).toEqual({
            status: 'skipped',
            nextAttempt: _internals.MAX_TARGET_TICK_ATTEMPTS
        });
    });
});

describe('shouldFinalize deferred-blocking (C1)', () => {
    it('does NOT finalize while deferred targets remain (they are still being retried)', () => {
        expect(shouldFinalize({ pendingCount: 0, deferredCount: 2, newSubsFound: 0 })).toBe(false);
    });

    it('finalizes when no pending, no deferred, and no new subs found', () => {
        expect(shouldFinalize({ pendingCount: 0, deferredCount: 0, newSubsFound: 0 })).toBe(true);
    });
});

describe('ensureTargets deferral (Part B — persist a deferred target, not skip)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('INSERTS a { status: "deferred" } target (placeholder amount) when discount resolution defers', async () => {
        // Active promo-holder whose promo lookup throws → resolver returns { defer: true }.
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockRejectedValue(new Error('promo service down'));

        const valuesSpy = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
        const insertSpy = vi.fn(() => ({ values: valuesSpy }));
        mockGetDb.mockReturnValue({ insert: insertSpy });

        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        await ensureTargets(
            {
                id: 'pc-1',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 15000,
                direction: 'decrease'
            },
            [{ subscriptionId: 'sub-1', mpSubscriptionId: 'mp-1' }],
            logger
        );

        // The row IS persisted (skipping the insert is what wedged the change): a
        // `deferred` target stops findAffectedSubscribers re-enumerating the sub.
        expect(insertSpy).toHaveBeenCalledTimes(1);
        expect(valuesSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                priceChangeId: 'pc-1',
                subscriptionId: 'sub-1',
                status: 'deferred',
                targetAmount: 15000
            })
        );
        expect(logger.info).toHaveBeenCalled();
    });
});

describe('applyMpAmount', () => {
    function makeBilling(updateImpl: () => Promise<void>): QZPayBilling {
        return {
            getPaymentAdapter: () => ({
                subscriptions: { update: vi.fn(updateImpl) }
            })
        } as unknown as QZPayBilling;
    }

    it('returns ok on the first successful update', async () => {
        const billing = makeBilling(async () => undefined);
        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: true });
    });

    it('returns an error when the adapter is unavailable', async () => {
        const billing = { getPaymentAdapter: () => null } as unknown as QZPayBilling;
        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: false, error: 'MP payment adapter unavailable' });
    });

    it('retries then returns the last error when all attempts fail', async () => {
        const update = vi.fn(async () => {
            throw new Error('MP 429');
        });
        const billing = {
            getPaymentAdapter: () => ({ subscriptions: { update } })
        } as unknown as QZPayBilling;

        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: false, error: 'MP 429' });
        expect(update).toHaveBeenCalledTimes(_internals.MP_UPDATE_MAX_ATTEMPTS);
    });
});

// ─── applyChange integration (C1 wedge closure) ────────────────────────────
//
// A stateful fake db (interpreting the structured @repo/db helpers mocked above)
// drives the FULL applyChange tick loop with a mocked MP billing. Proves the wedge
// is closed: a subscriber whose discount-aware amount can NEVER be determined (a
// deleted promo → getPromoCodeById always !success → resolver always defers) becomes
// a terminal `skipped` target after MAX_TARGET_TICK_ATTEMPTS ticks and the change
// header FINALIZES (to `failed`) instead of hanging in `applying` forever.
describe('applyChange — permanent-defer finalization (C1)', () => {
    interface FakeTarget {
        id: string;
        priceChangeId: string;
        subscriptionId: string;
        mpSubscriptionId: string | null;
        targetAmount: number;
        attemptCount: number;
        status: string;
    }
    interface FakeState {
        change: { id: string; status: string };
        targets: FakeTarget[];
        subs: { id: string; mpSubscriptionId: string | null }[];
        seq: number;
    }

    type Where = any;

    function condList(where: Where): Where[] {
        if (!where) return [];
        return where.__op === 'and' ? where.conds : [where];
    }
    function eqVal(where: Where, colName: string): unknown {
        const c = condList(where).find(
            (x: Where) => x && x.__op === 'eq' && x.col && x.col.__col === colName
        );
        return c ? c.val : undefined;
    }
    function statusFilter(where: Where): string[] | null {
        for (const c of condList(where)) {
            if (c.col?.__col !== 'status') continue;
            if (c.__op === 'eq') return [c.val];
            if (c.__op === 'in') return c.vals;
        }
        return null;
    }

    function runSelect(state: FakeState, q: Where): unknown[] {
        const table = q.table?.__table;
        if (table === 'subs') {
            // findAffectedSubscribers: NOT EXISTS a target row for the sub.
            return state.subs
                .filter((s) => !state.targets.some((t) => t.subscriptionId === s.id))
                .map((s) => ({ subscriptionId: s.id, mpSubscriptionId: s.mpSubscriptionId }));
        }
        if (table === 'targets') {
            const pcId = eqVal(q.where, 'priceChangeId');
            const rows = state.targets.filter((t) => t.priceChangeId === pcId);
            if (Object.hasOwn(q.projection, 'n')) {
                const statuses = statusFilter(q.where);
                const n = rows.filter((t) => !statuses || statuses.includes(t.status)).length;
                return [{ n }];
            }
            const statuses = statusFilter(q.where);
            return rows
                .filter((t) => !statuses || statuses.includes(t.status))
                .map((t) => ({ ...t }));
        }
        return [];
    }

    function makeFakeDb(state: FakeState) {
        // The chainable query object is a REAL Promise (not an object literal with a
        // `then` — biome's noThenProperty). It resolves lazily on a microtask, AFTER
        // the synchronous `.from().where().limit()` chain has fully populated `q`.
        const select = (projection: Where) => {
            const q: Where = { projection, table: null, where: null };
            let resolveChain: (rows: unknown[]) => void = () => undefined;
            const p: Where = new Promise((resolve) => {
                resolveChain = resolve;
            });
            queueMicrotask(() => resolveChain(runSelect(state, q)));
            p.from = (t: Where) => {
                q.table = t;
                return p;
            };
            p.where = (c: Where) => {
                q.where = c;
                return p;
            };
            p.orderBy = () => p;
            p.limit = () => p;
            return p;
        };
        const update = (table: Where) => ({
            set: (values: Where) => ({
                where: (cond: Where) => {
                    if (table.__table === 'changes') {
                        if (eqVal(cond, 'id') === state.change.id) {
                            state.change.status = values.status ?? state.change.status;
                        }
                    } else if (table.__table === 'targets') {
                        const id = eqVal(cond, 'id');
                        const t = state.targets.find((x) => x.id === id);
                        if (t) Object.assign(t, values);
                    }
                    return Promise.resolve();
                }
            })
        });
        const insert = (_table: Where) => ({
            values: (v: Where) => ({
                onConflictDoNothing: () => {
                    const exists = state.targets.some(
                        (t) =>
                            t.priceChangeId === v.priceChangeId &&
                            t.subscriptionId === v.subscriptionId
                    );
                    if (!exists) {
                        state.seq += 1;
                        state.targets.push({
                            id: `t-${state.seq}`,
                            attemptCount: 0,
                            ...v
                        });
                    }
                    return Promise.resolve();
                }
            })
        });
        return { select, update, insert };
    }

    const change = {
        id: 'pc-1',
        planId: 'plan-1',
        billingInterval: 'month',
        newAmount: 15000,
        direction: 'decrease'
    };

    it('marks a permanently-undeterminable sub `skipped` and finalizes the header to `failed`', async () => {
        vi.clearAllMocks();
        // Active promo whose lookup ALWAYS returns !success (deleted promo) → resolver
        // defers every tick, forever.
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({ success: false });

        const state: FakeState = {
            change: { id: 'pc-1', status: 'pending' },
            targets: [],
            subs: [{ id: 'sub-1', mpSubscriptionId: 'mp-1' }],
            seq: 0
        };
        mockGetDb.mockReturnValue(makeFakeDb(state));

        const billing = {
            getPaymentAdapter: () => ({ subscriptions: { update: vi.fn(async () => undefined) } })
        } as unknown as QZPayBilling;
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        // Drive ticks until the change finalizes, with a hard cap that is itself the
        // regression assertion: if the wedge reopened, `done` would never be true and
        // this loop would hit the cap (test fails) instead of finalizing.
        const CAP = _internals.MAX_TARGET_TICK_ATTEMPTS + 5;
        let ticks = 0;
        let finalized = false;
        while (ticks < CAP) {
            ticks += 1;
            const outcome = await applyChange(change, billing, logger);
            if (outcome.done) {
                finalized = true;
                break;
            }
        }

        expect(finalized).toBe(true);
        expect(ticks).toBeLessThanOrEqual(_internals.MAX_TARGET_TICK_ATTEMPTS + 1);
        expect(state.change.status).toBe('failed');
        expect(state.targets).toHaveLength(1);
        expect(state.targets[0]?.status).toBe('skipped');
        expect(state.targets[0]?.attemptCount).toBe(_internals.MAX_TARGET_TICK_ATTEMPTS);
        // The give-up was surfaced to ops.
        expect(mockCaptureException).toHaveBeenCalled();
    });
});

// ─── HOS-176 Increment A (increase path) ────────────────────────────────────
//
// Pure helpers plus a generic stateful fake-db harness (interpreting the
// structured @repo/db helpers via a small predicate evaluator) that drives
// findDueChanges / runIncreaseNoticePhase / applyChange end-to-end.

describe('affectedStatusesForDirection (D-4 trialing grandfather)', () => {
    it('EXCLUDES trialing for an increase (grandfathered — keep OLD price through trial)', () => {
        expect(affectedStatusesForDirection('increase')).toEqual(['active', 'past_due']);
    });

    it('INCLUDES trialing for a decrease (lowering a trialing sub is harmless)', () => {
        expect(affectedStatusesForDirection('decrease')).toEqual([
            'active',
            'trialing',
            'past_due'
        ]);
    });
});

describe('classifyTargetAmountGuard (MP absolute limits, D-1 smoke)', () => {
    it('rejects amounts ≤ 0', () => {
        expect(classifyTargetAmountGuard({ targetAmountCentavos: 0 })).toEqual({
            ok: false,
            reason: 'non_positive'
        });
        expect(classifyTargetAmountGuard({ targetAmountCentavos: -5 })).toEqual({
            ok: false,
            reason: 'non_positive'
        });
    });

    it('accepts exactly the $2,000,000 ARS cap (MP rejects only STRICTLY above)', () => {
        expect(
            classifyTargetAmountGuard({
                targetAmountCentavos: MP_MAX_TRANSACTION_AMOUNT_ARS * 100
            })
        ).toEqual({ ok: true });
    });

    it('rejects one centavo above the cap', () => {
        expect(
            classifyTargetAmountGuard({
                targetAmountCentavos: MP_MAX_TRANSACTION_AMOUNT_ARS * 100 + 1
            })
        ).toEqual({ ok: false, reason: 'exceeds_mp_max' });
    });

    it('accepts a normal amount', () => {
        expect(classifyTargetAmountGuard({ targetAmountCentavos: 150000 })).toEqual({ ok: true });
    });

    it('MP_MAX_TRANSACTION_AMOUNT_ARS is 2,000,000 ARS major', () => {
        expect(MP_MAX_TRANSACTION_AMOUNT_ARS).toBe(2_000_000);
    });
});

// ─── Generic stateful fake db (shared by the integration tests below) ───────
// `W` is a test-only structural alias for the drizzle query fragments the @repo/db
// mock emits; a precise type would just re-encode the mock's ad-hoc shape.
type W = any;
interface GState {
    changes: W[];
    targets: W[];
    subs: W[];
    /** Notice-ledger rows (HOS-176 item b). Optional: lazily initialised to [] by buildDb. */
    notices?: W[];
    seq: number;
}

function gCondList(where: W): W[] {
    if (!where) return [];
    return where.__op === 'and' || where.__op === 'or' ? where.conds : [where];
}
function gEqVal(where: W, colName: string): unknown {
    const c = gCondList(where).find(
        (x: W) => x && x.__op === 'eq' && x.col && x.col.__col === colName
    );
    return c ? c.val : undefined;
}
function gMatch(where: W, row: W): boolean {
    if (!where) return true;
    switch (where.__op) {
        case 'and':
            return where.conds.every((c: W) => gMatch(c, row));
        case 'or':
            return where.conds.some((c: W) => gMatch(c, row));
        case 'eq':
            return row[where.col.__col] === where.val;
        case 'gt':
            return row[where.col.__col] > where.val;
        case 'in':
            return where.vals.includes(row[where.col.__col]);
        case 'notnull':
            return row[where.col.__col] != null;
        case 'isnull':
            return row[where.col.__col] == null;
        case 'lte':
            return row[where.col.__col] <= where.val;
        default:
            return true; // sql fragments (NOT EXISTS / count) handled by the caller
    }
}
function gProject(row: W, projection: W): W {
    const out: W = {};
    for (const [alias, colDef] of Object.entries(projection)) {
        out[alias] = colDef && (colDef as W).__col ? row[(colDef as W).__col] : row[alias];
    }
    return out;
}
function gRunSelect(state: GState, q: W): unknown[] {
    const table = q.table?.__table;
    const src =
        table === 'changes'
            ? state.changes
            : table === 'targets'
              ? state.targets
              : table === 'subs'
                ? state.subs
                : table === 'notices'
                  ? (state.notices ?? [])
                  : [];
    let rows = src.filter((r) => gMatch(q.where, r));
    if (table === 'subs') {
        // A NOT EXISTS sql fragment carries the anti-joined table:
        //   - findAffectedSubscribers (decrease apply) → excludes already-TARGETED subs;
        //   - findUnnoticedAffectedSubscribers / countUnnoticedAffectedSubscribers (increase
        //     notice) → excludes already-NOTICED subs.
        const notExists = gCondList(q.where).find((c: W) => c?.__sql);
        if (notExists) {
            const antiTable = notExists.notExistsTable;
            if (antiTable === 'notices') {
                rows = rows.filter(
                    (s) => !(state.notices ?? []).some((n) => n.subscriptionId === s.id)
                );
            } else {
                rows = rows.filter((s) => !state.targets.some((t) => t.subscriptionId === s.id));
            }
        }
    }
    const proj = q.projection ?? {};
    const projVals = Object.values(proj);
    if (projVals.length === 1 && (projVals[0] as W)?.__sql) {
        return [{ n: rows.length }]; // count(*)::int projection (ignores any limit — total)
    }
    // Honor `.orderBy(asc(col), ...)` (ascending) so the APPLY cursor pagination
    // (subscriptionId ASC + `> cursor` + limit) is deterministic and the batch's MAX is its
    // last element. Only asc fragments are used in this module.
    if (Array.isArray(q.orderBy) && q.orderBy.length > 0) {
        const keys = (q.orderBy as W[])
            .filter((o) => o?.__op === 'asc' && o.col?.__col)
            .map((o) => o.col.__col as string);
        if (keys.length > 0) {
            rows = [...rows].sort((a, b) => {
                for (const k of keys) {
                    if (a[k] < b[k]) return -1;
                    if (a[k] > b[k]) return 1;
                }
                return 0;
            });
        }
    }
    // Honor `.limit(n)` so cross-tick batching (notice pagination + apply cursor) can be
    // exercised: a batch query returns only the first `n` rows, the remainder next tick.
    if (typeof q.limit === 'number') {
        rows = rows.slice(0, q.limit);
    }
    return rows.map((r) => gProject(r, proj));
}
function buildDb(state: GState) {
    const select = (projection: W) => {
        const q: W = { projection, table: null, where: null };
        let resolveChain: (rows: unknown[]) => void = () => undefined;
        const p: W = new Promise((resolve) => {
            resolveChain = resolve;
        });
        queueMicrotask(() => resolveChain(gRunSelect(state, q)));
        p.from = (t: W) => {
            q.table = t;
            return p;
        };
        p.where = (c: W) => {
            q.where = c;
            return p;
        };
        p.orderBy = (...o: W[]) => {
            q.orderBy = o;
            return p;
        };
        p.limit = (n: number) => {
            q.limit = n;
            return p;
        };
        return p;
    };
    const update = (table: W) => ({
        set: (values: W) => ({
            where: (cond: W) => {
                const id = gEqVal(cond, 'id');
                if (table.__table === 'changes') {
                    const c = state.changes.find((x) => x.id === id);
                    if (c) Object.assign(c, values);
                } else if (table.__table === 'targets') {
                    const t = state.targets.find((x) => x.id === id);
                    if (t) Object.assign(t, values);
                }
                return Promise.resolve();
            }
        })
    });
    const insert = (table: W) => ({
        values: (v: W) => ({
            onConflictDoNothing: () => {
                // Route by table: notice-ledger inserts (HOS-176 item b) go to state.notices,
                // everything else to state.targets. Both are unique on (change, sub).
                if (table.__table === 'notices') {
                    state.notices ??= [];
                    const exists = state.notices.some(
                        (n) =>
                            n.priceChangeId === v.priceChangeId &&
                            n.subscriptionId === v.subscriptionId
                    );
                    if (!exists) {
                        state.seq += 1;
                        state.notices.push({ id: `n-${state.seq}`, ...v });
                    }
                    return Promise.resolve();
                }
                const exists = state.targets.some(
                    (t) =>
                        t.priceChangeId === v.priceChangeId && t.subscriptionId === v.subscriptionId
                );
                if (!exists) {
                    state.seq += 1;
                    state.targets.push({ id: `t-${state.seq}`, attemptCount: 0, ...v });
                }
                return Promise.resolve();
            }
        })
    });
    return { select, update, insert };
}
const mkLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('findDueChanges — increase flag gate', () => {
    const past = new Date(Date.now() - 60_000);
    function seed(): GState {
        return {
            changes: [
                {
                    id: 'dec-1',
                    planId: 'p',
                    billingInterval: 'month',
                    newAmount: 1000,
                    direction: 'decrease',
                    status: 'pending',
                    effectiveAt: past,
                    createdAt: past
                },
                {
                    id: 'inc-1',
                    planId: 'p',
                    billingInterval: 'month',
                    newAmount: 2000,
                    direction: 'increase',
                    status: 'noticing',
                    effectiveAt: past,
                    createdAt: past
                }
            ],
            targets: [],
            subs: [],
            seq: 0
        };
    }

    beforeEach(() => vi.clearAllMocks());

    it('returns ONLY decreases when the flag is OFF (increases untouched)', async () => {
        mockGetDb.mockReturnValue(buildDb(seed()));
        const rows = await findDueChanges({ increaseEnabled: false });
        expect(rows.map((r) => r.id)).toEqual(['dec-1']);
    });

    it('includes due post-notice increases when the flag is ON', async () => {
        mockGetDb.mockReturnValue(buildDb(seed()));
        const rows = await findDueChanges({ increaseEnabled: true });
        expect(rows.map((r) => r.id).sort()).toEqual(['dec-1', 'inc-1']);
    });

    it('never returns a still-pending (un-noticed) increase even with the flag ON', async () => {
        const state = seed();
        const inc = state.changes.find((c) => c.id === 'inc-1');
        if (inc) inc.status = 'pending'; // not yet noticed
        mockGetDb.mockReturnValue(buildDb(state));
        const rows = await findDueChanges({ increaseEnabled: true });
        expect(rows.map((r) => r.id)).toEqual(['dec-1']);
    });
});

describe('runIncreaseNoticePhase (notice phase)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: sends succeed (delivered). Individual tests override for non-delivery.
        mockTrySendNotification.mockResolvedValue({ delivered: true });
    });

    function noticeBilling(): QZPayBilling {
        return {
            plans: { get: vi.fn(async () => ({ name: 'plan-1', metadata: {} })) },
            customers: {
                get: vi.fn(async (id: string) => ({
                    email: `${id}@example.com`,
                    metadata: { userId: `u-${id}` }
                }))
            }
        } as unknown as QZPayBilling;
    }

    it('notifies ALL affected subs (incl. trialing) and flips pending→noticing with noticeSentAt + effectiveAt = now+15d', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                },
                {
                    id: 'sub-2',
                    customerId: 'cus-2',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'trialing',
                    mpSubscriptionId: 'mp-2'
                }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        mockPlanDisplayName.mockReturnValue('Plan Uno');

        const before = Date.now();
        const outcome = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        const after = Date.now();

        // Trialing sub IS notified (grandfathered at apply, still legally notified).
        expect(outcome).toEqual({ noticed: 1, notified: 2 });
        expect(mockTrySendNotification).toHaveBeenCalledTimes(2);
        // A notice-ledger row was persisted per successfully-notified sub (item b).
        expect((state.notices ?? []).map((n) => n.subscriptionId).sort()).toEqual([
            'sub-1',
            'sub-2'
        ]);
        expect(mockTrySendNotification.mock.calls[0]?.[0] as Record<string, unknown>).toMatchObject(
            {
                type: 'plan_price_change_notice',
                planName: 'Plan Uno',
                oldPriceArs: 100000,
                newPriceArs: 120000,
                billingInterval: 'month',
                // I1: deterministic dedup key `price-notice:<changeId>:<subscriptionId>`.
                idempotencyKey: 'price-notice:inc-1:sub-1'
            }
        );
        // Header flipped to noticing with a stamped noticeSentAt.
        expect(state.changes[0].status).toBe('noticing');
        expect(state.changes[0].noticeSentAt).toBeInstanceOf(Date);
        // effectiveAt recomputed to now + 15 days.
        const eff = (state.changes[0].effectiveAt as Date).getTime();
        expect(eff).toBeGreaterThanOrEqual(before + INCREASE_NOTICE_GRACE_MS - 2000);
        expect(eff).toBeLessThanOrEqual(after + INCREASE_NOTICE_GRACE_MS + 2000);
    });

    it('is a no-op when there are no pending un-noticed increases', async () => {
        mockGetDb.mockReturnValue(buildDb({ changes: [], targets: [], subs: [], seq: 0 }));
        const outcome = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(outcome).toEqual({ noticed: 0, notified: 0 });
        expect(mockTrySendNotification).not.toHaveBeenCalled();
    });

    it('FIX 1: a notice send that THROWS is a HARD failure — batch continues but the change is NOT flipped to noticing (fail-closed, symmetric)', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        mockPlanDisplayName.mockReturnValue('Plan Uno');
        // A throw here stands in for a customer/plan resolution failure — trySendNotification
        // itself never throws. This exercises the catch branch: a hard failure blocks the flip.
        mockTrySendNotification.mockRejectedValueOnce(new Error('smtp down'));
        const logger = mkLogger();

        const outcome = await runIncreaseNoticePhase(noticeBilling(), logger);
        // Nothing noticed (the throw blocked the flip), nothing counted notified.
        expect(outcome).toEqual({ noticed: 0, notified: 0 });
        // Change stays pending, noticeSentAt still null → never applied un-noticed.
        expect(state.changes[0].status).toBe('pending');
        expect(state.changes[0].noticeSentAt).toBeNull();
        // Surfaced to ops and logged.
        expect(mockCaptureException).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('HOS-176 piece c (was W1 fail-closed): a cohort AT the per-tick cap now NOTIFIES the batch and flips — it no longer bails to manual handling', async () => {
        // Seed exactly MAX_TARGETS_PER_CHANGE affected subs. The OLD behavior fail-closed
        // here (sent 0 notices, stayed pending, Sentry "manual handling"). The NEW behavior
        // notifies the whole batch in one tick (it fits the cap) and flips to noticing —
        // NO bail, NO Sentry.
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const subs: W[] = Array.from({ length: cap }, (_v, i) => ({
            id: `sub-${String(i).padStart(4, '0')}`,
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const state: GState = {
            changes: [
                {
                    id: 'inc-big',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs,
            notices: [],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const logger = mkLogger();

        const outcome = await runIncreaseNoticePhase(noticeBilling(), logger);

        // The whole batch was notified (NOT zero — the old bail sent nothing) and the change
        // flipped in one tick because the cohort fits the cap exactly.
        expect(outcome).toEqual({ noticed: 1, notified: cap });
        expect(mockTrySendNotification).toHaveBeenCalledTimes(cap);
        expect(state.changes[0].status).toBe('noticing');
        expect(state.changes[0].noticeSentAt).toBeInstanceOf(Date);
        expect((state.notices ?? []).length).toBe(cap);
        // No manual-handling bail → no Sentry.
        expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('HOS-176 piece c: a cohort ABOVE the per-tick cap is notified in batches across ticks (info-only pagination), flipping only once the ledger covers every affected sub', async () => {
        // cap + 2 affected subs forces the batch to cap out and leave a remainder, so the
        // change needs a SECOND tick to finish noticing — the cross-tick pagination path.
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const total = cap + 2;
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: `sub-${String(i).padStart(4, '0')}`,
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const state: GState = {
            changes: [
                {
                    id: 'inc-huge',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs,
            notices: [],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));

        // ── Tick 1: notify the first `cap` subs; remainder still un-noticed → stay pending. ──
        const logger1 = mkLogger();
        const t1 = await runIncreaseNoticePhase(noticeBilling(), logger1);
        expect(t1).toEqual({ noticed: 0, notified: cap });
        expect(mockTrySendNotification).toHaveBeenCalledTimes(cap);
        expect((state.notices ?? []).length).toBe(cap);
        // Pagination progress is INFO-only: NOT flipped, NO Sentry, NO error log.
        expect(state.changes[0].status).toBe('pending');
        expect(state.changes[0].noticeSentAt).toBeNull();
        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(logger1.error).not.toHaveBeenCalled();
        const firstBatchIds = new Set((state.notices ?? []).map((n) => n.subscriptionId));

        // ── Tick 2: the ledger-excluding batch advances — ONLY the remaining 2 are emailed. ──
        mockTrySendNotification.mockClear();
        const logger2 = mkLogger();
        const t2 = await runIncreaseNoticePhase(noticeBilling(), logger2);
        // Exactly the remainder is re-emailed; tick 1's subs are NOT re-notified.
        expect(mockTrySendNotification).toHaveBeenCalledTimes(2);
        const tick2Ids = mockTrySendNotification.mock.calls.map(
            (c) => (c[0] as { idempotencyKey: string }).idempotencyKey
        );
        for (const key of tick2Ids) {
            const subId = key.replace('price-notice:inc-huge:', '');
            expect(firstBatchIds.has(subId)).toBe(false);
        }
        // Ledger now covers every affected sub → flip to noticing.
        expect(t2).toEqual({ noticed: 1, notified: 2 });
        expect((state.notices ?? []).length).toBe(total);
        expect(state.changes[0].status).toBe('noticing');
        expect(state.changes[0].noticeSentAt).toBeInstanceOf(Date);
        expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('CHURN premature-flip fix: a previously-noticed sub CANCELS mid-pagination — the change does NOT flip while an affected sub beyond the batch is still un-noticed (the old ledgerCount>=totalAffected gate WOULD have flipped on the stale ledger row)', async () => {
        // total = 2*cap + 1 so a single tick's batch can NEVER cover all un-noticed subs, i.e.
        // this tick ends with a still-un-noticed affected sub → the flip must be gated on
        // "unnoticedRemaining", not a raw ledger-count comparison.
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const total = 2 * cap + 1;
        const subId = (i: number) => `sub-${String(i).padStart(4, '0')}`;
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: subId(i),
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        // Simulate a PRIOR tick that already noticed the first `cap` subs (ledger rows present).
        const notices: W[] = Array.from({ length: cap }, (_v, i) => ({
            id: `n-${i}`,
            priceChangeId: 'inc-churn',
            subscriptionId: subId(i)
        }));
        // A previously-noticed sub CANCELS → it LEAVES the affected set, but its ledger row
        // lingers (stale). Under the old `ledgerCount >= countAllAffectedSubscribers` gate this
        // stale row would let the change flip prematurely this tick (ledger 2*cap, affected
        // 2*cap) while sub-(2*cap) is still un-noticed. The new gate must NOT flip.
        subs[0].status = 'cancelled';
        const state: GState = {
            changes: [
                {
                    id: 'inc-churn',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs,
            notices,
            seq: cap
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const logger = mkLogger();

        // This tick notices the next `cap` un-noticed affected subs, but sub-(2*cap) is still
        // un-noticed → unnoticedRemaining = 1 → NO flip (pagination progress, info-only).
        const outcome = await runIncreaseNoticePhase(noticeBilling(), logger);
        expect(mockTrySendNotification).toHaveBeenCalledTimes(cap);
        expect(outcome.noticed).toBe(0);
        expect(state.changes[0].status).toBe('pending');
        expect(state.changes[0].noticeSentAt).toBeNull();
        // Not a failure and NOT a premature flip: no Sentry, no error log.
        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
        // The stale ledger row for the cancelled sub is still there and did NOT cause the flip.
        expect((state.notices ?? []).some((n) => n.subscriptionId === subId(0))).toBe(true);

        // A subsequent tick notices the last sub → every CURRENTLY-affected sub now has a
        // ledger row (the cancelled sub is not affected) → unnoticedRemaining = 0 → flip.
        mockTrySendNotification.mockClear();
        const outcome2 = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(mockTrySendNotification).toHaveBeenCalledTimes(1);
        expect(outcome2.noticed).toBe(1);
        expect(state.changes[0].status).toBe('noticing');
        expect(state.changes[0].noticeSentAt).toBeInstanceOf(Date);
    });

    it('FIX 3: a change with an unresolvable customer stays pending; a companion on a DIFFERENT plan (all subs resolve) still flips — proving the hard-failure flag is per-change scoped', async () => {
        // A billing whose customers.get resolves everyone EXCEPT `cus-bad` (returns null).
        function partialBilling(): QZPayBilling {
            return {
                plans: { get: vi.fn(async () => ({ name: 'plan', metadata: {} })) },
                customers: {
                    get: vi.fn(async (id: string) =>
                        id === 'cus-bad'
                            ? null
                            : { email: `${id}@example.com`, metadata: { userId: `u-${id}` } }
                    )
                }
            } as unknown as QZPayBilling;
        }

        const mkChange = (id: string, planId: string) => ({
            id,
            planId,
            billingInterval: 'month',
            oldAmount: 100000,
            newAmount: 120000,
            direction: 'increase',
            status: 'pending',
            noticeSentAt: null,
            effectiveAt: new Date(0),
            createdAt: new Date()
        });

        const state: GState = {
            // inc-bad is on plan-1, whose ONLY sub has an unresolvable customer → it must
            // stay pending. inc-good is on plan-2, whose subs ALL resolve (and neither
            // returns null nor throws, so FIX 1 does not trip) → it must flip to noticing.
            // The DIFFERENT plans are the point: they prove `hadHardNoticeFailure` is scoped
            // to each change's own subscriber pass, not hoisted across changes.
            changes: [mkChange('inc-bad', 'plan-1'), mkChange('inc-good', 'plan-2')],
            targets: [],
            subs: [
                {
                    id: 'sub-bad',
                    customerId: 'cus-bad',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-bad'
                },
                {
                    id: 'sub-good',
                    customerId: 'cus-good',
                    planId: 'plan-2',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-good'
                }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        mockPlanDisplayName.mockReturnValue('Plan Uno');
        const logger = mkLogger();

        const outcome = await runIncreaseNoticePhase(partialBilling(), logger);

        // Only the companion (different plan, all resolvable) flips; the bad change stays
        // pending. If the flag were hoisted out of the per-sub loop the companion would
        // ALSO stay pending — so this asserts per-change isolation.
        expect(outcome.noticed).toBe(1);
        const bad = state.changes.find((c) => c.id === 'inc-bad');
        const good = state.changes.find((c) => c.id === 'inc-good');
        expect(bad?.status).toBe('pending');
        expect(bad?.noticeSentAt).toBeNull();
        expect(good?.status).toBe('noticing');
        expect(good?.noticeSentAt).toBeInstanceOf(Date);
        // The unresolvable customer was surfaced to ops and logged as an error.
        expect(mockCaptureException).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
    });

    it('FIX A: when every affected customer resolves, the change flips to noticing normally (no hard-failure)', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-all-ok',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        mockPlanDisplayName.mockReturnValue('Plan Uno');

        const outcome = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(outcome).toEqual({ noticed: 1, notified: 1 });
        expect(state.changes[0].status).toBe('noticing');
        expect(state.changes[0].noticeSentAt).toBeInstanceOf(Date);
        expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('a change UNDER the per-tick cap flips to noticing normally (overflow guard does not trip)', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-small',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));

        const outcome = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(outcome).toEqual({ noticed: 1, notified: 1 });
        expect(state.changes[0].status).toBe('noticing');
        expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('EXACTLY-ONCE: a sub already in the notice ledger is NOT re-emailed on a later tick', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                },
                {
                    id: 'sub-2',
                    customerId: 'cus-2',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-2'
                }
            ],
            // sub-1 was already notified on a prior tick (ledger row present).
            notices: [{ id: 'n-1', priceChangeId: 'inc-1', subscriptionId: 'sub-1' }],
            seq: 1
        };
        mockGetDb.mockReturnValue(buildDb(state));

        const outcome = await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        // Only the still-missing sub-2 is emailed; sub-1 is skipped (already in the ledger).
        expect(mockTrySendNotification).toHaveBeenCalledTimes(1);
        expect(
            (mockTrySendNotification.mock.calls[0]?.[0] as Record<string, unknown>).idempotencyKey
        ).toBe('price-notice:inc-1:sub-2');
        // Both subs now covered → change flips.
        expect(outcome).toEqual({ noticed: 1, notified: 1 });
        expect(state.changes[0].status).toBe('noticing');
        expect((state.notices ?? []).map((n) => n.subscriptionId).sort()).toEqual([
            'sub-1',
            'sub-2'
        ]);
    });

    it('cross-tick: a first-tick customer-not-found blocks the flip; the second tick re-notifies ONLY the missing sub (no re-email storm)', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                },
                {
                    id: 'sub-2',
                    customerId: 'cus-2',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-2'
                }
            ],
            notices: [],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        // cus-2 is unresolvable on the FIRST tick, then resolvable on the second.
        let cus2Calls = 0;
        const flakyBilling = {
            plans: { get: vi.fn(async () => ({ name: 'plan', metadata: {} })) },
            customers: {
                get: vi.fn(async (id: string) => {
                    if (id === 'cus-2') {
                        cus2Calls += 1;
                        if (cus2Calls === 1) return null;
                    }
                    return { email: `${id}@example.com`, metadata: { userId: `u-${id}` } };
                })
            }
        } as unknown as QZPayBilling;

        // Tick 1: sub-1 notified, sub-2 unresolvable → change stays pending.
        const t1 = await runIncreaseNoticePhase(flakyBilling, mkLogger());
        expect(t1).toEqual({ noticed: 0, notified: 1 });
        expect(state.changes[0].status).toBe('pending');
        expect((state.notices ?? []).map((n) => n.subscriptionId)).toEqual(['sub-1']);

        // Tick 2: sub-1 is skipped (already noticed — no re-email); only sub-2 is emailed → flip.
        mockTrySendNotification.mockClear();
        const t2 = await runIncreaseNoticePhase(flakyBilling, mkLogger());
        expect(mockTrySendNotification).toHaveBeenCalledTimes(1);
        expect(
            (mockTrySendNotification.mock.calls[0]?.[0] as Record<string, unknown>).idempotencyKey
        ).toBe('price-notice:inc-1:sub-2');
        expect(t2).toEqual({ noticed: 1, notified: 1 });
        expect(state.changes[0].status).toBe('noticing');
    });

    it('DELIVERY-GATED: a send that resolves but is NOT delivered writes NO ledger row and leaves the change pending', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                }
            ],
            notices: [],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        // The send RESOLVES but reports NON-delivery (email service unavailable / non-success
        // result). A fire-and-forget send returning is NOT proof of delivery — for a legal
        // advance notice, no ledger row may be written and the change must not flip.
        mockTrySendNotification.mockResolvedValue({ delivered: false });
        const logger = mkLogger();

        const outcome = await runIncreaseNoticePhase(noticeBilling(), logger);
        expect(outcome).toEqual({ noticed: 0, notified: 0 });
        expect(state.notices ?? []).toHaveLength(0);
        expect(state.changes[0].status).toBe('pending');
        expect(state.changes[0].noticeSentAt).toBeNull();
        // Surfaced to ops via ONE rate-limited change-level alert.
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
    });

    it('rate-limit throttle end-to-end: tick 1 PERSISTS lastNoticeBlockAlertAt + alerts once; an in-window tick is suppressed; a stale (>6h) tick re-alerts and advances the timestamp', async () => {
        const state: GState = {
            changes: [
                {
                    id: 'inc-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    oldAmount: 100000,
                    newAmount: 120000,
                    direction: 'increase',
                    status: 'pending',
                    noticeSentAt: null,
                    effectiveAt: new Date(0),
                    createdAt: new Date()
                    // No metadata seeded — the code itself must write the throttle timestamp.
                }
            ],
            targets: [],
            subs: [
                {
                    id: 'sub-1',
                    customerId: 'cus-1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    status: 'active',
                    mpSubscriptionId: 'mp-1'
                }
            ],
            notices: [],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        mockTrySendNotification.mockResolvedValue({ delivered: false });

        // Tick 1: blocked → ONE capture + the throttle timestamp is PERSISTED by the code.
        await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
        const meta = state.changes[0].metadata as Record<string, unknown> | undefined;
        expect(typeof meta?.lastNoticeBlockAlertAt).toBe('string');

        // Tick 2 (immediately): within the 6h window → NO new capture (throttled).
        await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(mockCaptureException).toHaveBeenCalledTimes(1);

        // Simulate the window elapsing: backdate the persisted timestamp > 6h.
        (state.changes[0].metadata as Record<string, unknown>).lastNoticeBlockAlertAt = new Date(
            Date.now() - 7 * 60 * 60 * 1000
        ).toISOString();

        // Tick 3: stale timestamp → RE-alert and advance the timestamp to ~now.
        await runIncreaseNoticePhase(noticeBilling(), mkLogger());
        expect(mockCaptureException).toHaveBeenCalledTimes(2);
        const advanced = (state.changes[0].metadata as Record<string, unknown>)
            .lastNoticeBlockAlertAt as string;
        expect(Date.parse(advanced)).toBeGreaterThan(Date.now() - 60_000);
    });
});

describe('applyChange — trialing grandfather at apply (increase vs decrease)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadDiscountState.mockResolvedValue(null); // no discount → target amount = newAmount
    });

    function twoSubs(): W[] {
        return [
            {
                id: 'sub-active',
                customerId: 'c1',
                planId: 'plan-1',
                billingInterval: 'month',
                status: 'active',
                mpSubscriptionId: 'mp-a'
            },
            {
                id: 'sub-trial',
                customerId: 'c2',
                planId: 'plan-1',
                billingInterval: 'month',
                status: 'trialing',
                mpSubscriptionId: 'mp-t'
            }
        ];
    }
    function okBilling(): QZPayBilling {
        return {
            getPaymentAdapter: () => ({ subscriptions: { update: vi.fn(async () => undefined) } })
        } as unknown as QZPayBilling;
    }

    it('INCREASE excludes a trialing sub — no target is created for it (sourced from the notice ledger)', async () => {
        // Both subs were legally notified (ledger rows). At apply the trialing one is
        // grandfathered (no target); only the active one is re-priced.
        const state: GState = {
            changes: [{ id: 'pc-inc', status: 'pending' }],
            targets: [],
            subs: twoSubs(),
            notices: [
                { id: 'n-1', priceChangeId: 'pc-inc', subscriptionId: 'sub-active' },
                { id: 'n-2', priceChangeId: 'pc-inc', subscriptionId: 'sub-trial' }
            ],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        await applyChange(
            {
                id: 'pc-inc',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 120000,
                direction: 'increase'
            },
            okBilling(),
            mkLogger()
        );
        expect(state.targets.map((t) => t.subscriptionId).sort()).toEqual(['sub-active']);
    });

    it('INCREASE apply sources ONLY the notice ledger — a live active sub with NO ledger row is NOT re-priced (divergence closed)', async () => {
        // sub-active is live+active but was never notified (no ledger row) → it must NOT be
        // re-priced. This is the notice-set vs apply-set divergence closure (item b).
        const state: GState = {
            changes: [{ id: 'pc-inc', status: 'pending' }],
            targets: [],
            subs: twoSubs(),
            notices: [], // nobody notified
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        await applyChange(
            {
                id: 'pc-inc',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 120000,
                direction: 'increase'
            },
            okBilling(),
            mkLogger()
        );
        expect(state.targets).toHaveLength(0);
    });

    it('INCREASE grandfathers a notified sub with a FUTURE trialEnd even if status=active (HOS-171 derived-status guard)', async () => {
        const state: GState = {
            changes: [{ id: 'pc-inc', status: 'pending' }],
            targets: [],
            subs: [
                {
                    id: 'sub-derived-trial',
                    customerId: 'c1',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    // Stored status is `active` (webhook lag) but the trial has NOT ended.
                    status: 'active',
                    mpSubscriptionId: 'mp-a',
                    trialEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                }
            ],
            notices: [{ id: 'n-1', priceChangeId: 'pc-inc', subscriptionId: 'sub-derived-trial' }],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        await applyChange(
            {
                id: 'pc-inc',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 120000,
                direction: 'increase'
            },
            okBilling(),
            mkLogger()
        );
        // Future trialEnd → grandfathered despite status=active → NO target (never re-priced mid-trial).
        expect(state.targets).toHaveLength(0);
    });

    it('DECREASE includes a trialing sub — a target IS created for it', async () => {
        const state: GState = {
            changes: [{ id: 'pc-dec', status: 'pending' }],
            targets: [],
            subs: twoSubs(),
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        await applyChange(
            {
                id: 'pc-dec',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 8000,
                direction: 'decrease'
            },
            okBilling(),
            mkLogger()
        );
        expect(state.targets.map((t) => t.subscriptionId).sort()).toEqual([
            'sub-active',
            'sub-trial'
        ]);
    });
});

describe('applyChange — MP amount guards (skipped, MP never called)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadDiscountState.mockResolvedValue(null);
    });

    function oneSub(): W[] {
        return [
            {
                id: 'sub-1',
                customerId: 'c1',
                planId: 'plan-1',
                billingInterval: 'month',
                status: 'active',
                mpSubscriptionId: 'mp-1'
            }
        ];
    }

    async function driveToFinalize(change: W, updateSpy: () => Promise<void>) {
        const billing = {
            getPaymentAdapter: () => ({ subscriptions: { update: vi.fn(updateSpy) } })
        } as unknown as QZPayBilling;
        let done = false;
        let ticks = 0;
        while (!done && ticks < 6) {
            ticks += 1;
            done = (await applyChange(change, billing, mkLogger())).done;
        }
        return done;
    }

    it('amount ≤ 0 → target skipped, MP never called, header finalizes failed', async () => {
        const state: GState = {
            changes: [{ id: 'pc-0', status: 'pending' }],
            targets: [],
            subs: oneSub(),
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);
        const done = await driveToFinalize(
            {
                id: 'pc-0',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 0,
                direction: 'decrease'
            },
            updateSpy
        );
        expect(done).toBe(true);
        expect(updateSpy).not.toHaveBeenCalled();
        expect(state.targets).toHaveLength(1);
        expect(state.targets[0].status).toBe('skipped');
        expect(state.changes[0].status).toBe('failed');
        expect(mockCaptureException).toHaveBeenCalled();
    });

    it('amount above the $2,000,000 ARS cap → target skipped, MP never called, header failed', async () => {
        const state: GState = {
            changes: [{ id: 'pc-big', status: 'pending' }],
            targets: [],
            subs: oneSub(),
            // Increase sources from the notice ledger — sub-1 was notified.
            notices: [{ id: 'n-1', priceChangeId: 'pc-big', subscriptionId: 'sub-1' }],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);
        // 200_000_100 centavos = $2,000,001 > cap.
        const done = await driveToFinalize(
            {
                id: 'pc-big',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 200_000_100,
                direction: 'increase'
            },
            updateSpy
        );
        expect(done).toBe(true);
        expect(updateSpy).not.toHaveBeenCalled();
        expect(state.targets[0].status).toBe('skipped');
        expect(state.changes[0].status).toBe('failed');
        expect(mockCaptureException).toHaveBeenCalled();
    });

    it('a normal in-range amount is NOT skipped — MP IS called and the target applies', async () => {
        const state: GState = {
            changes: [{ id: 'pc-ok', status: 'pending' }],
            targets: [],
            subs: oneSub(),
            // Increase sources from the notice ledger — sub-1 was notified.
            notices: [{ id: 'n-1', priceChangeId: 'pc-ok', subscriptionId: 'sub-1' }],
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);
        await driveToFinalize(
            {
                id: 'pc-ok',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 150000,
                direction: 'increase'
            },
            updateSpy
        );
        expect(updateSpy).toHaveBeenCalledWith('mp-1', { transactionAmount: 1500 });
        expect(state.targets[0].status).toBe('applied');
        expect(state.changes[0].status).toBe('done');
    });
});

// ─── HOS-176 piece c: increase APPLY cursor pagination ──────────────────────
//
// The notice ledger is FIXED once a change reaches `noticing`, so the apply phase
// paginates it by a `subscriptionId` cursor stored in `change.metadata.applyCursor`.
// These tests drive applyChange across ticks, RE-READING the change from state each
// tick (exactly what `findDueChanges` does in production — fresh metadata per tick).
describe('applyChange — increase APPLY cursor pagination (HOS-176 piece c)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadDiscountState.mockResolvedValue(null); // no discount → amount = newAmount
    });

    function okBilling(updateSpy: () => Promise<void>): QZPayBilling {
        return {
            getPaymentAdapter: () => ({ subscriptions: { update: vi.fn(updateSpy) } })
        } as unknown as QZPayBilling;
    }

    /** Zero-padded sub id so lexical order == numeric order (matches uuid ASC ordering). */
    const subId = (i: number) => `sub-${String(i).padStart(4, '0')}`;

    /**
     * Drive applyChange until `done`, re-reading the change (incl. the persisted
     * `applyCursor` metadata) from state each tick — the production per-tick findDueChanges.
     */
    async function driveIncrease(
        state: GState,
        changeId: string,
        newAmount: number,
        billing: QZPayBilling,
        cap = 10
    ): Promise<number> {
        let done = false;
        let ticks = 0;
        while (!done && ticks < cap) {
            ticks += 1;
            const row = state.changes.find((c) => c.id === changeId) as W;
            const change = {
                id: changeId,
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount,
                direction: 'increase',
                metadata: (row?.metadata ?? null) as Record<string, unknown> | null
            };
            done = (await applyChange(change, billing, mkLogger())).done;
        }
        return ticks;
    }

    it('a >cap notice ledger is targeted+re-priced in batches across ticks; EVERY chargeable sub gets a target (none stranded past position cap), then finalizes done', async () => {
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const total = cap + 2; // forces a second batch
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: subId(i),
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const notices: W[] = subs.map((s, i) => ({
            id: `n-${i}`,
            priceChangeId: 'pc-huge',
            subscriptionId: s.id
        }));
        const state: GState = {
            changes: [{ id: 'pc-huge', status: 'noticing' }],
            targets: [],
            subs,
            notices,
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);

        const ticks = await driveIncrease(state, 'pc-huge', 150000, okBilling(updateSpy));

        // Two ticks: cap in the first, the remaining 2 in the second.
        expect(ticks).toBe(2);
        // EVERY chargeable ledger sub got a target — none stranded past position cap.
        expect(state.targets).toHaveLength(total);
        expect(state.targets.every((t) => t.status === 'applied')).toBe(true);
        const targetedIds = new Set(state.targets.map((t) => t.subscriptionId));
        expect(targetedIds.size).toBe(total);
        expect(targetedIds.has(subId(total - 1))).toBe(true); // the last sub, past position cap
        // MP was called once per chargeable sub.
        expect(updateSpy).toHaveBeenCalledTimes(total);
        // Finalized, and the cursor was persisted/advanced to the MAX sub id.
        expect(state.changes[0].status).toBe('done');
        expect((state.changes[0].metadata as Record<string, unknown>).applyCursor).toBe(
            subId(total - 1)
        );
    });

    it('resumes from the persisted cursor across ticks: tick 1 targets the first cap, tick 2 the remainder (cursor advances, no re-work of tick-1 subs)', async () => {
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const total = cap + 3;
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: subId(i),
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const notices: W[] = subs.map((s, i) => ({
            id: `n-${i}`,
            priceChangeId: 'pc-x',
            subscriptionId: s.id
        }));
        const state: GState = {
            changes: [{ id: 'pc-x', status: 'noticing' }],
            targets: [],
            subs,
            notices,
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);
        const billing = okBilling(updateSpy);

        // Tick 1: first `cap` subs targeted; cursor at subId(cap-1); NOT finalized.
        const row1 = state.changes.find((c) => c.id === 'pc-x') as W;
        const done1 = (
            await applyChange(
                {
                    id: 'pc-x',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    newAmount: 150000,
                    direction: 'increase',
                    metadata: (row1?.metadata ?? null) as Record<string, unknown> | null
                },
                billing,
                mkLogger()
            )
        ).done;
        expect(done1).toBe(false);
        expect(state.targets).toHaveLength(cap);
        expect((state.changes[0].metadata as Record<string, unknown>).applyCursor).toBe(
            subId(cap - 1)
        );

        // Tick 2: resumes past the cursor → ONLY the remaining 3 are targeted; finalize.
        const row2 = state.changes.find((c) => c.id === 'pc-x') as W;
        const done2 = (
            await applyChange(
                {
                    id: 'pc-x',
                    planId: 'plan-1',
                    billingInterval: 'month',
                    newAmount: 150000,
                    direction: 'increase',
                    metadata: (row2?.metadata ?? null) as Record<string, unknown> | null
                },
                billing,
                mkLogger()
            )
        ).done;
        expect(done2).toBe(true);
        expect(state.targets).toHaveLength(total); // cap + 3, no re-work of the first cap
        expect(state.changes[0].status).toBe('done');
    });

    it('grandfathered subs interleaved in a >cap ledger: the cursor moves PAST them (no target), they do NOT deadlock or block finalization', async () => {
        const cap = _internals.MAX_TARGETS_PER_CHANGE;
        const total = cap + 4;
        // Every 5th sub is trialing (grandfathered — no target); the rest are chargeable.
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: subId(i),
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: i % 5 === 0 ? 'trialing' : 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const notices: W[] = subs.map((s, i) => ({
            id: `n-${i}`,
            priceChangeId: 'pc-gf',
            subscriptionId: s.id
        }));
        const chargeableIds = subs.filter((s) => s.status === 'active').map((s) => s.id);
        const state: GState = {
            changes: [{ id: 'pc-gf', status: 'noticing' }],
            targets: [],
            subs,
            notices,
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);

        const ticks = await driveIncrease(state, 'pc-gf', 150000, okBilling(updateSpy));

        // No deadlock: finishes in a bounded number of ticks and finalizes done.
        expect(ticks).toBeLessThanOrEqual(3);
        expect(state.changes[0].status).toBe('done');
        // ONLY the chargeable subs got targets; the grandfathered (trialing) ones did NOT,
        // and did not prevent finalization.
        expect(state.targets.map((t) => t.subscriptionId).sort()).toEqual(
            [...chargeableIds].sort()
        );
        expect(updateSpy).toHaveBeenCalledTimes(chargeableIds.length);
        // Cursor advanced to the MAX ledger sub id even though it (and others) were skipped.
        expect((state.changes[0].metadata as Record<string, unknown>).applyCursor).toBe(
            subId(total - 1)
        );
    });

    it('idempotent re-run of an already-processed batch (cursor rewound → ON CONFLICT + already-targeted skip) creates NO duplicate targets', async () => {
        const total = 3;
        const subs: W[] = Array.from({ length: total }, (_v, i) => ({
            id: subId(i),
            customerId: `cus-${i}`,
            planId: 'plan-1',
            billingInterval: 'month',
            status: 'active',
            mpSubscriptionId: `mp-${i}`
        }));
        const notices: W[] = subs.map((s, i) => ({
            id: `n-${i}`,
            priceChangeId: 'pc-idem',
            subscriptionId: s.id
        }));
        const state: GState = {
            changes: [{ id: 'pc-idem', status: 'noticing' }],
            targets: [],
            subs,
            notices,
            seq: 0
        };
        mockGetDb.mockReturnValue(buildDb(state));
        const updateSpy = vi.fn(async () => undefined);
        const billing = okBilling(updateSpy);

        // First pass: all 3 targeted + applied, cursor at the last id, finalized.
        await driveIncrease(state, 'pc-idem', 150000, billing);
        expect(state.targets).toHaveLength(total);

        // Simulate a crash-replay: rewind the cursor to START and re-run one tick. The batch
        // re-reads the same subs, but the already-targeted skip + ON CONFLICT DO NOTHING mean
        // NO duplicate target rows are created.
        (state.changes[0].metadata as Record<string, unknown>).applyCursor =
            _internals.APPLY_CURSOR_START;
        const row = state.changes.find((c) => c.id === 'pc-idem') as W;
        await applyChange(
            {
                id: 'pc-idem',
                planId: 'plan-1',
                billingInterval: 'month',
                newAmount: 150000,
                direction: 'increase',
                metadata: (row?.metadata ?? null) as Record<string, unknown> | null
            },
            billing,
            mkLogger()
        );
        expect(state.targets).toHaveLength(total); // still 3 — no duplicates
    });
});
