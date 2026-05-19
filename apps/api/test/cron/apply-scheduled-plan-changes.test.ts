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
    updateThrows?: Error;
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

    const update = opts.updateThrows
        ? vi.fn().mockRejectedValue(opts.updateThrows)
        : vi.fn().mockResolvedValue({ id: SUB_ID });

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
        expect(update).toHaveBeenCalledOnce();
        const updateArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const scheduled = updateArg.scheduledPlanChange as Record<string, unknown>;
        expect(scheduled.status).toBe('applied');
        expect(scheduled.attemptCount).toBe(1);
        expect(scheduled.resolvedAt).toBeDefined();
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

        // Mark write happened with status: 'pending', attemptCount: 1.
        const updateArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const scheduled = updateArg.scheduledPlanChange as Record<string, unknown>;
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

        const updateArg = update.mock.calls[0]?.[1] as Record<string, unknown>;
        const scheduled = updateArg.scheduledPlanChange as Record<string, unknown>;
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

    it('mark-applied write throws → logged, still returns applied (next tick re-marks)', async () => {
        const { billing } = makeBilling({ updateThrows: new Error('mark failed') });
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
