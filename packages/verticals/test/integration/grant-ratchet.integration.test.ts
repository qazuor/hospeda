/**
 * TEST:V3:6 (HOS-1440, V3.2, AC:V3:5; DEC-GRANT-005): with the billing
 * simulator giving a `GRANT` source with its `floor`, a new version that grants
 * less does not go below the floor; one that grants more is followed; a retired
 * (not sellable) plan is still read. A source whose reference is of another
 * vertical refuses (G-R2-B).
 */
import { randomUUID } from 'node:crypto';
import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
    GrantReferenceVerticalMismatchError,
    type PlanCatalogReader,
    resolveGrantSet
} from '../../src';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;

const VERTICAL = 'accommodation';
const OTHER_VERTICAL = 'gastronomy';
const MAX_PHOTOS = 'max_photos_per_accommodation';
const SINCE = new Date('2026-01-01T00:00:00.000Z');

afterAll(async () => {
    await pool.end();
});

/** Thrown to roll a test's seeding back. */
class Rollback extends Error {}

/** Runs `fn` inside a transaction that is always rolled back. */
async function inRollback<T>(fn: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    let result: T | undefined;
    try {
        await db.transaction(async (tx) => {
            result = await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
    return result as T;
}

/** The catalog reader bound to the test transaction. */
function readerOn(tx: DrizzleClient): PlanCatalogReader {
    return {
        findPlanVersion: ({ id }) => planCatalogModel.findPlanVersion({ id, tx }),
        findPlanVersionEffects: ({ id }) => planCatalogModel.findPlanVersionEffects({ id, tx }),
        findAddonVersion: ({ id }) => planCatalogModel.findAddonVersion({ id, tx }),
        findPlanVersionSummary: ({ id }) => planCatalogModel.findPlanVersionSummary({ id, tx }),
        findSellableCurrentVersions: ({ vertical }) =>
            planCatalogModel.findSellableCurrentVersions({ vertical, tx }),
        findCurrentPlanVersion: ({ planId }) =>
            planCatalogModel.findCurrentPlanVersion({ planId, tx })
    };
}

/** Seeds a plan; returns its id. */
async function seedPlan(args: {
    readonly tx: DrizzleClient;
    readonly vertical?: string;
}): Promise<string> {
    const vertical = args.vertical ?? VERTICAL;
    const [plan] = await args.tx
        .insert(plans)
        .values({ vertical, slug: `p-${randomUUID()}`, name: 'Plan' })
        .returning({ id: plans.id });
    return (plan as { id: string }).id;
}

/** Seeds one version of a plan; returns its id. */
async function seedVersion(args: {
    readonly tx: DrizzleClient;
    readonly planId: string;
    readonly vertical?: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
    readonly limitValue?: number;
}): Promise<string> {
    const vertical = args.vertical ?? VERTICAL;
    const [version] = await args.tx
        .insert(planVersions)
        .values({
            planId: args.planId,
            vertical,
            rank: args.rank,
            sellable: args.sellable,
            current: args.current,
            graceDays: 10,
            trialDays: 14,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    const versionId = (version as { id: string }).id;
    if (args.limitValue !== undefined) {
        await args.tx
            .insert(planVersionLimits)
            .values({ planVersionId: versionId, key: MAX_PHOTOS, value: args.limitValue });
    }
    return versionId;
}

/** A GRANT source whose reference and floor are plan versions. */
function grantSource(args: {
    readonly reference: string;
    readonly floor: string;
}): readonly CoverageSource[] {
    return [
        CoverageSourceSchema.parse({
            type: 'GRANT',
            reference: { kind: 'PLAN_VERSION', planVersionId: args.reference },
            scope: 'VERTICAL',
            target: null,
            since: SINCE,
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: args.floor
        })
    ];
}

describe('TEST:V3:6 — a grant never grants less than its floor', () => {
    it('a new version that grants less does not go below the floor', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const anchored = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: false,
                limitValue: 20
            });
            await seedVersion({
                tx,
                planId,
                rank: 11,
                sellable: true,
                current: true,
                limitValue: 15
            });

            const resolved = await resolveGrantSet({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(resolved?.limits.get(MAX_PHOTOS)).toBe(20);
        });
    });

    it('a new version that grants more is followed', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const anchored = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: false,
                limitValue: 20
            });
            await seedVersion({
                tx,
                planId,
                rank: 11,
                sellable: true,
                current: true,
                limitValue: 25
            });

            const resolved = await resolveGrantSet({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(resolved?.limits.get(MAX_PHOTOS)).toBe(25);
        });
    });

    it('a retired (not sellable) plan is still read', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const anchored = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: false,
                limitValue: 20
            });
            await seedVersion({
                tx,
                planId,
                rank: 11,
                sellable: false,
                current: true,
                limitValue: 30
            });

            const resolved = await resolveGrantSet({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(resolved?.limits.get(MAX_PHOTOS)).toBe(30);
        });
    });

    it('a reference of another vertical refuses (G-R2-B)', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx, vertical: OTHER_VERTICAL });
            const foreign = await seedVersion({
                tx,
                planId,
                vertical: OTHER_VERTICAL,
                rank: 10,
                sellable: true,
                current: false,
                limitValue: 20
            });

            await expect(
                resolveGrantSet({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSource({ reference: foreign, floor: foreign })
                })
            ).rejects.toThrow(GrantReferenceVerticalMismatchError);
        });
    });
});
