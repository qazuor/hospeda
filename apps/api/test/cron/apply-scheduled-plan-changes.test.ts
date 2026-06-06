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
 * SPEC-167 T-013 additions:
 * - Downgrade: applyDowngradeRestrictions called after changePlan succeeds,
 *   before clearEntitlementCache (ordering), with keepSelections from metadata.
 * - Non-downgrade (upgrade): applyDowngradeRestrictions NOT called.
 * - Restriction failure: job continues (plan change stays applied),
 *   result.success=false so SPEC-149 Sentry capture fires.
 * - Restriction failure: pre-stamp idempotency untouched (row stays 'applied').
 *
 * @module test/cron/apply-scheduled-plan-changes
 */

import type { QZPayBilling, QZPayScheduledPlanChange } from '@qazuor/qzpay-core';
import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// SPEC-167 T-017: mock sendNotification for confirmation notification tests.
const { sendNotificationMock } = vi.hoisted(() => ({ sendNotificationMock: vi.fn() }));
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: sendNotificationMock
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

// SPEC-167 T-013: mock the downgrade restriction service.
vi.mock('../../src/services/plan-downgrade-remediation.service', () => ({
    applyDowngradeRestrictions: vi.fn().mockResolvedValue({
        restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
        keptBySelection: { accommodations: [], promotions: [] },
        keptByDefault: { accommodations: [], promotions: [] },
        grandfatherFlags: []
    })
}));

// SPEC-167 T-013: mock resolveOwnerUserId (subscription-pause service).
vi.mock('../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: vi.fn().mockResolvedValue('user-1')
}));

// SPEC-167 T-013: mock getKeepSelectionsForChange (subscription-downgrade service).
vi.mock('../../src/services/subscription-downgrade.service', () => ({
    getKeepSelectionsForChange: vi.fn().mockReturnValue(undefined)
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
import { applyDowngradeRestrictions } from '../../src/services/plan-downgrade-remediation.service';
import { getKeepSelectionsForChange } from '../../src/services/subscription-downgrade.service';
import { resolveOwnerUserId } from '../../src/services/subscription-pause.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUB_ID = 'sub-1';
const CUSTOMER_ID = 'cust-1';
const USER_ID = 'user-1';
const OLD_PLAN_ID = 'plan_pro';
const NEW_PLAN_ID = 'plan_basic';
const NEW_PLAN_SLUG = 'owner-basico';
const NEW_PRICE_ID = 'price_basic_monthly';
const MP_SUB_ID = 'mp-pre-1';

/**
 * Direction of the scheduled change. Controls whether `metadata.source` is
 * set to `'plan-change-downgrade'` (SPEC-167 T-013 direction detection).
 */
type ChangeDirection = 'downgrade' | 'upgrade' | 'none';

function makeScheduled(
    overrides: Partial<QZPayScheduledPlanChange> & { direction?: ChangeDirection } = {}
): QZPayScheduledPlanChange {
    const { direction = 'downgrade', ...rest } = overrides;
    const metadata =
        direction === 'downgrade'
            ? { source: 'plan-change-downgrade', previousPlanId: OLD_PLAN_ID }
            : direction === 'upgrade'
              ? { source: 'plan-change-upgrade' }
              : undefined;
    return {
        newPlanId: NEW_PLAN_ID,
        newPriceId: NEW_PRICE_ID,
        targetTransactionAmountMajor: 5_000,
        applyAt: '2026-06-01T00:00:00.000Z',
        requestedAt: '2026-05-15T00:00:00.000Z',
        status: 'pending',
        attemptCount: 0,
        ...(metadata !== undefined ? { metadata } : {}),
        ...rest
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
    /** Plan slug returned by billing.plans.get(planId) (default: NEW_PLAN_SLUG). */
    planSlug?: string | null;
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

    // billing.plans.get — used by the cron to resolve the target plan slug and
    // plan names for the PLAN_CHANGE_CONFIRMATION notification (T-017).
    const planSlug = opts.planSlug === undefined ? NEW_PLAN_SLUG : opts.planSlug;
    const planGet = vi.fn().mockResolvedValue(planSlug !== null ? { name: planSlug } : null);

    // billing.customers.get — used by the cron for PLAN_CHANGE_CONFIRMATION (T-017).
    // Default: returns a minimal customer so notification tests don't fail on null.
    const customersGet = vi.fn().mockResolvedValue({
        id: CUSTOMER_ID,
        email: 'customer@example.com',
        metadata: { name: 'Test Customer', userId: USER_ID }
    });

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
            customers: { get: customersGet },
            plans: { get: planGet },
            getPaymentAdapter: vi.fn(() => paymentAdapter)
        } as unknown as QZPayBilling,
        changePlan,
        mpUpdate,
        update,
        planGet,
        customersGet,
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
        // Use mockReset + set defaults instead of clearAllMocks to prevent
        // sticky mockRejectedValue leaking between tests (T-012 lesson).
        sendNotificationMock.mockReset().mockResolvedValue(undefined);
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
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
        // Use mockReset + defaults to prevent sticky mockRejectedValue (T-012 lesson).
        sendNotificationMock.mockReset().mockResolvedValue(undefined);
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
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
// CronJobResult error-contract pin (SPEC-194 T-024)
//
// Purpose: verifies that the handler's CronJobResult has `failed > 0` AND
// `success = false` whenever MAX_APPLY_ATTEMPTS is exhausted for at least one
// row.  SPEC-149's Sentry wiring will rely on this contract
// (success=false triggers capture; errors>0 carries the count).
// ---------------------------------------------------------------------------

describe('CronJobResult error contract: MAX_APPLY_ATTEMPTS exhaustion', () => {
    beforeEach(() => {
        sendNotificationMock.mockReset().mockResolvedValue(undefined);
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
        dueRowsState.rows = [];
    });

    it('single row exhausted: result.failed > 0 AND result.success = false', async () => {
        // Arrange: changePlan always throws and the row starts at
        // attemptCount = MAX_APPLY_ATTEMPTS - 1 = 4 so the next failure
        // exhausts the budget.
        const { billing } = makeBilling({ changePlanThrows: new Error('provider down') });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: 'sub-exhausted',
                customerId: 'c',
                currentPlanId: 'old-plan',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 4 }) // 4 + 1 = 5 = MAX
            }
        ];

        // Act
        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        // Assert — error contract pinned for SPEC-149 Sentry wiring
        expect(result.success).toBe(false);
        expect(result.errors).toBeGreaterThan(0);
        expect(result.details).toMatchObject({ failed: 1 });
    });

    it('all rows exhausted: result.failed equals row count AND result.success = false', async () => {
        // Arrange: two rows, both start at attemptCount=4 (one tick from budget end).
        const { billing } = makeBilling({ changePlanThrows: new Error('storage offline') });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: 'sub-a',
                customerId: 'c',
                currentPlanId: 'old-plan',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 4 })
            },
            {
                subscriptionId: 'sub-b',
                customerId: 'c',
                currentPlanId: 'old-plan',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 4 })
            }
        ];

        // Act
        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(2);
        expect(result.details).toMatchObject({ failed: 2, applied: 0, retried: 0 });
    });

    it('errors field equals the failed count (not total rows)', async () => {
        // Arrange: one row exhausted, one row applied cleanly — only the
        // exhausted row must appear in errors.
        const changePlanResults: Promise<unknown>[] = [
            Promise.resolve({ subscription: { id: 'sub-ok', planId: NEW_PLAN_ID } }),
            Promise.reject(new Error('exhausted'))
        ];
        let callIdx = 0;
        const changePlan = vi.fn(() => changePlanResults[callIdx++] ?? Promise.resolve({}));
        const billing = {
            subscriptions: {
                changePlan,
                update: vi.fn().mockResolvedValue({})
            },
            getPaymentAdapter: vi.fn(() => null)
        } as unknown as QZPayBilling;
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        dueRowsState.rows = [
            {
                subscriptionId: 'sub-ok',
                customerId: 'c',
                currentPlanId: 'old-plan',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 0 })
            },
            {
                subscriptionId: 'sub-exhausted',
                customerId: 'c',
                currentPlanId: 'old-plan',
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ attemptCount: 4 })
            }
        ];

        // Act
        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1); // only the exhausted row
        expect(result.processed).toBe(2); // both rows processed
        expect(result.details).toMatchObject({ applied: 1, failed: 1, retried: 0 });
    });
});

// ---------------------------------------------------------------------------
// SPEC-167 T-013: Downgrade restriction wiring
//
// Purpose: verifies that applyDowngradeRestrictions is called correctly
// for downgrade scheduled changes, NOT called for upgrades, and that
// restriction failures are handled as soft-fails (plan change stays applied,
// result.success=false so SPEC-149 Sentry capture fires).
// ---------------------------------------------------------------------------

describe('SPEC-167 T-013: downgrade restriction wiring (applyOne)', () => {
    beforeEach(() => {
        sendNotificationMock.mockReset().mockResolvedValue(undefined);
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
    });

    it('downgrade: applyDowngradeRestrictions called after changePlan succeeds', async () => {
        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(applyDowngradeRestrictions).toHaveBeenCalledOnce();
        expect(applyDowngradeRestrictions).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: NEW_PLAN_SLUG
            })
        );
    });

    it('downgrade: keepSelections from metadata passed to applyDowngradeRestrictions', async () => {
        const keepSels = { accommodationIds: ['acc-1', 'acc-2'], promotionIds: [] };
        vi.mocked(getKeepSelectionsForChange).mockReturnValue(keepSels);

        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        await _internals.applyOne(row, billing, makeCtx().logger);

        expect(applyDowngradeRestrictions).toHaveBeenCalledWith(
            expect.objectContaining({ keepSelections: keepSels })
        );
    });

    it('upgrade: applyDowngradeRestrictions NOT called for upgrade changeType', async () => {
        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'upgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(applyDowngradeRestrictions).not.toHaveBeenCalled();
    });

    it('no metadata.source: applyDowngradeRestrictions NOT called (safe default for legacy rows)', async () => {
        // A change without metadata.source (legacy row before SPEC-167) — must not
        // crash and must not call restrictions (cannot confirm direction, so skip).
        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'none' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(applyDowngradeRestrictions).not.toHaveBeenCalled();
    });

    it('restriction BEFORE cache clear: applyDowngradeRestrictions called before clearEntitlementCache', async () => {
        // Ordering: restriction must happen BEFORE cache clear so the cache
        // reflects the post-restriction state when first invalidated.
        const callOrder: string[] = [];
        vi.mocked(applyDowngradeRestrictions).mockImplementation(async () => {
            callOrder.push('restriction');
            return {
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            };
        });
        vi.mocked(clearEntitlementCache).mockImplementation((_id: string) => {
            callOrder.push('cacheClean');
        });

        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        await _internals.applyOne(row, billing, makeCtx().logger);

        const restrictionIdx = callOrder.indexOf('restriction');
        const cacheIdx = callOrder.indexOf('cacheClean');
        expect(restrictionIdx).toBeGreaterThanOrEqual(0);
        expect(cacheIdx).toBeGreaterThanOrEqual(0);
        expect(restrictionIdx).toBeLessThan(cacheIdx);
    });

    it('restriction failure: plan change stays applied (outcome kind = applied)', async () => {
        // Failure semantics (SPEC-167 T-013): restriction failure must NOT roll
        // back the applied plan change. The pre-stamp from step 0 is already
        // committed; the plan change is considered successful.
        vi.mocked(applyDowngradeRestrictions).mockRejectedValue(new Error('restriction tx failed'));
        const { billing, update } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        // Plan change is still 'applied' — restriction failure does NOT roll back.
        expect(outcome.kind).toBe('applied');
        // update is called for pre-stamp (step 0) + finalise (step 5) — NOT rolled back.
        expect(update).toHaveBeenCalledTimes(2);
        const preStampArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const preStamp = preStampArg.scheduledPlanChange as Record<string, unknown>;
        expect(preStamp.status).toBe('applied');
    });

    it('restriction failure: result includes restrictionFailed=true flag', async () => {
        // The applyOne return value carries a flag so the handler can count the
        // restriction failure as result.success=false for Sentry capture.
        vi.mocked(applyDowngradeRestrictions).mockRejectedValue(new Error('restriction tx failed'));
        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        // The outcome carries a restrictionFailed flag so the handler can set
        // result.success=false.
        expect((outcome as { restrictionFailed?: boolean }).restrictionFailed).toBe(true);
    });

    it('restriction failure: userId cannot be resolved → restriction skipped (no crash)', async () => {
        vi.mocked(resolveOwnerUserId).mockResolvedValue(null);

        const { billing } = makeBilling();
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        expect(applyDowngradeRestrictions).not.toHaveBeenCalled();
    });

    it('target plan slug not in billing catalog → restrictionFailed=true, result.success=false, plan change stays applied', async () => {
        // SPEC-167 hard semantics: if billing.plans.get resolves a name but that name
        // is not a valid catalog slug, computeDowngradeExcess (called inside
        // applyDowngradeRestrictions) throws "Target plan '...' not found in the billing
        // catalog". The cron treats this as restrictionFailed=true rather than rolling back
        // the plan change — the host is now over-cap, which is an alert-worthy revenue-leak
        // risk captured by Sentry via result.success=false (SPEC-149 gate).
        //
        // In the unit test, applyDowngradeRestrictions is mocked, so we simulate the
        // catalog-miss by having it throw. This pins the intentional hard semantics:
        // plan change stays applied, restrictionFailed=true, handler sees success=false.
        vi.mocked(applyDowngradeRestrictions).mockRejectedValue(
            new Error("Target plan 'non-catalog-slug' not found in the billing catalog")
        );
        const { billing, update } = makeBilling({ planSlug: 'non-catalog-slug' });
        const row = makeRow({
            scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
        });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        // Plan change stays applied — restriction failure does NOT roll back.
        expect(outcome.kind).toBe('applied');
        expect((outcome as { restrictionFailed?: boolean }).restrictionFailed).toBe(true);
        // update is called for pre-stamp (step 0) + finalise (step 5) — not rolled back.
        expect(update).toHaveBeenCalledTimes(2);
        const preStampArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const preStamp = preStampArg.scheduledPlanChange as Record<string, unknown>;
        expect(preStamp.status).toBe('applied');
    });
});

describe('SPEC-167 T-013: downgrade restriction wiring (handler result)', () => {
    beforeEach(() => {
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
        dueRowsState.rows = [];
    });

    it('restriction failure for a downgrade row → handler result.success=false (SPEC-149 Sentry)', async () => {
        // CRITICAL: restriction failure must NOT roll back the plan change but
        // MUST set result.success=false so SPEC-149's bootstrap Sentry capture fires.
        vi.mocked(applyDowngradeRestrictions).mockRejectedValue(new Error('restriction tx failed'));
        const { billing } = makeBilling();
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                currentPlanId: OLD_PLAN_ID,
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
            }
        ];

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        // Plan change applied: processed=1, but success=false due to restriction error.
        expect(result.processed).toBe(1);
        expect(result.success).toBe(false);
        // The plan change itself is 'applied' — not a retry or failed plan change.
        expect(result.details).toMatchObject({ applied: 1, retried: 0, failed: 0 });
    });

    it('restriction failure for one row, plain apply for another → success=false, correct counts', async () => {
        // First row: downgrade with restriction failure. Second: clean downgrade.
        let restrictionCallCount = 0;
        vi.mocked(applyDowngradeRestrictions).mockImplementation(async () => {
            restrictionCallCount += 1;
            if (restrictionCallCount === 1) throw new Error('restriction tx failed');
            return {
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            };
        });

        const { billing } = makeBilling();
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        dueRowsState.rows = [
            {
                subscriptionId: 'sub-fail',
                customerId: CUSTOMER_ID,
                currentPlanId: OLD_PLAN_ID,
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
            },
            {
                subscriptionId: 'sub-ok',
                customerId: CUSTOMER_ID,
                currentPlanId: OLD_PLAN_ID,
                mpSubscriptionId: null,
                scheduledPlanChange: makeScheduled({ direction: 'downgrade' })
            }
        ];

        const { ctx } = makeCtx();
        const result = await applyScheduledPlanChangesJob.handler(ctx);

        expect(result.processed).toBe(2);
        expect(result.success).toBe(false);
        // Both plan changes applied; restriction failure on one doesn't affect plan counts.
        expect(result.details).toMatchObject({ applied: 2, retried: 0, failed: 0 });
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

// ---------------------------------------------------------------------------
// SPEC-167 T-017: PLAN_CHANGE_CONFIRMATION notification at apply time
//
// Rules:
//   - Confirmation sent once per applied change (after changePlan succeeds)
//   - Payload carries oldPlanName + newPlanName + recipientEmail/Name
//   - Send failure does NOT flip result.success — notification is informational,
//     unlike restriction failure (asymmetry documented in code comment)
//   - NOT sent when changePlan fails (retry/failed outcome)
// ---------------------------------------------------------------------------

/**
 * Makes a billing mock with specific customers/plans for T-017 confirmation tests.
 * Uses makeBilling base but overrides customer and plan name resolution.
 */
function makeBillingWithCustomers(
    opts: BillingMockOpts & {
        customerEmail?: string;
        customerName?: string;
        oldPlanName?: string;
        newPlanName?: string;
    } = {}
) {
    const base = makeBilling(opts);
    const customerEmail = opts.customerEmail ?? 'host@example.com';
    const customerName = opts.customerName ?? 'Test Host';
    const oldPlanName = opts.oldPlanName ?? 'owner-pro';
    const newPlanName = opts.newPlanName ?? NEW_PLAN_SLUG;
    const customersGet = vi.fn().mockResolvedValue({
        id: CUSTOMER_ID,
        email: customerEmail,
        metadata: { name: customerName }
    });
    // Override plans.get to return distinct names for old and new plan.
    const plansGet = vi.fn().mockImplementation((id: string) => {
        if (id === NEW_PLAN_ID) return Promise.resolve({ name: newPlanName });
        return Promise.resolve({ name: oldPlanName });
    });
    return {
        ...base,
        billing: {
            ...base.billing,
            customers: { get: customersGet },
            plans: { get: plansGet }
        } as unknown as QZPayBilling,
        customersGet,
        plansGet
    };
}

describe('SPEC-167 T-017: PLAN_CHANGE_CONFIRMATION notification at apply time (applyOne)', () => {
    beforeEach(() => {
        sendNotificationMock.mockReset().mockResolvedValue(undefined);
        vi.mocked(applyDowngradeRestrictions)
            .mockReset()
            .mockResolvedValue({
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            });
        vi.mocked(resolveOwnerUserId).mockReset().mockResolvedValue(USER_ID);
        vi.mocked(getKeepSelectionsForChange).mockReset().mockReturnValue(undefined);
        vi.mocked(handlePlanChangeAddonRecalculation).mockClear();
        vi.mocked(clearEntitlementCache).mockReset();
    });

    it('sends PLAN_CHANGE_CONFIRMATION after changePlan succeeds', async () => {
        const { billing } = makeBillingWithCustomers();
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'downgrade' }) });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        const calls = sendNotificationMock.mock.calls as Array<[{ type: string }]>;
        const confirmCalls = calls.filter(
            ([p]) => p.type === NotificationType.PLAN_CHANGE_CONFIRMATION
        );
        expect(confirmCalls.length).toBe(1);
    });

    it('confirmation payload carries oldPlanName, newPlanName, recipientEmail, recipientName', async () => {
        const { billing } = makeBillingWithCustomers({
            customerEmail: 'owner@test.com',
            customerName: 'Owner Name',
            oldPlanName: 'owner-pro',
            newPlanName: 'owner-basico'
        });
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'downgrade' }) });

        await _internals.applyOne(row, billing, makeCtx().logger);

        const calls = sendNotificationMock.mock.calls as Array<[Record<string, unknown>]>;
        const confirmCall = calls.find(
            ([p]) => p.type === NotificationType.PLAN_CHANGE_CONFIRMATION
        );
        expect(confirmCall).toBeDefined();
        const payload = confirmCall?.[0];
        expect(payload?.recipientEmail).toBe('owner@test.com');
        expect(payload?.recipientName).toBe('Owner Name');
        expect(payload?.oldPlanName).toBe('owner-pro');
        expect(payload?.newPlanName).toBe('owner-basico');
        expect(payload?.userId).toBeDefined();
    });

    it('exactly once per applied change — not sent when changePlan fails (retry outcome)', async () => {
        const { billing } = makeBillingWithCustomers({
            changePlanThrows: new Error('provider down')
        });
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'downgrade' }) });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('retry');
        const calls = sendNotificationMock.mock.calls as Array<[{ type: string }]>;
        const confirmCalls = calls.filter(
            ([p]) => p.type === NotificationType.PLAN_CHANGE_CONFIRMATION
        );
        expect(confirmCalls.length).toBe(0);
    });

    it('confirmation send failure does NOT flip result.success (informational — asymmetry with restriction)', async () => {
        sendNotificationMock.mockRejectedValue(new Error('email service down'));
        const { billing } = makeBillingWithCustomers();
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'downgrade' }) });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        // Notification failure must not affect the plan-change outcome.
        expect(outcome.kind).toBe('applied');
        // Unlike restriction failure, no restrictionFailed flag — the cron result.success stays true.
        expect((outcome as { restrictionFailed?: boolean }).restrictionFailed).toBeUndefined();
    });

    it('confirmation also sent for non-downgrade (upgrade) changes applied via the cron (edge case)', async () => {
        // Upgrades don't normally go through this cron (they apply via webhook),
        // but if one does arrive (e.g. manual seed), confirmation should still fire.
        const { billing } = makeBillingWithCustomers();
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'upgrade' }) });

        const outcome = await _internals.applyOne(row, billing, makeCtx().logger);

        expect(outcome.kind).toBe('applied');
        const calls = sendNotificationMock.mock.calls as Array<[{ type: string }]>;
        const confirmCalls = calls.filter(
            ([p]) => p.type === NotificationType.PLAN_CHANGE_CONFIRMATION
        );
        expect(confirmCalls.length).toBe(1);
    });

    it('confirmation customer lookup failure: warn log, notification skipped, plan change still applied', async () => {
        const base = makeBilling();
        // Override customers.get to throw.
        const billing = {
            ...base.billing,
            customers: { get: vi.fn().mockRejectedValue(new Error('customer not found')) },
            plans: { get: vi.fn().mockResolvedValue({ name: NEW_PLAN_SLUG }) }
        } as unknown as QZPayBilling;
        const row = makeRow({ scheduledPlanChange: makeScheduled({ direction: 'downgrade' }) });
        const { logger } = makeCtx();

        const outcome = await _internals.applyOne(row, billing, logger);

        expect(outcome.kind).toBe('applied');
        // Notification skipped (no confirmation sent)
        const calls = sendNotificationMock.mock.calls as Array<[{ type: string }]>;
        const confirmCalls = calls.filter(
            ([p]) => p.type === NotificationType.PLAN_CHANGE_CONFIRMATION
        );
        expect(confirmCalls.length).toBe(0);
        // Warn logged (soft-fail)
        expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    });
});
