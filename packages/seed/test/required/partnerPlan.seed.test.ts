/**
 * Regression test for the partner plan seed (HOS-1290).
 *
 * Same bug and same fix as `commercePlan.seed.test.ts`: `seedPartnerPlan`
 * used to only insert-if-missing and re-stamp `product_domain` on an
 * existing row, so a config edit adding a `LimitKey`/entitlement to a
 * partner plan never reached an already-seeded environment. It now reuses
 * the same `ensurePlan` Model C sync engine `ALL_PLANS` already gets.
 *
 * `@repo/billing`/`@repo/db` are used UNMOCKED here for the same resolution
 * reason documented in `commercePlan.seed.test.ts`'s header — dependency
 * injection (`deps.db`) is what makes this testable instead.
 *
 * @module test/required/partnerPlan.seed
 */

import { ALL_PARTNER_PLANS, type PlanDefinition } from '@repo/billing';
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

import { seedPartnerPlan } from '../../src/required/partnerPlan.seed.js';

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

describe('seedPartnerPlan (HOS-1290 — Model C propagation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('propagates a description edit on an already-seeded partner plan row via an UPDATE (regression)', async () => {
        const targetPlan = ALL_PARTNER_PLANS[0];
        expect(targetPlan).toBeDefined();
        if (!targetPlan) return;

        const state = freshState();
        for (const plan of ALL_PARTNER_PLANS) {
            const row =
                plan.slug === targetPlan.slug
                    ? {
                          ...makeMatchingDbRow(plan, `${plan.slug}-uuid`),
                          // Stale: config's `description` moved on, the DB
                          // row still carries an old one. `description` is
                          // classified 'commercial' (DB wins) in
                          // MODEL_C_FIELD_SPLIT, so this alone should NOT
                          // produce an update — this row exists only to
                          // prove `productDomain` (the one HOS-1290 cares
                          // about being force-synced) still gets corrected.
                          productDomain: 'partner-typo-domain'
                      }
                    : makeMatchingDbRow(plan, `${plan.slug}-uuid`);
            state.selectQueue.push([row]); // plan lookup
            state.selectQueue.push([{ id: `${plan.slug}-price-uuid` }]); // monthly price lookup
            if (plan.annualPriceArs !== null) {
                state.selectQueue.push([{ id: `${plan.slug}-annual-price-uuid` }]); // annual price lookup
            }
        }

        await seedPartnerPlan({} as never, { db: makeStubDb(state) });

        expect(state.insertCalls).toHaveLength(0);
        const domainUpdate = state.updateCalls.find(
            (call) => call.payload.productDomain !== undefined
        );
        expect(
            domainUpdate,
            'expected an UPDATE correcting the drifted product_domain — the stale plan row was never synced'
        ).toBeDefined();
        expect(domainUpdate?.payload.productDomain).toBe(targetPlan.productDomain);
    });
});
