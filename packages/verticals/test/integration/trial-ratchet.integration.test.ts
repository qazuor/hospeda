/**
 * TEST:V3:5 (HOS-1440, V3.2, AC:V3:4; DEC-TRIAL-001, DEC-TRIAL-002): with a
 * trial in progress seeded in a database built by `db:migrate`, raising the
 * basic plan's `MAX_PHOTOS` from 20 to 25 raises the trial; lowering it below
 * the floor and lowering an override from 2 to 1 do not degrade it; the maximum
 * of listings is 1.
 *
 * The trial's floor is kept as references to plan versions, never as a copy of
 * values, so the test seeds the catalog and passes the references in.
 */
import { randomUUID } from 'node:crypto';
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
import type { PlanCatalogReader } from '../../src';
import { resolveTrialLimits } from '../../src';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;

const VERTICAL = 'accommodation';
const MAX_PHOTOS = 'max_photos_per_accommodation';
const MAX_LISTINGS = 'max_accommodations';
const MAX_PROMOTIONS = 'max_active_promotions';

afterAll(async () => {
    await pool.end();
});

/** Thrown to roll a test's seeding back: the vertical's versions must not leak. */
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

/** Seeds a plan with one version; returns both ids. */
async function seedPlanVersion(args: {
    readonly tx: DrizzleClient;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
    readonly limits?: readonly { readonly key: string; readonly value: number }[];
}): Promise<{ readonly planId: string; readonly versionId: string }> {
    const [plan] = await args.tx
        .insert(plans)
        .values({ vertical: VERTICAL, slug: `p-${randomUUID()}`, name: 'Plan' })
        .returning({ id: plans.id });
    const planId = (plan as { id: string }).id;
    const [version] = await args.tx
        .insert(planVersions)
        .values({
            planId,
            vertical: VERTICAL,
            rank: args.rank,
            sellable: args.sellable,
            current: args.current,
            graceDays: 10,
            trialDays: 14,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    const versionId = (version as { id: string }).id;
    for (const limit of args.limits ?? []) {
        await args.tx
            .insert(planVersionLimits)
            .values({ planVersionId: versionId, key: limit.key, value: limit.value });
    }
    return { planId, versionId };
}

describe('TEST:V3:5 — the trial plan derives, applies overrides and ratchets', () => {
    it('(a) raising the basic plan MAX_PHOTOS from 20 to 25 raises the trial', async () => {
        await inRollback(async (tx) => {
            const basicCurrent = await seedPlanVersion({
                tx,
                rank: 10,
                sellable: true,
                current: true,
                limits: [
                    { key: MAX_PHOTOS, value: 25 },
                    { key: MAX_LISTINGS, value: 3 }
                ]
            });
            const floorLimits = await seedPlanVersion({
                tx,
                rank: 100,
                sellable: false,
                current: false,
                limits: [
                    { key: MAX_PHOTOS, value: 20 },
                    { key: MAX_LISTINGS, value: 3 }
                ]
            });
            const trialPlan = await seedPlanVersion({
                tx,
                rank: 1,
                sellable: false,
                current: true,
                limits: [{ key: MAX_LISTINGS, value: 1 }]
            });
            const floorTrialPlan = await seedPlanVersion({
                tx,
                rank: 2,
                sellable: false,
                current: false,
                limits: [{ key: MAX_LISTINGS, value: 1 }]
            });

            const resolved = await resolveTrialLimits({
                reader: readerOn(tx),
                trial: {
                    vertical: VERTICAL,
                    trialPlanId: trialPlan.planId,
                    floor: {
                        entitlementsVersionId: floorLimits.versionId,
                        limitsVersionId: floorLimits.versionId,
                        trialPlanVersionId: floorTrialPlan.versionId
                    }
                }
            });

            expect(resolved.get(MAX_PHOTOS)).toBe(25);
            expect(resolved.get(MAX_LISTINGS)).toBe(1);
            expect(basicCurrent.versionId).toBeDefined();
        });
    });

    it('(b) lowering MAX_PHOTOS below the floor does not degrade the trial', async () => {
        await inRollback(async (tx) => {
            await seedPlanVersion({
                tx,
                rank: 10,
                sellable: true,
                current: true,
                limits: [{ key: MAX_PHOTOS, value: 15 }]
            });
            const floorLimits = await seedPlanVersion({
                tx,
                rank: 100,
                sellable: false,
                current: false,
                limits: [{ key: MAX_PHOTOS, value: 20 }]
            });
            const trialPlan = await seedPlanVersion({
                tx,
                rank: 1,
                sellable: false,
                current: true
            });
            const floorTrialPlan = await seedPlanVersion({
                tx,
                rank: 2,
                sellable: false,
                current: false
            });

            const resolved = await resolveTrialLimits({
                reader: readerOn(tx),
                trial: {
                    vertical: VERTICAL,
                    trialPlanId: trialPlan.planId,
                    floor: {
                        entitlementsVersionId: floorLimits.versionId,
                        limitsVersionId: floorLimits.versionId,
                        trialPlanVersionId: floorTrialPlan.versionId
                    }
                }
            });

            expect(resolved.get(MAX_PHOTOS)).toBe(20);
        });
    });

    it('(c) lowering an override from 2 to 1 does not degrade it; the listings max is 1', async () => {
        await inRollback(async (tx) => {
            const basic = await seedPlanVersion({
                tx,
                rank: 10,
                sellable: true,
                current: true,
                limits: [
                    { key: MAX_LISTINGS, value: 3 },
                    { key: MAX_PROMOTIONS, value: 5 }
                ]
            });
            const trialPlan = await seedPlanVersion({
                tx,
                rank: 1,
                sellable: false,
                current: true,
                limits: [
                    { key: MAX_LISTINGS, value: 1 },
                    { key: MAX_PROMOTIONS, value: 1 }
                ]
            });
            const floorTrialPlan = await seedPlanVersion({
                tx,
                rank: 2,
                sellable: false,
                current: false,
                limits: [
                    { key: MAX_LISTINGS, value: 1 },
                    { key: MAX_PROMOTIONS, value: 2 }
                ]
            });

            const resolved = await resolveTrialLimits({
                reader: readerOn(tx),
                trial: {
                    vertical: VERTICAL,
                    trialPlanId: trialPlan.planId,
                    floor: {
                        entitlementsVersionId: basic.versionId,
                        limitsVersionId: basic.versionId,
                        trialPlanVersionId: floorTrialPlan.versionId
                    }
                }
            });

            expect(resolved.get(MAX_LISTINGS)).toBe(1);
            expect(resolved.get(MAX_PROMOTIONS)).toBe(2);
        });
    });
});
