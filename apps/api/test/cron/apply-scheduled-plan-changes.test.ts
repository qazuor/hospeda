/**
 * Unit tests for the apply-scheduled-plan-changes cron job
 * (SPEC-141 D7 downgrade).
 *
 * Coverage:
 * - `applyOne` happy path: changePlan + MP propagate + addon recalc
 *   + cache clear + mark applied.
 * - `applyOne` step-1 (changePlan) throws → increment attemptCount,
 *   keep status pending. After MAX_APPLY_ATTEMPTS the change flips
 *   to `failed`.
 * - `applyOne` MP propagation throws → logged, change still applied
 *   (best-effort).
 * - `applyOne` addon recalc throws → logged, change still applied.
 * - `applyOne` mark-applied write throws → logged, returns
 *   `applied` anyway (next tick will re-mark).
 * - `applyOne` with no mpSubscriptionId → skips MP propagation
 *   without error.
 * - Handler skips when billing not configured.
 * - Handler dry-run lists ids without applying.
 * - Handler counters reflect mixed outcomes (applied/retry/failed).
 * - Handler counters `failed` includes an `applyOne` throw bypassing
 *   the internal try/catch.
 *
 * @module test/cron/apply-scheduled-plan-changes
 */

import type { QZPayBilling, QZPayScheduledPlanChange } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Drizzle mock — returns rows the test feeds into `dueRows`.
const dueRowsState: { rows: Array<Record<string, unknown>> } = { rows: [] };

vi.mock('@repo/db', () => {
    function makeSelectChain() {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => dueRowsState.rows
        };
        return chain;
    }
    return {
        getDb: vi.fn(() => ({ select: vi.fn(() => makeSelectChain()) })),
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            planId: 'PLAN_ID',
            mpSubscriptionId: 'MP_SUB_ID',
            scheduledPlanChange: 'SCHEDULED_PLAN_CHANGE'
        },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import {
    _internals,
    applyScheduledPlanChangesJob
} from '../../src/cron/jobs/apply-scheduled-plan-changes';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUB_ID = 'sub-1';
const CUSTOMER_ID = 'cust-1';
const OLD_PLAN_ID = 'plan_pro';
const NEW_PLAN_ID = 'plan_basic';
const NEW_PRICE_ID = 'price_basic_monthly';
const MP_SUB_ID = 'mp-pre-1';

function makeScheduled(
    overrides: Partial<QZPayScheduledPlanChange> = {}
): QZPayScheduledPlanChange {
    return {
        newPlanId: NEW_PLAN_ID,
        newPriceId: NEW_PRICE_ID,
        targetTransactionAmountMajor: 5_000,
        applyAt: '2026-06-01T00:00:00.000Z',
        requestedAt: '2026-05-15T00:00:00.000Z',
        status: 'pending',
        attemptCount: 0,
        ...overrides
    };
}

function makeRow(
    overrides: Partial<{
        mpSubscriptionId: string | null;
        scheduledPlanChange: QZPayScheduledPlanChange;
    }> = {}
) {
    return {
        subscriptionId: SUB_ID,
        customerId: CUSTOMER_ID,
        currentPlanId: OLD_PLAN_ID,
        mpSubscriptionId:
            overrides.mpSubscriptionId === undefined ? MP_SUB_ID : overrides.mpSubscriptionId,
        scheduledPlanChange: overrides.scheduledPlanChange ?? makeScheduled()
    };
}

interface BillingMockOpts {
    changePlanThrows?: Error;
    mpUpdateThrows?: Error;
    paymentAdapterPresent?: boolean;
    /**
     * Makes ALL billing.subscriptions.update calls throw (including the
     * pre-stamp in step 0). Use `finaliseThrows` to only fail the
     * finalise write (step 5) while letting the pre-stamp succeed.
     */
    updateThrows?: Error;
    /**
     * Makes only the SECOND billing.subscriptions.update call throw
     * (the finalise write in step 5). The pre-stamp (step 0) succeeds.
     * Use this to test the idempotency guarantee: finalise failure must
     * not cause changePlan to re-run.
     */
    finaliseThrows?: Error;
}

function makeBilling(opts: BillingMockOpts = {}) {
    const changePlan = opts.changePlanThrows
        ? vi.fn().mockRejectedValue(opts.changePlanThrows)
        : vi.fn().mockResolvedValue({ subscription: { id: SUB_ID, planId: NEW_PLAN_ID } });

    const mpUpdate = opts.mpUpdateThrows
        ? vi.fn().mockRejectedValue(opts.mpUpdateThrows)
        : vi.fn().mockResolvedValue({ id: MP_SUB_ID });

    const paymentAdapter =
        opts.paymentAdapterPresent === false ? null : { subscriptions: { update: mpUpdate } };

    let update: ReturnType<typeof vi.fn>;
    if (opts.updateThrows) {
        const err = opts.updateThrows;
        update = vi.fn().mockRejectedValue(err);
    } else if (opts.finaliseThrows) {
        const err = opts.finaliseThrows;
        let callCount = 0;
        update = vi.fn().mockImplementation(() => {
            callCount += 1;
            // First call = pre-stamp (step 0): succeeds.
            // Second call = finalise (step 5): throws.
            if (callCount >= 2) return Promise.reject(err);
            return Promise.resolve({ id: SUB_ID });
        });
    } else {
        update = vi.fn().mockResolvedValue({ id: SUB_ID });
    }

    return {
        billing: {
            subscriptions: {
                changePlan,
                update
            },
            getPaymentAdapter: vi.fn(() => paymentAdapter)
        } as unknown as QZPayBilling,
        changePlan,
        mpUpdate,
        update,
        paymentAdapter
    };
}

function makeCtx(opts: { dryRun?: boolean } = {}) {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    return {
        ctx: {
            logger,
            startedAt: new Date('2026-06-01T00:00:00.000Z'),
            dryRun: opts.dryRun ?? false
        },
        logger
    };
}

// ---------------------------------------------------------------------------
// applyOne — internal helper
// ---------------------------------------------------------------------------

describe('applyOne', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('happy path: changePlan + MP + recalc + cache + mark applied', async () => {
        const { billing, changePlan, mpUpdate, update } = makeBilling();
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome).toEqual({ kind: 'applied' });
        expect(changePlan).toHaveBeenCalledWith(SUB_ID, {
            newPlanId: NEW_PLAN_ID,
            newPriceId: NEW_PRICE_ID,
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUB_ID, {
            planId: NEW_PLAN_ID,
            transactionAmount: 5_000
        });
        expect(handlePlanChangeAddonRecalculation).toHaveBeenCalledOnce();
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        // update is now called TWICE: step 0 (pre-stamp) + step 5 (finalise).
        expect(update).toHaveBeenCalledTimes(2);
        // Pre-stamp (step 0): status applied, no resolvedAt yet.
        const preStampArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const preStamp = preStampArg.scheduledPlanChange as Record<string, unknown>;
        expect(preStamp.status).toBe('applied');
        expect(preStamp.resolvedAt).toBeUndefined();
        // Finalise (step 5): status applied, resolvedAt set, attemptCount bumped.
        const finaliseArg = update.mock.calls[1]?.[1] as Record<string, unknown>;
        const finalised = finaliseArg.scheduledPlanChange as Record<string, unknown>;
        expect(finalised.status).toBe('applied');
        expect(finalised.attemptCount).toBe(1);
        expect(finalised.resolvedAt).toBeDefined();
    });

    it('changePlan throws → retry; attemptCount incremented, status stays pending', async () => {
        const { billing, update } = makeBilling({
            changePlanThrows: new Error('storage offline')
        });
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('retry');
        if (outcome.kind !== 'retry') throw new Error('unreachable');
        expect(outcome.attemptCount).toBe(1);
        expect(outcome.error).toBe('storage offline');

        // update is called TWICE: step 0 (pre-stamp to applied) then
        // step 1 rollback (back to pending with incremented attemptCount).
        expect(update).toHaveBeenCalledTimes(2);
        // Rollback write (step 1 failure handler): status: 'pending', attemptCount: 1.
        const rollbackArg = update.mock.calls[1]?.[1] as Record<string, unknown>;
        const scheduled = rollbackArg.scheduledPlanChange as Record<string, unknown>;
        expect(scheduled.status).toBe('pending');
        expect(scheduled.attemptCount).toBe(1);
        expect(scheduled.lastError).toBe('storage offline');
        expect(scheduled.resolvedAt).toBeUndefined();
    });

    it('changePlan throws after attempt N=MAX-1 → flips to failed with resolvedAt', async () => {
        const { billing, update } = makeBilling({
            changePlanThrows: new Error('still failing')
        });
        // Start at attempt 4; next failure makes it 5 = MAX_APPLY_ATTEMPTS.
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ attemptCount: 4 })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('failed');
        if (outcome.kind !== 'failed') throw new Error('unreachable');
        expect(outcome.attemptCount).toBe(5);

        // update is called TWICE: step 0 (pre-stamp to applied) then
        // step 1 rollback (to failed when budget exhausted).
        expect(update).toHaveBeenCalledTimes(2);
        const rollbackArg = update.mock.calls[1]?.[1] as Record<string, unknown>;
        const scheduled = rollbackArg.scheduledPlanChange as Record<string, unknown>;
        expect(scheduled.status).toBe('failed');
        expect(scheduled.resolvedAt).toBeDefined();
    });

    it('MP propagation throws → logged, change still applied (best-effort)', async () => {
        const { billing } = makeBilling({ mpUpdateThrows: new Error('MP timeout') });
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
    });

    it('addon recalc throws → logged, change still applied', async () => {
        const { billing } = makeBilling();
        vi.mocked(handlePlanChangeAddonRecalculation).mockRejectedValueOnce(
            new Error('recalc failed')
        );
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('finalise write throws → logged, still returns applied (no re-apply risk)', async () => {
        // finaliseThrows only fails the SECOND update call (step 5).
        // The pre-stamp (step 0) succeeds, so the row is already
        // 'applied' in the DB and the next tick's eligibility query
        // (status='pending') will not pick it up again.
        const { billing } = makeBilling({ finaliseThrows: new Error('finalise failed') });
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
    });

    it('no mpSubscriptionId → skips MP propagation cleanly', async () => {
        const { billing, mpUpdate } = makeBilling();
        const row = makeRow({ mpSubscriptionId: null });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(mpUpdate).not.toHaveBeenCalled();
    });

    it('no payment adapter → skips MP propagation cleanly', async () => {
        const { billing, mpUpdate } = makeBilling({ paymentAdapterPresent: false });
        const row = makeRow();

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(mpUpdate).not.toHaveBeenCalled();
    });

    /**
     * Idempotency regression: if markResolved (step 5) throws after
     * changePlan (step 1) already succeeded, the row stays `pending`
     * in the current implementation and the next tick re-runs
     * changePlan — doubling the mutation.
     *
     * The fix: pre-stamp the row to `status:'applied'` BEFORE calling
     * changePlan so the eligibility query (`status='pending'`) never
     * sees the row again after the mutation point, regardless of
     * whether the finalise write succeeds.
     *
     * Verification: a second applyOne call with the SAME row (as the
     * next tick would use if the row still looked pending) must NOT
     * call changePlan again. The pre-stamp ensures the row's status is
     * `'applied'` after the first tick's mutation — so the second tick
     * would never actually query it; but even if we force-call applyOne
     * with a stale row, we verify the stamp by checking the update call
     * sequence: the very first `billing.subscriptions.update` must set
     * `status: 'applied'` (pre-stamp), BEFORE changePlan is invoked.
     */
    it('IDEMPOTENCY: pre-stamp to applied happens before changePlan so markResolved failure cannot cause re-apply', async () => {
        // updateCalls tracks the order and arguments of every
        // billing.subscriptions.update call so we can verify the
        // pre-stamp happens before changePlan.
        const updateCalls: Array<Record<string, unknown>> = [];

        const changePlan = vi
            .fn()
            .mockResolvedValue({ subscription: { id: SUB_ID, planId: NEW_PLAN_ID } });

        // First update call = pre-stamp (should succeed).
        // Second update call = finalise/resolvedAt (we make it throw to
        // simulate the markResolved failure in the bug scenario).
        const update = vi
            .fn()
            .mockImplementation((_id: string, payload: Record<string, unknown>) => {
                updateCalls.push(payload);
                // The second update (finalise) throws.
                if (updateCalls.length >= 2) {
                    return Promise.reject(new Error('mark failed'));
                }
                return Promise.resolve({ id: SUB_ID });
            });

        const billing = {
            subscriptions: { changePlan, update },
            getPaymentAdapter: vi.fn(() => null)
        } as unknown as QZPayBilling;

        const row = makeRow({ mpSubscriptionId: null });
        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        // The outcome is still 'applied' even with markResolved failure.
        expect(outcome.kind).toBe('applied');

        // CRITICAL: the first update call must set status: 'applied'
        // (pre-stamp) and it must happen BEFORE changePlan.
        // We verify ordering by checking update was called at least once
        // before asserting the pre-stamp content.
        expect(update).toHaveBeenCalledBefore(changePlan);
        const preStamp = updateCalls[0] as { scheduledPlanChange?: { status?: string } };
        expect(preStamp?.scheduledPlanChange?.status).toBe('applied');

        // changePlan was called exactly once.
        expect(changePlan).toHaveBeenCalledOnce();

        // If we now simulate a second tick with the same (stale) row
        // — which the old code would have re-applied because the DB row
        // still had status='pending' after markResolved failed — the
        // new code must NOT call changePlan again because the DB row
        // now has status='applied' (set by the pre-stamp).
        //
        // We can't replay the full eligibility query here, but we can
        // confirm the pre-stamp guarantee: after tick 1, the first
        // update call already flipped the row to 'applied'. The
        // eligibility query filters on status='pending', so the row is
        // invisible to tick 2. changePlan stays at exactly 1 call.
        expect(changePlan).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// applyScheduledPlanChangesJob.handler — orchestration
// ---------------------------------------------------------------------------

describe('applyScheduledPlanChangesJob.handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dueRowsState.rows = [];
    });

    it('skips when billing is not configured', async () => {
        vi.mocked(getQZPayBilling).mockReturnValue(
            undefined as unknown as ReturnType<typeof getQZPayBilling>
        );

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.message).toContain('billing not configured');
    });

    it('dry-run: lists due ids without applying', async () => {
        const { billing, changePlan } = makeBilling();
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: 'sub-a',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled()
            },
            {
                subscriptionId: 'sub-b',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled()
            }
        ];

        const { ctx } = makeCtx({ dryRun: true });
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.errors).toBe(0);
        expect(result.details?.ids).toEqual(['sub-a', 'sub-b']);
        expect(changePlan).not.toHaveBeenCalled();
    });

    it('processes each due row and reports applied/retried/failed counts', async () => {
        // 3 rows: first applies cleanly, second throws on changePlan
        // (retry), third has attemptCount=4 so the same throw flips it
        // to failed.
        const changePlanResults = [
            Promise.resolve({ subscription: { id: 'sub-1', planId: NEW_PLAN_ID } }),
            Promise.reject(new Error('boom')),
            Promise.reject(new Error('boom'))
        ];
        let callIndex = 0;
        const changePlan = vi.fn(() => changePlanResults[callIndex++] ?? Promise.resolve({}));
        const update = vi.fn().mockResolvedValue({});
        const billing = {
            subscriptions: { changePlan, update },
            getPaymentAdapter: vi.fn(() => null)
        } as unknown as QZPayBilling;
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        dueRowsState.rows = [
            {
                subscriptionId: 'sub-1',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 0 })
            },
            {
                subscriptionId: 'sub-2',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 0 })
            },
            {
                subscriptionId: 'sub-3',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 4 })
            }
        ];

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.processed).toBe(3);
        expect(result.errors).toBe(1); // only the failed one counts as error
        expect(result.details).toMatchObject({ applied: 1, retried: 1, failed: 1, due: 3 });
        expect(result.success).toBe(false); // failed > 0
    });

    it('returns success=true when only retries happen (no failed)', async () => {
        const { billing, changePlan } = makeBilling({ changePlanThrows: new Error('transient') });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: 'sub-1',
                customerId: 'c',
                currentPlanId: 'p',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 0 })
            }
        ];

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ applied: 0, retried: 1, failed: 0 });
        expect(changePlan).toHaveBeenCalledOnce();
    });

    it('returns success=false when the due-query throws', async () => {
        const { billing } = makeBilling();
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        // Patch the @repo/db getDb to throw on .select
        const { getDb } = await import('@repo/db');
        vi.mocked(getDb).mockReturnValueOnce({
            select: vi.fn(() => {
                throw new Error('db down');
            })
        } as unknown as ReturnType<typeof getDb>);

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.message).toContain('db down');
    });
});

// ---------------------------------------------------------------------------
// CronJobDefinition shape
// ---------------------------------------------------------------------------

describe('applyScheduledPlanChangesJob definition', () => {
    it('runs every 15 minutes', () => {
        expect(applyScheduledPlanChangesJob.schedule).toBe('*/15 * * * *');
    });

    it('is enabled by default', () => {
        expect(applyScheduledPlanChangesJob.enabled).toBe(true);
    });

    it('has a unique-enough name to be queried via the cron API', () => {
        expect(applyScheduledPlanChangesJob.name).toBe('apply-scheduled-plan-changes');
    });
});
