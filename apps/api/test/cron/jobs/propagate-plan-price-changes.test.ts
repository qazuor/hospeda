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

// Structured helpers + identifiable table columns so the applyChange integration
// test can run a stateful fake db that interprets the drizzle query builder. Pure
// helpers / other tests don't inspect these values, so the structure is harmless.
vi.mock('@repo/db', () => {
    const col = (name: string) => ({ __col: name });
    const tbl = (name: string, cols: Record<string, unknown>) => ({ __table: name, ...cols });
    return {
        and: (...conds: unknown[]) => ({ __op: 'and', conds }),
        asc: (c: unknown) => ({ __op: 'asc', col: c }),
        eq: (c: unknown, val: unknown) => ({ __op: 'eq', col: c, val }),
        inArray: (c: unknown, vals: unknown[]) => ({ __op: 'in', col: c, vals }),
        isNotNull: (c: unknown) => ({ __op: 'notnull', col: c }),
        lte: (c: unknown, val: unknown) => ({ __op: 'lte', col: c, val }),
        sql: () => ({ __sql: true }),
        getDb: mockGetDb,
        billingPlanPriceChanges: tbl('changes', {
            id: col('id'),
            planId: col('planId'),
            billingInterval: col('billingInterval'),
            newAmount: col('newAmount'),
            direction: col('direction'),
            status: col('status'),
            effectiveAt: col('effectiveAt'),
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
        billingSubscriptions: tbl('subs', {
            id: col('id'),
            mpSubscriptionId: col('mpSubscriptionId'),
            planId: col('planId'),
            billingInterval: col('billingInterval'),
            status: col('status')
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

import { _internals } from '../../../src/cron/jobs/propagate-plan-price-changes.job.js';

const {
    resolveDiscountAwareTargetCentavos,
    applyMpAmount,
    nextTargetStatusOnFailure,
    nextDeferStatus,
    shouldFinalize,
    ensureTargets,
    applyChange
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
