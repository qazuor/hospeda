/**
 * Regression tests for the commerce plan seed (HOS-1290).
 *
 * Before HOS-1290, `seedCommercePlan` had its own bespoke "insert if missing,
 * else only re-stamp `product_domain`" routine (`ensureCommercePlan`). A
 * config edit that added a `LimitKey` (or an entitlement, or a description)
 * to an ALREADY-SEEDED gastronomy/experience plan NEVER reached staging or
 * production — the seed saw an existing row, logged "skipped", and moved on.
 *
 * HOS-1290 replaces that bespoke routine with the SAME Model C sync engine
 * (`ensurePlan`, exported from `billingPlans.seed.ts`) the accommodation +
 * tourist loop already used. This file proves the propagation gap is closed:
 * a `limits` gap on an existing commerce plan row now produces a real
 * `UPDATE` that merges the missing keys in, exactly like it already did for
 * `ALL_PLANS`.
 *
 * `@repo/billing` is used UNMOCKED here (the real `ALL_GASTRONOMY_PLANS` /
 * `ALL_EXPERIENCE_PLANS` / `MODEL_C_FIELD_SPLIT`), unlike
 * `billingPlans.seed.test.ts`'s own tests: `vi.mock('@repo/billing', ...)`
 * does not reliably intercept a `src/` module's import of another workspace
 * `src/` module under this repo's `vite-tsconfig-paths` + `pool: 'forks'`
 * vitest config (same class of finding as `@repo/db`'s, documented in
 * `pointOfInterestCatalogRelations.test.ts`) — measured directly here: the
 * mocked `ALL_GASTRONOMY_PLANS` never reached `commercePlan.seed.ts`, which
 * kept iterating the real six-tier catalogue regardless. Using the real
 * catalogue sidesteps it and is arguably more honest: it proves the fix
 * against the actual production plan shapes, not a hand-picked fixture.
 *
 * @module test/required/commercePlan.seed
 */

import { ALL_EXPERIENCE_PLANS, ALL_GASTRONOMY_PLANS, type PlanDefinition } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Import AFTER mocks are set up.
//
// NOTE: `@repo/db` is deliberately NOT mocked either, for the same resolution
// reason as `@repo/billing` above. `seedCommercePlan`'s injectable `deps.db`
// parameter (HOS-1290) is what makes this file testable at all — the same
// "Testability" pattern `pointOfInterestCatalogRelations.ts` already uses.
import { seedCommercePlan } from '../../src/required/commercePlan.seed.js';

// ---------------------------------------------------------------------------
// In-memory db stub — same shape as billingPlans.seed.test.ts's, since both
// exercise the same underlying `ensurePlan` engine.
// ---------------------------------------------------------------------------

interface UpdateCall {
    payload: Record<string, unknown>;
}

interface StubState {
    selectQueue: Array<Array<Record<string, unknown>>>;
    insertCalls: Array<{ values: Record<string, unknown> }>;
    updateCalls: UpdateCall[];
}

function freshState(): StubState {
    return { selectQueue: [], insertCalls: [], updateCalls: [] };
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

    function makeInsertChain() {
        return {
            values(values: Record<string, unknown>) {
                state.insertCalls.push({ values });
                const result = Promise.resolve(undefined) as unknown as Promise<unknown> & {
                    returning: () => Promise<Array<Record<string, unknown>>>;
                };
                result.returning = async () => [];
                return result;
            }
        };
    }

    function makeUpdateChain() {
        let payload: Record<string, unknown> = {};
        const chain = {
            set(p: Record<string, unknown>) {
                payload = p;
                return chain;
            },
            where(_condition: unknown) {
                state.updateCalls.push({ payload });
                return Promise.resolve();
            }
        };
        return chain;
    }

    const stub = {
        select: () => makeSelectChain(state.selectQueue.shift() ?? []),
        insert: () => makeInsertChain(),
        update: () => makeUpdateChain()
    };
    return stub as unknown as DrizzleClient;
}

/** A DB row that matches the given `PlanDefinition` in EVERY field — no
 * divergence, `ensurePlan` returns 'skipped' with no writes. */
function makeMatchingDbRow(plan: PlanDefinition, id: string) {
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
        displayName: plan.name,
        monthlyPriceArs: plan.monthlyPriceArs,
        annualPriceArs: plan.annualPriceArs,
        productDomain: plan.productDomain,
        metadata: {
            slug: plan.slug,
            category: plan.category,
            isDefault: plan.isDefault,
            sortOrder: plan.sortOrder,
            trialDays: plan.trialDays,
            hasTrial: plan.hasTrial,
            monthlyPriceUsdRef: plan.monthlyPriceUsdRef
        }
    };
}

/** Every plan `seedCommercePlan` walks, in the exact iteration order the
 * source uses (gastronomy catalogue first, then experience). */
const ALL_COMMERCE_PLANS_IN_ORDER: readonly PlanDefinition[] = [
    ...ALL_GASTRONOMY_PLANS,
    ...ALL_EXPERIENCE_PLANS
];

/**
 * Queues the price lookups one plan contributes, in source order.
 *
 * TWO per plan since HOS-1285 — `ensureCommercePriceRows` asks for the
 * `'month'` row and then the `'year'` row — and both report an EXISTING row, so
 * no price insert occurs. Keeping the count in one helper is what stops a third
 * cadence from silently turning a later plan's plan-lookup into a price-lookup:
 * the stub is a positional queue, so one missing entry shifts every plan after
 * it and the suite would fail somewhere unrelated to the change.
 */
function queueExistingPriceRows(state: StubState, slug: string): void {
    state.selectQueue.push([{ id: `${slug}-monthly-price-uuid` }]);
    state.selectQueue.push([{ id: `${slug}-annual-price-uuid` }]);
}

/**
 * Queues one (plan-lookup, price-lookups) group per plan in
 * `ALL_COMMERCE_PLANS_IN_ORDER`, matching every field for every plan EXCEPT
 * `staleSlug`, whose row is missing ALL of its `limits` entirely (the shape
 * of a row seeded before those keys existed). The price lookups always
 * report an existing price row, so no price insert occurs for any plan —
 * this file is only about the `billing_plans` row's Model C sync.
 */
function queueAllPlansWithOneStale(state: StubState, staleSlug: string): void {
    for (const plan of ALL_COMMERCE_PLANS_IN_ORDER) {
        const row =
            plan.slug === staleSlug
                ? { ...makeMatchingDbRow(plan, `${plan.slug}-uuid`), limits: {} }
                : makeMatchingDbRow(plan, `${plan.slug}-uuid`);
        state.selectQueue.push([row]); // plan lookup
        queueExistingPriceRows(state, plan.slug);
    }
}

describe('seedCommercePlan (HOS-1290 — Model C propagation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('propagates a limits gap on an already-seeded gastronomy plan row via an UPDATE (regression)', async () => {
        const targetPlan = ALL_GASTRONOMY_PLANS[0];
        expect(targetPlan).toBeDefined();
        if (!targetPlan) return;
        // A real commerce tier must declare at least one limit for this
        // regression to mean anything — if this ever fails, pick a
        // different target plan, don't weaken the assertions below.
        expect(targetPlan.limits.length).toBeGreaterThan(0);

        const state = freshState();
        queueAllPlansWithOneStale(state, targetPlan.slug);

        await seedCommercePlan({} as never, { db: makeStubDb(state) });

        // This is the propagation the old `ensureCommercePlan` never
        // performed: no plan row was inserted (every row already existed),
        // but an UPDATE carrying the merged limits for the stale plan WAS
        // issued.
        expect(state.insertCalls).toHaveLength(0);

        const expectedLimits: Record<string, number> = {};
        for (const l of targetPlan.limits) {
            expectedLimits[l.key] = l.value;
        }
        const limitsUpdate = state.updateCalls.find((call) => call.payload.limits !== undefined);
        expect(
            limitsUpdate,
            'expected an UPDATE carrying a `limits` payload — the stale plan row was never synced'
        ).toBeDefined();
        expect(limitsUpdate?.payload.limits).toEqual(expectedLimits);
    });

    it('does nothing when every existing row already matches config (no drift, no writes)', async () => {
        const state = freshState();
        for (const plan of ALL_COMMERCE_PLANS_IN_ORDER) {
            state.selectQueue.push([makeMatchingDbRow(plan, `${plan.slug}-uuid`)]);
            queueExistingPriceRows(state, plan.slug);
        }

        await seedCommercePlan({} as never, { db: makeStubDb(state) });

        expect(state.insertCalls).toHaveLength(0);
        expect(state.updateCalls).toHaveLength(0);
    });

    it('seeds the ANNUAL price row for every commerce tier (HOS-1285)', async () => {
        // A fresh database: the plan row exists (so `ensurePlan` writes nothing
        // and the assertions below see price inserts only), but NEITHER price
        // row does. Checkout resolves the PRICE row and not the plan column, so
        // a tier carrying `annualPriceArs` with no `'year'` row is a tier whose
        // annual cadence hard-throws `NO_ANNUAL_PRICE` — the exact shape
        // `experience-pro` hit on the monthly side when HOS-975 activated it.
        const state = freshState();
        for (const plan of ALL_COMMERCE_PLANS_IN_ORDER) {
            state.selectQueue.push([makeMatchingDbRow(plan, `${plan.slug}-uuid`)]);
            state.selectQueue.push([]); // monthly price lookup — absent
            state.selectQueue.push([]); // annual price lookup — absent
        }

        await seedCommercePlan({} as never, { db: makeStubDb(state) });

        const annualInserts = state.insertCalls.filter(
            (call) => call.values.billingInterval === 'year'
        );
        expect(annualInserts).toHaveLength(ALL_COMMERCE_PLANS_IN_ORDER.length);

        // Per plan, and by AMOUNT — asserting only that six `'year'` rows exist
        // would stay green if every one of them carried the monthly figure,
        // which is the mistake that actually charges a year at a month's price.
        for (const plan of ALL_COMMERCE_PLANS_IN_ORDER) {
            const inserted = state.insertCalls.find(
                (call) =>
                    call.values.planId === `${plan.slug}-uuid` &&
                    call.values.billingInterval === 'year'
            );
            expect(inserted, `no annual price row seeded for ${plan.slug}`).toBeDefined();
            expect(inserted?.values.unitAmount).toBe(plan.annualPriceArs);
            expect(inserted?.values.currency).toBe('ARS');
            expect(inserted?.values.intervalCount).toBe(1);
            expect(inserted?.values.active).toBe(true);
        }
    });
});
