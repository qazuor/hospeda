/**
 * TEST:V3:5 (HOS-1440, V3.2, AC:V3:4; DEC-TRIAL-001, DEC-TRIAL-002): with a
 * trial in progress seeded in a database built by `db:migrate`, raising the
 * basic plan's `MAX_PHOTOS` from 20 to 25 raises the trial; lowering it below
 * the floor and lowering an override from 2 to 1 do not degrade it; the maximum
 * of listings is 1. The entitlements derive from the highest-rank sellable
 * current version and ratchet against the floor's entitlements, with the trial
 * quota never participating.
 *
 * The trial's floor is kept as references to plan versions, never as a copy of
 * values, so each case seeds a real `trial` row with its three floor
 * references and two versions of the SAME trial plan (the current overrides and
 * the floor overrides).
 */
import { randomUUID } from 'node:crypto';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    trials,
    users
} from '@repo/db';
import { TrialStatusEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
    CatalogVersionNotFoundError,
    MeteredKeyGlobalScopeError,
    type PlanCatalogReader,
    resolveTrialSet,
    TrialPlanEntitlementOverrideError
} from '../../src';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;

const VERTICAL = 'accommodation';
const MAX_PHOTOS = 'max_photos_per_accommodation';
const MAX_LISTINGS = 'max_accommodations';
const MAX_PROMOTIONS = 'max_active_promotions';
const METERED = 'publish_accommodations';

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
const fixturePlanIds = new Set<string>();

function readerOn(tx: DrizzleClient): PlanCatalogReader {
    return {
        findPlanVersion: ({ id }) => planCatalogModel.findPlanVersion({ id, tx }),
        findPlanVersionEffects: ({ id }) => planCatalogModel.findPlanVersionEffects({ id, tx }),
        findAddonVersion: ({ id }) => planCatalogModel.findAddonVersion({ id, tx }),
        findPlanVersionSummary: ({ id }) => planCatalogModel.findPlanVersionSummary({ id, tx }),
        findSellableCurrentVersions: async ({ vertical }) =>
            (await planCatalogModel.findSellableCurrentVersions({ vertical, tx })).filter(
                (version) => fixturePlanIds.has(version.planId)
            ),
        findCurrentPlanVersion: ({ planId }) =>
            planCatalogModel.findCurrentPlanVersion({ planId, tx })
    };
}

/** Seeds a plan of the vertical; returns its id. */
async function seedPlan(args: {
    readonly tx: DrizzleClient;
    readonly vertical?: string;
}): Promise<string> {
    const [plan] = await args.tx
        .insert(plans)
        .values({ vertical: args.vertical ?? VERTICAL, slug: `p-${randomUUID()}`, name: 'Plan' })
        .returning({ id: plans.id });
    const planId = (plan as { id: string }).id;
    fixturePlanIds.add(planId);
    return planId;
}

/** Seeds one version of a plan; returns its id. */
async function seedVersion(args: {
    readonly tx: DrizzleClient;
    readonly planId: string;
    readonly vertical?: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
    readonly limits?: readonly { readonly key: string; readonly value: number }[];
    readonly entitlements?: readonly {
        readonly key: string;
        readonly planQuota: number | null;
        readonly trialQuota: number | null;
    }[];
}): Promise<string> {
    const [version] = await args.tx
        .insert(planVersions)
        .values({
            planId: args.planId,
            vertical: args.vertical ?? VERTICAL,
            rank: args.rank + 1_000,
            sellable: args.sellable,
            current: args.current,
            graceDays: 10,
            trialDays: 0, // Required catalog field; duration is outside this fixture's behavior.
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    const versionId = (version as { id: string }).id;
    for (const limit of args.limits ?? []) {
        await args.tx
            .insert(planVersionLimits)
            .values({ planVersionId: versionId, key: limit.key, value: limit.value });
    }
    for (const entitlement of args.entitlements ?? []) {
        await args.tx
            .insert(planVersionEntitlements)
            .values({ planVersionId: versionId, ...entitlement });
    }
    return versionId;
}

/** Seeds a `TRIAL_ACTIVE` user and trial row; returns the trial's references. */
async function seedTrial(args: {
    readonly tx: DrizzleClient;
    readonly trialPlanId: string;
    readonly floorEntitlementsVersionId: string;
    readonly floorLimitsVersionId: string;
    readonly floorTrialPlanVersionId: string;
}): Promise<{
    readonly userId: string;
    readonly vertical: string;
    readonly trialPlanId: string;
    readonly floor: {
        readonly entitlementsVersionId: string;
        readonly limitsVersionId: string;
        readonly trialPlanVersionId: string;
    };
}> {
    const [user] = await args.tx
        .insert(users)
        .values({
            email: `trial-${randomUUID()}@example.com`,
            displayName: 'Trial User',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        } as typeof users.$inferInsert)
        .returning({ id: users.id });
    const userId = (user as { id: string }).id;
    await args.tx.insert(trials).values({
        userId,
        vertical: VERTICAL,
        status: TrialStatusEnum.TRIAL_ACTIVE,
        trialPlanId: args.trialPlanId,
        floorEntitlementsVersionId: args.floorEntitlementsVersionId,
        floorLimitsVersionId: args.floorLimitsVersionId,
        floorTrialPlanVersionId: args.floorTrialPlanVersionId,
        startedAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: new Date('2030-01-01T00:00:00.000Z'),
        emailPseudonym: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        deadlinesVersion: 1
    });

    // Read the seeded row back: the resolution uses the row's real references.
    const [row] = await args.tx.select().from(trials).where(eq(trials.userId, userId));
    const trial = row as {
        vertical: string;
        trialPlanId: string | null;
        floorEntitlementsVersionId: string | null;
        floorLimitsVersionId: string | null;
        floorTrialPlanVersionId: string | null;
    };
    return {
        userId,
        vertical: trial.vertical,
        trialPlanId: trial.trialPlanId as string,
        floor: {
            entitlementsVersionId: trial.floorEntitlementsVersionId as string,
            limitsVersionId: trial.floorLimitsVersionId as string,
            trialPlanVersionId: trial.floorTrialPlanVersionId as string
        }
    };
}

/** Seeds a trial plan with its current overrides and its floor overrides. */
async function seedTrialPlan(args: {
    readonly tx: DrizzleClient;
    readonly currentLimits?: readonly { readonly key: string; readonly value: number }[];
    readonly floorLimits?: readonly { readonly key: string; readonly value: number }[];
}): Promise<{ readonly planId: string; readonly floorVersionId: string }> {
    const planId = await seedPlan({ tx: args.tx });
    const floorVersionId = await seedVersion({
        tx: args.tx,
        planId,
        rank: 2,
        sellable: false,
        current: false,
        limits: args.floorLimits
    });
    await seedVersion({
        tx: args.tx,
        planId,
        rank: 1,
        sellable: false,
        current: true,
        limits: args.currentLimits
    });
    return { planId, floorVersionId };
}

describe('TEST:V3:5 — the trial plan derives, applies overrides and ratchets', () => {
    it('(a) raising the basic plan MAX_PHOTOS from 20 to 25 raises the trial', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            const floorLimits = await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: false,
                limits: [
                    { key: MAX_PHOTOS, value: 20 },
                    { key: MAX_LISTINGS, value: 3 }
                ]
            });
            await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: true,
                limits: [
                    { key: MAX_PHOTOS, value: 25 },
                    { key: MAX_LISTINGS, value: 3 }
                ]
            });
            const trialPlan = await seedTrialPlan({
                tx,
                currentLimits: [{ key: MAX_LISTINGS, value: 1 }],
                floorLimits: [{ key: MAX_LISTINGS, value: 1 }]
            });
            const trial = await seedTrial({
                tx,
                trialPlanId: trialPlan.planId,
                floorEntitlementsVersionId: floorLimits,
                floorLimitsVersionId: floorLimits,
                floorTrialPlanVersionId: trialPlan.floorVersionId
            });

            const resolved = await resolveTrialSet({ reader: readerOn(tx), trial });

            expect(
                resolved.limits.get({ key: MAX_PHOTOS, userId: trial.userId, vertical: VERTICAL })
            ).toBe(25);
            expect(
                resolved.limits.get({ key: MAX_LISTINGS, userId: trial.userId, vertical: VERTICAL })
            ).toBe(1);
        });
    });

    it('(b) lowering MAX_PHOTOS below the floor does not degrade the trial', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            const floorLimits = await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: false,
                limits: [{ key: MAX_PHOTOS, value: 20 }]
            });
            await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: true,
                limits: [{ key: MAX_PHOTOS, value: 15 }]
            });
            const trialPlan = await seedTrialPlan({ tx });
            const trial = await seedTrial({
                tx,
                trialPlanId: trialPlan.planId,
                floorEntitlementsVersionId: floorLimits,
                floorLimitsVersionId: floorLimits,
                floorTrialPlanVersionId: trialPlan.floorVersionId
            });

            const resolved = await resolveTrialSet({ reader: readerOn(tx), trial });

            expect(
                resolved.limits.get({ key: MAX_PHOTOS, userId: trial.userId, vertical: VERTICAL })
            ).toBe(20);
        });
    });

    it('(c) lowering an override from 2 to 1 does not degrade it; the listings max is 1', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: true,
                limits: [
                    { key: MAX_LISTINGS, value: 3 },
                    { key: MAX_PROMOTIONS, value: 5 }
                ]
            });
            const floorPlanId = await seedPlan({ tx });
            const floorLimits = await seedVersion({
                tx,
                planId: floorPlanId,
                rank: 100,
                sellable: false,
                current: false,
                limits: [
                    { key: MAX_LISTINGS, value: 3 },
                    { key: MAX_PROMOTIONS, value: 5 }
                ]
            });
            const trialPlan = await seedTrialPlan({
                tx,
                currentLimits: [
                    { key: MAX_LISTINGS, value: 1 },
                    { key: MAX_PROMOTIONS, value: 1 }
                ],
                floorLimits: [
                    { key: MAX_LISTINGS, value: 1 },
                    { key: MAX_PROMOTIONS, value: 2 }
                ]
            });
            const trial = await seedTrial({
                tx,
                trialPlanId: trialPlan.planId,
                floorEntitlementsVersionId: floorLimits,
                floorLimitsVersionId: floorLimits,
                floorTrialPlanVersionId: trialPlan.floorVersionId
            });

            const resolved = await resolveTrialSet({ reader: readerOn(tx), trial });

            expect(
                resolved.limits.get({ key: MAX_LISTINGS, userId: trial.userId, vertical: VERTICAL })
            ).toBe(1);
            expect(
                resolved.limits.get({
                    key: MAX_PROMOTIONS,
                    userId: trial.userId,
                    vertical: VERTICAL
                })
            ).toBe(2);
        });
    });

    it('derives entitlements from the highest-rank version and ratchets them, ignoring trialQuota', async () => {
        await inRollback(async (tx) => {
            const lowPlanId = await seedPlan({ tx });
            await seedVersion({
                tx,
                planId: lowPlanId,
                rank: 10,
                sellable: true,
                current: true,
                limits: [{ key: MAX_LISTINGS, value: 3 }]
            });
            const highPlanId = await seedPlan({ tx });
            await seedVersion({
                tx,
                planId: highPlanId,
                rank: 20,
                sellable: true,
                current: true,
                entitlements: [{ key: METERED, planQuota: 20, trialQuota: 999 }]
            });
            const floorPlanId = await seedPlan({ tx });
            const floorEntitlements = await seedVersion({
                tx,
                planId: floorPlanId,
                rank: 100,
                sellable: false,
                current: false,
                entitlements: [{ key: METERED, planQuota: 30, trialQuota: 1 }]
            });
            const trialPlan = await seedTrialPlan({ tx });
            const trial = await seedTrial({
                tx,
                trialPlanId: trialPlan.planId,
                floorEntitlementsVersionId: floorEntitlements,
                floorLimitsVersionId: floorEntitlements,
                floorTrialPlanVersionId: trialPlan.floorVersionId
            });

            const resolved = await resolveTrialSet({ reader: readerOn(tx), trial });

            // Highest rank (20) gives 20; the floor gives 30; trialQuota (999/1) never counts.
            expect(
                resolved.entitlements.get({
                    key: METERED,
                    userId: trial.userId,
                    vertical: VERTICAL
                })
            ).toBe(30);
        });
    });

    it('rejects a metered global entitlement read through the trial derivation', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            const basic = await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: true,
                entitlements: [{ key: 'priority_support', planQuota: 1, trialQuota: 1 }]
            });
            const trialPlan = await seedTrialPlan({ tx });
            const trial = await seedTrial({
                tx,
                trialPlanId: trialPlan.planId,
                floorEntitlementsVersionId: basic,
                floorLimitsVersionId: basic,
                floorTrialPlanVersionId: trialPlan.floorVersionId
            });

            await expect(resolveTrialSet({ reader: readerOn(tx), trial })).rejects.toThrow(
                MeteredKeyGlobalScopeError
            );
        });
    });

    it('refuses a trial plan version that declares entitlement rows (DEC-TRIAL-001)', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            const basic = await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 10,
                sellable: true,
                current: true,
                limits: [{ key: MAX_LISTINGS, value: 3 }]
            });
            const trialPlanId = await seedPlan({ tx });
            const floorVersionId = await seedVersion({
                tx,
                planId: trialPlanId,
                rank: 2,
                sellable: false,
                current: false,
                limits: [{ key: MAX_LISTINGS, value: 1 }]
            });
            await seedVersion({
                tx,
                planId: trialPlanId,
                rank: 1,
                sellable: false,
                current: true,
                entitlements: [{ key: METERED, planQuota: 5, trialQuota: 3 }]
            });
            const trial = await seedTrial({
                tx,
                trialPlanId,
                floorEntitlementsVersionId: basic,
                floorLimitsVersionId: basic,
                floorTrialPlanVersionId: floorVersionId
            });

            await expect(resolveTrialSet({ reader: readerOn(tx), trial })).rejects.toThrow(
                TrialPlanEntitlementOverrideError
            );
        });
    });

    it('refuses a trial plan with no current version', async () => {
        await inRollback(async (tx) => {
            const basicPlanId = await seedPlan({ tx });
            const floorLimits = await seedVersion({
                tx,
                planId: basicPlanId,
                rank: 100,
                sellable: false,
                current: false,
                limits: [{ key: MAX_PHOTOS, value: 20 }]
            });
            const trialPlanId = await seedPlan({ tx });
            // Only the floor version exists: the trial plan has no current version.
            const floorTrialPlan = await seedVersion({
                tx,
                planId: trialPlanId,
                rank: 2,
                sellable: false,
                current: false,
                limits: [{ key: MAX_LISTINGS, value: 1 }]
            });
            const trial = await seedTrial({
                tx,
                trialPlanId,
                floorEntitlementsVersionId: floorLimits,
                floorLimitsVersionId: floorLimits,
                floorTrialPlanVersionId: floorTrialPlan
            });

            await expect(resolveTrialSet({ reader: readerOn(tx), trial })).rejects.toThrow(
                CatalogVersionNotFoundError
            );
        });
    });
});
