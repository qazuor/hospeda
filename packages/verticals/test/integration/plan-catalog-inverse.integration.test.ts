/**
 * TEST:V2:5 (HOS-1435, V2, AC:V2:4): with versions seeded in a database built
 * by `db:migrate`, `changeDirection` decides by the delta and not the rank.
 * The contract's planPolicy and changeDirection case sets run here too, over
 * `@repo/db`'s real catalog model.
 */
import { randomUUID } from 'node:crypto';
import {
    changeDirectionCaseSet,
    planPolicyCaseSet
} from '@repo/billing-verticals-contract/testing';
import {
    catalogKeys,
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PlanCatalogReader } from '../../src/plan-catalog/catalog-reader';
import { createPlanCatalogInverse } from '../../src/plan-catalog/plan-catalog-inverse';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
// Only the query builder is used (no relational queries), so no schema is passed.
const db = drizzle({ client: pool }) as unknown as DrizzleClient;

/** `@repo/db`'s catalog model, bound to this suite's database. */
const reader: PlanCatalogReader = {
    findPlanVersion: ({ id }) => planCatalogModel.findPlanVersion({ id, tx: db }),
    findPlanVersionEffects: ({ id }) => planCatalogModel.findPlanVersionEffects({ id, tx: db }),
    findAddonVersion: ({ id }) => planCatalogModel.findAddonVersion({ id, tx: db }),
    findPlanVersionSummary: ({ id }) => planCatalogModel.findPlanVersionSummary({ id, tx: db }),
    findSellableCurrentVersions: ({ vertical }) =>
        planCatalogModel.findSellableCurrentVersions({ vertical, tx: db }),
    findCurrentPlanVersion: ({ planId }) =>
        planCatalogModel.findCurrentPlanVersion({ planId, tx: db })
};
const subject = createPlanCatalogInverse({ reader });

/**
 * A commitment key where LESS is better. No key of the production catalog
 * declares `MIN` yet, so this suite registers one of its own in its ephemeral
 * database: the verdict reads the strategy from `catalog_key`.
 */
const MIN_KEY = 'test_response_time_hours';

beforeAll(async () => {
    await db
        .insert(catalogKeys)
        .values({
            key: MIN_KEY,
            kind: 'limit',
            scope: 'vertical',
            aggregationStrategy: 'MIN',
            enforcementStrategy: 'NONE',
            keyClass: 'COMMERCIAL'
        })
        .onConflictDoNothing();
});

afterAll(async () => {
    await pool.end();
});

let nextRank = 1_000;
let nextHigherRank = 100_000;
/** A rank above every rank {@link nextRank} hands out: the destination outranks the origin. */
const higherRank = (): number => nextHigherRank++;

/** Seeds a plan with one current version per call; returns the version id. */
async function seedVersion(args: {
    readonly rank?: number;
    readonly sellable?: boolean;
    readonly current?: boolean;
    readonly graceDays?: number;
    readonly allowsPause?: boolean;
    readonly entitlements?: readonly { key: string; planQuota?: number }[];
    readonly limits?: readonly { key: string; value: number }[];
}): Promise<string> {
    // A version and what it grants are written in ONE transaction, as the
    // publish action does: extras 041 rejects a child row added later.
    return db.transaction(async (tx) => {
        const [plan] = await tx
            .insert(plans)
            .values({ vertical: 'accommodation', slug: `p-${randomUUID()}`, name: 'Plan' })
            .returning({ id: plans.id });
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: (plan as { id: string }).id,
                vertical: 'accommodation',
                rank: args.rank ?? nextRank++,
                sellable: args.sellable ?? true,
                current: args.current ?? true,
                graceDays: args.graceDays ?? 10,
                trialDays: 14,
                allowsPause: args.allowsPause ?? true
            })
            .returning({ id: planVersions.id });
        const planVersionId = (version as { id: string }).id;
        for (const e of args.entitlements ?? []) {
            await tx.insert(planVersionEntitlements).values({
                planVersionId,
                key: e.key,
                planQuota: e.planQuota ?? null,
                trialQuota: e.planQuota === undefined ? null : 0
            });
        }
        for (const l of args.limits ?? []) {
            await tx
                .insert(planVersionLimits)
                .values({ planVersionId, key: l.key, value: l.value });
        }
        return planVersionId;
    });
}

describe('TEST:V2:5 — changeDirection over seeded versions decides by the delta', () => {
    it('(a) the destination has a HIGHER rank and one SUM limit lower: DOWN', async () => {
        const fromPlanVersionId = await seedVersion({
            entitlements: [{ key: 'respond_reviews' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
        });
        const toPlanVersionId = await seedVersion({
            rank: higherRank(),
            entitlements: [{ key: 'respond_reviews' }, { key: 'view_advanced_stats' }],
            limits: [
                { key: 'max_photos_per_accommodation', value: 19 },
                { key: 'max_accommodations', value: 10 }
            ]
        });

        const verdict = await subject.changeDirection({ fromPlanVersionId, toPlanVersionId });

        expect(verdict).toStrictEqual({ direction: 'DOWN' });
    });

    it('(a) the destination has a HIGHER rank and one MAX limit lower: DOWN', async () => {
        const fromPlanVersionId = await seedVersion({
            limits: [{ key: 'max_compare_items', value: 5 }]
        });
        const toPlanVersionId = await seedVersion({
            rank: higherRank(),
            limits: [
                { key: 'max_compare_items', value: 4 },
                { key: 'max_photos_per_accommodation', value: 100 }
            ]
        });

        expect(
            (await subject.changeDirection({ fromPlanVersionId, toPlanVersionId })).direction
        ).toBe('DOWN');
    });

    it('(b) only a MIN key changes, from 24 to 4: UP', async () => {
        const fromPlanVersionId = await seedVersion({
            limits: [
                { key: 'max_photos_per_accommodation', value: 20 },
                { key: MIN_KEY, value: 24 }
            ]
        });
        const toPlanVersionId = await seedVersion({
            limits: [
                { key: 'max_photos_per_accommodation', value: 20 },
                { key: MIN_KEY, value: 4 }
            ]
        });

        const verdict = await subject.changeDirection({ fromPlanVersionId, toPlanVersionId });

        expect(verdict).toStrictEqual({ direction: 'UP' });
    });

    it('a metered entitlement whose plan quota drops: DOWN, even with a higher rank', async () => {
        const fromPlanVersionId = await seedVersion({
            entitlements: [{ key: 'ai_chat', planQuota: 100 }]
        });
        const toPlanVersionId = await seedVersion({
            rank: higherRank(),
            entitlements: [{ key: 'ai_chat', planQuota: 50 }]
        });

        expect(
            (await subject.changeDirection({ fromPlanVersionId, toPlanVersionId })).direction
        ).toBe('DOWN');
    });

    it('a verdict on a retired (not sellable, not current) origin still reads its delta', async () => {
        const fromPlanVersionId = await seedVersion({
            sellable: false,
            current: false,
            limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
        });
        const toPlanVersionId = await seedVersion({
            limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
        });

        expect(
            (await subject.changeDirection({ fromPlanVersionId, toPlanVersionId })).direction
        ).toBe('UP');
    });
});

planPolicyCaseSet({
    describe,
    it,
    expect,
    makeHarness: async () => ({
        subject,
        arrangePlanVersion: async ({ policy }) => ({
            planVersionId: await seedVersion({
                graceDays: policy.graceDays,
                allowsPause: policy.allowsPause,
                current: policy.current,
                sellable: policy.sellable,
                entitlements: [{ key: 'ai_chat', planQuota: 100 }],
                limits: [{ key: 'max_accommodations', value: 3 }]
            })
        })
    })
});

changeDirectionCaseSet({
    describe,
    it,
    expect,
    makeHarness: async () => ({
        subject,
        arrangeChange: async ({ lowersSomething }) => ({
            fromPlanVersionId: await seedVersion({
                limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
            }),
            toPlanVersionId: await seedVersion({
                rank: higherRank(),
                limits: [{ key: 'max_photos_per_accommodation', value: lowersSomething ? 10 : 40 }]
            })
        })
    })
});
