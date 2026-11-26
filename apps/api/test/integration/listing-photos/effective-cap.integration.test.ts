/**
 * The effective photo cap from real catalog rows (HOS-2495 T-030, AC-1/2/3/4).
 *
 * Plan versions, add-on versions and their `*_limit` rows are real database
 * rows (their keys must exist in `catalog_key`, which migration 0254 adds), read
 * through the production `planCatalogModel`. Coverage comes from the contract
 * simulator, as every resolver integration test does: what is under test is
 * that the fold SUMs plan + packs + grant for each listing vertical, and that
 * step 7 refuses the photo right after that sum.
 */
import { randomUUID } from 'node:crypto';
import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    addons,
    addonVersionLimits,
    addonVersions,
    type DrizzleClient,
    getDb,
    planCatalogModel,
    plans,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL, VerticalEnum } from '@repo/schemas';
import {
    type PlanCatalogReader,
    rehydrateEffectiveSet,
    resolveEffectiveLimitBreakdown,
    resolveEffectiveSet,
    resolveLimitStep
} from '@repo/verticals';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../e2e/setup/test-database';

type ListingVertical = VerticalEnum.ACCOMMODATION | VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;

const SINCE = new Date('2026-10-01T00:00:00.000Z');
const OWNER = randomUUID();

class Rollback extends Error {}

/** Runs `fn` inside a transaction that is always rolled back. */
async function inRollback<T>(fn: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    let result: T | undefined;
    try {
        await getDb().transaction(async (tx) => {
            result = await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
    return result as T;
}

function readerOn(tx: DrizzleClient): PlanCatalogReader {
    return {
        findPlanVersion: ({ id }) => planCatalogModel.findPlanVersion({ id, tx }),
        findPlanVersionEffects: ({ id }) => planCatalogModel.findPlanVersionEffects({ id, tx }),
        findAddonVersion: ({ id }) => planCatalogModel.findAddonVersion({ id, tx }),
        findAddonVersionEffects: ({ id }) => planCatalogModel.findAddonVersionEffects({ id, tx }),
        findPlanVersionSummary: ({ id }) => planCatalogModel.findPlanVersionSummary({ id, tx }),
        findSellableCurrentVersions: ({ vertical }) =>
            planCatalogModel.findSellableCurrentVersions({ vertical, tx }),
        findCurrentPlanVersion: ({ planId }) =>
            planCatalogModel.findCurrentPlanVersion({ planId, tx })
    };
}

/** A plan version of `vertical` whose only limit is its photo key at `photos`. */
async function seedPlanVersion(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly photos: number;
    readonly current?: boolean;
}): Promise<string> {
    const [plan] = await args.tx
        .insert(plans)
        .values({ vertical: args.vertical, slug: `hos2495-${randomUUID()}`, name: 'Photo plan' })
        .returning({ id: plans.id });
    const [version] = await args.tx
        .insert(planVersions)
        .values({
            planId: (plan as { id: string }).id,
            vertical: args.vertical,
            rank: Math.floor(Math.random() * 100_000_000) + 1_000,
            // A grant follows the plan's current version (ratchet over its floor).
            sellable: args.current === true,
            current: args.current === true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    const versionId = (version as { id: string }).id;
    await args.tx.insert(planVersionLimits).values({
        planVersionId: versionId,
        key: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[args.vertical],
        value: args.photos
    });
    return versionId;
}

/** A monthly photo pack add-on version for `vertical` (+`photos`). */
async function seedPackVersion(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly photos: number;
}): Promise<string> {
    const [addon] = await args.tx
        .insert(addons)
        .values({ slug: `hos2495-pack-${randomUUID()}`, name: 'Photo pack' })
        .returning({ id: addons.id });
    const [version] = await args.tx
        .insert(addonVersions)
        .values({
            addonId: (addon as { id: string }).id,
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'VERTICAL_SUBSCRIPTION'
        })
        .returning({ id: addonVersions.id });
    const versionId = (version as { id: string }).id;
    await args.tx.insert(addonVersionLimits).values({
        addonVersionId: versionId,
        key: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[args.vertical],
        value: args.photos
    });
    return versionId;
}

const subscription = (planVersionId: string): CoverageSource =>
    CoverageSourceSchema.parse({
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NO_KNOWN_DATE',
        charged: true,
        floor: null
    });

const pack = (addonVersionId: string): CoverageSource =>
    CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NO_KNOWN_DATE',
        charged: null,
        floor: null
    });

const grant = (planVersionId: string): CoverageSource =>
    CoverageSourceSchema.parse({
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: planVersionId
    });

/** The cap, the breakdown and the step-7 answers at `cap` and `cap + 1`. */
async function resolve(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly sources: readonly CoverageSource[];
}) {
    const billing = new BillingForVerticalsSimulator();
    billing.setCoverage({
        userId: OWNER,
        vertical: args.vertical,
        response: { covered: true, sources: [...args.sources] }
    });
    const base = {
        reader: readerOn(args.tx),
        billing,
        trials: { findTrial: async () => null },
        userId: OWNER,
        vertical: args.vertical
    };
    const key = LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[args.vertical];
    const effective = rehydrateEffectiveSet({ version: 1, ...(await resolveEffectiveSet(base)) });
    const cap = effective.limits.get({ key, userId: OWNER, vertical: args.vertical });
    const breakdown = (await resolveEffectiveLimitBreakdown({ ...base, keys: [key] })).get(key);
    const step = (requested: number) =>
        resolveLimitStep({
            userId: OWNER,
            vertical: args.vertical,
            limit: { key, requested },
            effectiveSet: async () => effective
        });
    return {
        cap,
        breakdown,
        atCap: await step(cap ?? 0),
        pastCap: await step((cap ?? 0) + 1)
    };
}

beforeAll(async () => {
    await testDb.setup();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('HOS-2495 the effective photo cap sums plan, packs and grants', () => {
    it('venue-pro (30) + one pack (+20) = 50: the 50th photo passes, the 51st is refused', async () => {
        const result = await inRollback(async (tx) => {
            // Arrange
            const plan = await seedPlanVersion({ tx, vertical: VerticalEnum.VENUE, photos: 30 });
            const extra = await seedPackVersion({ tx, vertical: VerticalEnum.VENUE, photos: 20 });

            // Act
            return resolve({
                tx,
                vertical: VerticalEnum.VENUE,
                sources: [subscription(plan), pack(extra)]
            });
        });

        // Assert
        expect(result.cap).toBe(50);
        expect(result.breakdown).toEqual({
            total: 50,
            contributions: [
                { kind: 'PLAN', value: 30, sources: 1 },
                { kind: 'ADDON', value: 20, sources: 1 }
            ]
        });
        expect(result.atCap).toEqual({ allowed: true });
        expect(result.pastCap).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: 'max_photos_per_venue',
            max: 50,
            requested: 51
        });
    });

    it('venue-pro (30) + two packs (+20 each) = 70', async () => {
        const result = await inRollback(async (tx) => {
            // Arrange
            const plan = await seedPlanVersion({ tx, vertical: VerticalEnum.VENUE, photos: 30 });
            const first = await seedPackVersion({ tx, vertical: VerticalEnum.VENUE, photos: 20 });
            const second = await seedPackVersion({ tx, vertical: VerticalEnum.VENUE, photos: 20 });

            // Act
            return resolve({
                tx,
                vertical: VerticalEnum.VENUE,
                sources: [subscription(plan), pack(first), pack(second)]
            });
        });

        // Assert
        expect(result.cap).toBe(70);
        expect(result.breakdown?.contributions).toEqual([
            { kind: 'PLAN', value: 30, sources: 1 },
            { kind: 'ADDON', value: 40, sources: 2 }
        ]);
        expect(result.pastCap).toMatchObject({ allowed: false, max: 70, requested: 71 });
    });

    it('a permanent grant anchored on a 30-photo plan grants 30', async () => {
        const result = await inRollback(async (tx) => {
            // Arrange
            const plan = await seedPlanVersion({
                tx,
                vertical: VerticalEnum.VENUE,
                photos: 30,
                current: true
            });

            // Act
            return resolve({ tx, vertical: VerticalEnum.VENUE, sources: [grant(plan)] });
        });

        // Assert
        expect(result.cap).toBe(30);
        expect(result.breakdown).toEqual({
            total: 30,
            contributions: [{ kind: 'PERMANENT_GRANT', value: 30, sources: 1 }]
        });
        expect(result.pastCap).toMatchObject({ allowed: false, max: 30, requested: 31 });
    });

    it('experience-pro (30) + one pack (+20) = 50, on the experience key', async () => {
        const result = await inRollback(async (tx) => {
            // Arrange
            const plan = await seedPlanVersion({
                tx,
                vertical: VerticalEnum.EXPERIENCE,
                photos: 30
            });
            const extra = await seedPackVersion({
                tx,
                vertical: VerticalEnum.EXPERIENCE,
                photos: 20
            });

            // Act
            return resolve({
                tx,
                vertical: VerticalEnum.EXPERIENCE,
                sources: [subscription(plan), pack(extra)]
            });
        });

        // Assert
        expect(result.cap).toBe(50);
        expect(result.pastCap).toMatchObject({
            allowed: false,
            key: 'max_photos_per_experience',
            max: 50,
            requested: 51
        });
    });

    it('an accommodation plan of 50 + extra-photos-20 = 70, past the old literal 50', async () => {
        const result = await inRollback(async (tx) => {
            // Arrange
            const plan = await seedPlanVersion({
                tx,
                vertical: VerticalEnum.ACCOMMODATION,
                photos: 50
            });
            const extra = await seedPackVersion({
                tx,
                vertical: VerticalEnum.ACCOMMODATION,
                photos: 20
            });

            // Act
            return resolve({
                tx,
                vertical: VerticalEnum.ACCOMMODATION,
                sources: [subscription(plan), pack(extra)]
            });
        });

        // Assert
        expect(result.cap).toBe(70);
        expect(result.atCap).toEqual({ allowed: true });
        expect(result.pastCap).toMatchObject({ allowed: false, max: 70, requested: 71 });
    });
});
