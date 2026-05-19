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

describe('ensurePlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns existing plan id when a row with the same name already exists (idempotent)', async () => {
        const state = freshState();
        state.selectQueue.push([{ id: 'existing-plan-uuid' }]);

        const result = await _internals.ensurePlan(makePlan(), false, makeStubDb(state));

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
        expect(inserted?.name).toBe('Brand New');
        expect(inserted?.active).toBe(true);
        expect(inserted?.livemode).toBe(false);
        const metadata = inserted?.metadata as Record<string, unknown>;
        expect(metadata.slug).toBe('plan-test');
        expect(metadata.monthlyPriceArs).toBe(1_000_000);
        expect(metadata.annualPriceArs).toBe(10_000_000);
    });

    it('throws when insert returns no row (defensive)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        state.returningResults.push([]); // insert returns nothing

        await expect(
            _internals.ensurePlan(makePlan({ name: 'Crash' }), false, makeStubDb(state))
        ).rejects.toThrow(/Insert of plan "Crash" returned no row/);
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
