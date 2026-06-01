/**
 * Unit tests for the billing plans + prices seed (SPEC-141 Fase 2).
 *
 * The seed is idempotent and seeds both `billing_plans` and
 * `billing_prices` (monthly always, annual when the plan declares one).
 * `ensurePlan` and `ensurePrice` accept an injectable `db` parameter so
 * tests use an in-memory stub and never require a live database
 * connection.
 *
 * @module test/required/billingPlans.seed
 */

import type { PlanDefinition } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/billing — the dist is not built in this worktree.
// ensurePlan/ensurePrice tests use injectable `db` and do not call ALL_PLANS;
// these mocks prevent the module-resolution failure at import time.
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', () => ({
    ALL_PLANS: []
}));

// ---------------------------------------------------------------------------
// Mock the logger and summaryTracker so tests do not produce terminal noise.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: {
        trackSuccess: vi.fn(),
        trackError: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import under test — done AFTER vi.mock calls so hoisting works correctly.
// ---------------------------------------------------------------------------

import { _internals } from '../../src/required/billingPlans.seed.js';

// ---------------------------------------------------------------------------
// In-memory db stub matching the small slice of DrizzleClient the seed uses.
// ---------------------------------------------------------------------------

interface StubState {
    selectQueue: Array<Array<Record<string, unknown>>>;
    insertCalls: Array<{ table: unknown; values: Record<string, unknown> }>;
    returningResults: Array<Array<Record<string, unknown>>>;
}

function makeStubDb(state: StubState): DrizzleClient {
    function makeSelectChain<T>(rows: T[]) {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => rows
        };
        return chain;
    }

    function makeInsertChain(table: unknown) {
        return {
            values(values: Record<string, unknown>) {
                state.insertCalls.push({ table, values });
                const result = Promise.resolve(undefined) as unknown as Promise<unknown> & {
                    returning: () => Promise<Array<Record<string, unknown>>>;
                };
                result.returning = async () => state.returningResults.shift() ?? [];
                return result;
            }
        };
    }

    const stub = {
        select: () => makeSelectChain(state.selectQueue.shift() ?? []),
        insert: (table: unknown) => makeInsertChain(table)
    };
    return stub as unknown as DrizzleClient;
}

function makePlan(overrides: Partial<PlanDefinition> = {}): PlanDefinition {
    return {
        slug: 'plan-test',
        name: 'Test Plan',
        description: 'Test plan',
        category: 'owner',
        monthlyPriceArs: 1_000_000,
        annualPriceArs: 10_000_000,
        monthlyPriceUsdRef: 10,
        hasTrial: true,
        trialDays: 14,
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: [],
        ...overrides
    } as PlanDefinition;
}

function freshState(): StubState {
    return { selectQueue: [], insertCalls: [], returningResults: [] };
}

// ---------------------------------------------------------------------------
// ensurePlan
// ---------------------------------------------------------------------------

/**
 * Builds a DB row stub that exactly matches the given `PlanDefinition`,
 * ensuring no divergence is detected by `ensurePlan`.
 */
function makeMatchingDbRow(plan: PlanDefinition, id = 'existing-plan-uuid') {
    const limitsObj: Record<string, number> = {};
    for (const l of plan.limits) {
        limitsObj[l.key] = l.value;
    }
    return {
        id,
        description: plan.description,
        active: plan.isActive,
        entitlements: plan.entitlements,
        limits: limitsObj,
        metadata: {
            slug: plan.slug,
            displayName: plan.name,
            category: plan.category,
            isDefault: plan.isDefault,
            sortOrder: plan.sortOrder,
            trialDays: plan.trialDays,
            hasTrial: plan.hasTrial,
            monthlyPriceArs: plan.monthlyPriceArs,
            annualPriceArs: plan.annualPriceArs,
            monthlyPriceUsdRef: plan.monthlyPriceUsdRef
        }
    };
}

describe('ensurePlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns existing plan id when a row with the same name already exists (idempotent, no divergence)', async () => {
        const state = freshState();
        const plan = makePlan();
        state.selectQueue.push([makeMatchingDbRow(plan)]);

        const result = await _internals.ensurePlan(plan, false, makeStubDb(state));

        expect(result).toEqual({ planId: 'existing-plan-uuid', status: 'skipped' });
        expect(state.insertCalls).toHaveLength(0);
    });

    it('inserts a new row when no plan exists and returns its id', async () => {
        const state = freshState();
        state.selectQueue.push([]); // no existing plan
        state.returningResults.push([{ id: 'new-plan-uuid' }]);

        const result = await _internals.ensurePlan(
            makePlan({ name: 'Brand New' }),
            false,
            makeStubDb(state)
        );

        expect(result).toEqual({ planId: 'new-plan-uuid', status: 'created' });
        expect(state.insertCalls).toHaveLength(1);
        const inserted = state.insertCalls[0]?.values;
        // `billing_plans.name` stores the slug (the QZPay backend resolves
        // plans by it). The human label travels in metadata.displayName.
        expect(inserted?.name).toBe('plan-test');
        expect(inserted?.active).toBe(true);
        expect(inserted?.livemode).toBe(false);
        const metadata = inserted?.metadata as Record<string, unknown>;
        expect(metadata.slug).toBe('plan-test');
        expect(metadata.displayName).toBe('Brand New');
        expect(metadata.monthlyPriceArs).toBe(1_000_000);
        expect(metadata.annualPriceArs).toBe(10_000_000);
    });

    it('throws when insert returns no row (defensive)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        state.returningResults.push([]); // insert returns nothing

        await expect(
            _internals.ensurePlan(
                makePlan({ slug: 'crash-plan', name: 'Crash' }),
                false,
                makeStubDb(state)
            )
            // The error identifies the plan by slug — that's what
            // `billing_plans.name` stores and what downstream lookups use.
        ).rejects.toThrow(/Insert of plan "crash-plan" returned no row/);
    });

    it('forwards livemode=true to the insert', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        state.returningResults.push([{ id: 'plan-with-livemode' }]);

        await _internals.ensurePlan(makePlan(), true, makeStubDb(state));

        expect(state.insertCalls[0]?.values.livemode).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ensurePrice
// ---------------------------------------------------------------------------

describe('ensurePrice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('skips when a matching active price already exists for the (plan, currency, interval) tuple', async () => {
        const state = freshState();
        state.selectQueue.push([{ id: 'existing-price' }]);

        const result = await _internals.ensurePrice(
            {
                planId: 'plan-uuid',
                unitAmount: 1_500_000,
                billingInterval: 'month',
                trialDays: 14,
                hasTrial: true,
                livemode: false
            },
            makeStubDb(state)
        );

        expect(result).toBe('skipped');
        expect(state.insertCalls).toHaveLength(0);
    });

    it('inserts a monthly price with trialDays when the plan declares a trial', async () => {
        const state = freshState();
        state.selectQueue.push([]);

        const result = await _internals.ensurePrice(
            {
                planId: 'plan-uuid',
                unitAmount: 1_500_000,
                billingInterval: 'month',
                trialDays: 14,
                hasTrial: true,
                livemode: false
            },
            makeStubDb(state)
        );

        expect(result).toBe('created');
        const inserted = state.insertCalls[0]?.values;
        expect(inserted?.planId).toBe('plan-uuid');
        expect(inserted?.unitAmount).toBe(1_500_000);
        expect(inserted?.billingInterval).toBe('month');
        expect(inserted?.currency).toBe('ARS');
        expect(inserted?.intervalCount).toBe(1);
        expect(inserted?.active).toBe(true);
        expect(inserted?.livemode).toBe(false);
        expect(inserted?.trialDays).toBe(14);
    });

    it('omits trialDays on annual prices (Hospeda model: trial belongs to monthly preapproval only)', async () => {
        const state = freshState();
        state.selectQueue.push([]);

        const result = await _internals.ensurePrice(
            {
                planId: 'plan-uuid',
                unitAmount: 15_000_000,
                billingInterval: 'year',
                trialDays: 14,
                hasTrial: true,
                livemode: true
            },
            makeStubDb(state)
        );

        expect(result).toBe('created');
        const inserted = state.insertCalls[0]?.values;
        expect(inserted?.billingInterval).toBe('year');
        expect(inserted?.trialDays).toBeUndefined();
    });

    it('omits trialDays on monthly prices when hasTrial=false (e.g., free plans)', async () => {
        const state = freshState();
        state.selectQueue.push([]);

        await _internals.ensurePrice(
            {
                planId: 'plan-uuid',
                unitAmount: 0,
                billingInterval: 'month',
                trialDays: 0,
                hasTrial: false,
                livemode: false
            },
            makeStubDb(state)
        );

        const inserted = state.insertCalls[0]?.values;
        expect(inserted?.trialDays).toBeUndefined();
    });

    it('forwards livemode=true verbatim to the insert', async () => {
        const state = freshState();
        state.selectQueue.push([]);

        await _internals.ensurePrice(
            {
                planId: 'plan-uuid',
                unitAmount: 1_500_000,
                billingInterval: 'month',
                trialDays: 0,
                hasTrial: false,
                livemode: true
            },
            makeStubDb(state)
        );

        expect(state.insertCalls[0]?.values.livemode).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// detectDivergences (SPEC-168 T-018)
// ---------------------------------------------------------------------------

describe('detectDivergences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array when DB row matches seed config exactly', () => {
        const plan = makePlan();
        const limitsObj: Record<string, number> = {};
        for (const l of plan.limits) {
            limitsObj[l.key] = l.value;
        }
        const dbRow = {
            description: plan.description,
            active: plan.isActive,
            entitlements: plan.entitlements,
            limits: limitsObj,
            metadata: {
                displayName: plan.name,
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs
            }
        };

        const diffs = _internals.detectDivergences(plan, dbRow);

        expect(diffs).toHaveLength(0);
    });

    it('detects divergence in description', () => {
        const plan = makePlan({ description: 'Config description' });
        const dbRow = {
            description: 'Runtime-edited description',
            active: plan.isActive,
            entitlements: plan.entitlements,
            limits: {},
            metadata: {
                displayName: plan.name,
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs
            }
        };

        const diffs = _internals.detectDivergences(plan, dbRow);

        const descDiff = diffs.find((d) => d.field === 'description');
        expect(descDiff).toBeDefined();
        expect(descDiff?.config).toBe('Config description');
        expect(descDiff?.db).toBe('Runtime-edited description');
    });

    it('detects divergence in active flag', () => {
        const plan = makePlan({ isActive: true });
        const dbRow = {
            description: plan.description,
            active: false, // operator deactivated via admin UI
            entitlements: plan.entitlements,
            limits: {},
            metadata: {
                displayName: plan.name,
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs
            }
        };

        const diffs = _internals.detectDivergences(plan, dbRow);

        const activeDiff = diffs.find((d) => d.field === 'active');
        expect(activeDiff).toBeDefined();
        expect(activeDiff?.config).toBe(true);
        expect(activeDiff?.db).toBe(false);
    });

    it('detects divergence in monthlyPriceArs', () => {
        const plan = makePlan({ monthlyPriceArs: 1_000_000 });
        const dbRow = {
            description: plan.description,
            active: plan.isActive,
            entitlements: plan.entitlements,
            limits: {},
            metadata: {
                displayName: plan.name,
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: 1_500_000, // price changed via admin UI
                annualPriceArs: plan.annualPriceArs
            }
        };

        const diffs = _internals.detectDivergences(plan, dbRow);

        const priceDiff = diffs.find((d) => d.field === 'metadata.monthlyPriceArs');
        expect(priceDiff).toBeDefined();
        expect(priceDiff?.config).toBe(1_000_000);
        expect(priceDiff?.db).toBe(1_500_000);
    });

    it('detects multiple simultaneous divergences', () => {
        const plan = makePlan({ description: 'Original', monthlyPriceArs: 500_000 });
        const dbRow = {
            description: 'Edited description',
            active: plan.isActive,
            entitlements: plan.entitlements,
            limits: {},
            metadata: {
                displayName: 'Edited Display Name',
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: 999_000,
                annualPriceArs: plan.annualPriceArs
            }
        };

        const diffs = _internals.detectDivergences(plan, dbRow);

        const fields = diffs.map((d) => d.field);
        expect(fields).toContain('description');
        expect(fields).toContain('metadata.displayName');
        expect(fields).toContain('metadata.monthlyPriceArs');
        expect(diffs.length).toBeGreaterThanOrEqual(3);
    });
});

// ---------------------------------------------------------------------------
// ensurePlan divergence policy (SPEC-168 T-018)
// ---------------------------------------------------------------------------

describe('ensurePlan — divergence policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns status "diverged" and does NOT insert when DB row differs from config', async () => {
        const plan = makePlan({ monthlyPriceArs: 1_000_000 });
        const state = freshState();
        // DB row has a different monthlyPriceArs in metadata (operator edited via admin UI)
        state.selectQueue.push([
            {
                id: 'existing-plan-uuid',
                description: plan.description,
                active: plan.isActive,
                entitlements: plan.entitlements,
                limits: {},
                metadata: {
                    displayName: plan.name,
                    category: plan.category,
                    isDefault: plan.isDefault,
                    sortOrder: plan.sortOrder,
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    monthlyPriceArs: 9_999_999, // diverged
                    annualPriceArs: plan.annualPriceArs
                }
            }
        ]);

        const result = await _internals.ensurePlan(plan, false, makeStubDb(state));

        // Must return the existing plan id and signal divergence
        expect(result.planId).toBe('existing-plan-uuid');
        expect(result.status).toBe('diverged');
        // Must NOT insert a new row (no clobber)
        expect(state.insertCalls).toHaveLength(0);
    });

    it('does NOT overwrite runtime-edited fields on re-seed (no clobber guarantee)', async () => {
        // Simulate: plan was seeded, operator changed description and price via admin UI,
        // then the seed is re-run.
        const plan = makePlan({
            description: 'Seed description',
            monthlyPriceArs: 1_000_000
        });
        const state = freshState();
        state.selectQueue.push([
            {
                id: 'runtime-edited-plan-uuid',
                description: 'Operator-edited description', // changed via admin UI
                active: plan.isActive,
                entitlements: plan.entitlements,
                limits: {},
                metadata: {
                    displayName: plan.name,
                    category: plan.category,
                    isDefault: plan.isDefault,
                    sortOrder: plan.sortOrder,
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    monthlyPriceArs: 2_500_000, // edited via admin UI
                    annualPriceArs: plan.annualPriceArs
                }
            }
        ]);

        const result = await _internals.ensurePlan(plan, false, makeStubDb(state));

        // Result: diverged, not inserted
        expect(result.status).toBe('diverged');
        // Absolutely no inserts — the DB row is untouched
        expect(state.insertCalls).toHaveLength(0);
    });

    it('emits a warn log listing diverged fields when config and DB differ', async () => {
        // The logger is mocked at the module level; spy on the mock's warn function
        const loggerModule = await import('../../src/utils/logger.js');
        const warnSpy = vi.spyOn(loggerModule.logger, 'warn');

        const plan = makePlan({ description: 'Config' });
        const state = freshState();
        state.selectQueue.push([
            {
                id: 'plan-uuid',
                description: 'DB edited', // diverged
                active: plan.isActive,
                entitlements: plan.entitlements,
                limits: {},
                metadata: {
                    displayName: plan.name,
                    category: plan.category,
                    isDefault: plan.isDefault,
                    sortOrder: plan.sortOrder,
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    monthlyPriceArs: plan.monthlyPriceArs,
                    annualPriceArs: plan.annualPriceArs
                }
            }
        ]);

        await _internals.ensurePlan(plan, false, makeStubDb(state));

        // At least one warn call mentioning the divergence
        expect(warnSpy).toHaveBeenCalled();
        const allWarnArgs = warnSpy.mock.calls.map((c) => String(c[0]));
        const hasDivergenceWarning = allWarnArgs.some(
            (s) => s.includes('diverged') || s.includes('description')
        );
        expect(hasDivergenceWarning).toBe(true);
    });
});
