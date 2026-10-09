/**
 * TEST:V3:6 (HOS-1440, V3.2, AC:V3:5; DEC-GRANT-005): with the billing
 * simulator giving a `GRANT` source with its `floor`, a new version that grants
 * less does not go below the floor; one that grants more is followed; a retired
 * (not sellable) plan is still read. A source whose reference is of another
 * vertical refuses (G-R2-B).
 */
import { randomUUID } from 'node:crypto';
import {
    type CoverageArgs,
    type CoverageSource,
    CoverageSourceSchema
} from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
    GrantFloorPlanMismatchError,
    GrantReferenceVerticalMismatchError,
    GrantWithoutFloorError,
    MeteredKeyGlobalScopeError,
    type PlanCatalogReader,
    resolveGrantSet
} from '../../src';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;

const VERTICAL = VerticalEnum.ACCOMMODATION;
const OTHER_VERTICAL = VerticalEnum.GASTRONOMY;
const MAX_PHOTOS = 'max_photos_per_accommodation';
const MAX_GASTRONOMIES = 'max_gastronomies';
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
    readonly limitKey?: string;
    readonly entitlements?: readonly {
        readonly key: string;
        readonly planQuota: number | null;
        readonly trialQuota: number | null;
    }[];
}): Promise<string> {
    const vertical = args.vertical ?? VERTICAL;
    const [version] = await args.tx
        .insert(planVersions)
        .values({
            planId: args.planId,
            vertical,
            rank: args.rank + 2_000,
            sellable: args.sellable,
            current: args.current,
            graceDays: 10,
            trialDays: 14,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    const versionId = (version as { id: string }).id;
    if (args.limitValue !== undefined) {
        await args.tx.insert(planVersionLimits).values({
            planVersionId: versionId,
            key: args.limitKey ?? MAX_PHOTOS,
            value: args.limitValue
        });
    }
    for (const entitlement of args.entitlements ?? []) {
        await args.tx
            .insert(planVersionEntitlements)
            .values({ planVersionId: versionId, ...entitlement });
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

/**
 * A GRANT source with `floor: null` (AC:V3:5): the contract's response rule sets
 * `floor` on a GRANT, so this shape is only reachable as a defensive branch and
 * is built raw.
 */
function grantSourceWithoutFloor(reference: string): readonly CoverageSource[] {
    const source: CoverageSource = {
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId: reference },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: null
    };
    return [source];
}

/** Delivers the source through the validated billing coverage contract. */
async function resolveFromSource(args: {
    readonly reader: PlanCatalogReader;
    readonly vertical: CoverageArgs['vertical'];
    readonly sources: readonly CoverageSource[];
}) {
    const billing = new BillingForVerticalsSimulator();
    const userId = 'grant-user';
    if (args.sources.some((source) => source.floor === null)) {
        return resolveGrantSet({
            reader: args.reader,
            billing: { coverage: async () => ({ covered: true, sources: [...args.sources] }) },
            userId,
            vertical: args.vertical
        });
    }
    billing.setCoverage({
        userId,
        vertical: args.vertical,
        response: { covered: true, sources: [...args.sources] }
    });
    return resolveGrantSet({ reader: args.reader, billing, userId, vertical: args.vertical });
}

describe('TEST:V3:6 — a grant never grants less than its floor', () => {
    it('selects coverage for the requested user and vertical', async () => {
        await inRollback(async (tx) => {
            const accommodationA = await seedPlan({ tx });
            const versionA = await seedVersion({
                tx,
                planId: accommodationA,
                rank: 10,
                sellable: true,
                current: true,
                limitValue: 20
            });
            const accommodationB = await seedPlan({ tx });
            const versionB = await seedVersion({
                tx,
                planId: accommodationB,
                rank: 11,
                sellable: true,
                current: true,
                limitValue: 30
            });
            const gastronomyPlan = await seedPlan({ tx, vertical: OTHER_VERTICAL });
            const gastronomyVersion = await seedVersion({
                tx,
                planId: gastronomyPlan,
                vertical: OTHER_VERTICAL,
                rank: 10,
                sellable: true,
                current: true,
                limitValue: 99,
                limitKey: MAX_GASTRONOMIES
            });
            const billing = new BillingForVerticalsSimulator();
            billing.setCoverage({
                userId: 'user-a',
                vertical: VERTICAL,
                response: {
                    covered: true,
                    sources: [...grantSource({ reference: versionA, floor: versionA })]
                }
            });
            billing.setCoverage({
                userId: 'user-b',
                vertical: VERTICAL,
                response: {
                    covered: true,
                    sources: [...grantSource({ reference: versionB, floor: versionB })]
                }
            });
            billing.setCoverage({
                userId: 'user-a',
                vertical: OTHER_VERTICAL,
                response: {
                    covered: true,
                    sources: [
                        ...grantSource({ reference: gastronomyVersion, floor: gastronomyVersion })
                    ]
                }
            });

            const userA = await resolveGrantSet({
                reader: readerOn(tx),
                billing,
                userId: 'user-a',
                vertical: VERTICAL
            });
            const userB = await resolveGrantSet({
                reader: readerOn(tx),
                billing,
                userId: 'user-b',
                vertical: VERTICAL
            });
            const otherVertical = await resolveGrantSet({
                reader: readerOn(tx),
                billing,
                userId: 'user-a',
                vertical: OTHER_VERTICAL
            });
            const uncovered = await resolveGrantSet({
                reader: readerOn(tx),
                billing,
                userId: 'user-b',
                vertical: OTHER_VERTICAL
            });

            expect(
                userA?.limits.get({ key: MAX_PHOTOS, userId: 'user-a', vertical: VERTICAL })
            ).toBe(20);
            expect(
                userB?.limits.get({ key: MAX_PHOTOS, userId: 'user-b', vertical: VERTICAL })
            ).toBe(30);
            expect(
                otherVertical?.limits.get({
                    key: MAX_GASTRONOMIES,
                    userId: 'user-a',
                    vertical: OTHER_VERTICAL
                })
            ).toBe(99);
            expect(
                userA?.limits.get({ key: MAX_PHOTOS, userId: 'user-a', vertical: OTHER_VERTICAL })
            ).toBeUndefined();
            expect(uncovered).toBeNull();
            expect(
                billing.calls
                    .filter((call) => call.operation === 'coverage')
                    .map((call) => call.args)
            ).toStrictEqual([
                { userId: 'user-a', vertical: VERTICAL },
                { userId: 'user-b', vertical: VERTICAL },
                { userId: 'user-a', vertical: OTHER_VERTICAL },
                { userId: 'user-b', vertical: OTHER_VERTICAL }
            ]);
        });
    });

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

            const resolved = await resolveFromSource({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(
                resolved?.limits.get({ key: MAX_PHOTOS, userId: 'grant-user', vertical: VERTICAL })
            ).toBe(20);
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

            const resolved = await resolveFromSource({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(
                resolved?.limits.get({ key: MAX_PHOTOS, userId: 'grant-user', vertical: VERTICAL })
            ).toBe(25);
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

            const resolved = await resolveFromSource({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: anchored, floor: anchored })
            });

            expect(
                resolved?.limits.get({ key: MAX_PHOTOS, userId: 'grant-user', vertical: VERTICAL })
            ).toBe(30);
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
                resolveFromSource({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSource({ reference: foreign, floor: foreign })
                })
            ).rejects.toThrow(GrantReferenceVerticalMismatchError);
        });
    });

    it('a floor of another vertical refuses (G-R2-B)', async () => {
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
            const foreignPlanId = await seedPlan({ tx, vertical: OTHER_VERTICAL });
            const foreignFloor = await seedVersion({
                tx,
                planId: foreignPlanId,
                vertical: OTHER_VERTICAL,
                rank: 10,
                sellable: true,
                current: false,
                limitValue: 99
            });

            await expect(
                resolveFromSource({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSource({ reference: anchored, floor: foreignFloor })
                })
            ).rejects.toThrow(GrantReferenceVerticalMismatchError);
        });
    });

    it('a floor from another plan of the same vertical refuses', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const anchored = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: true,
                limitValue: 20
            });
            const otherPlanId = await seedPlan({ tx });
            const foreignFloor = await seedVersion({
                tx,
                planId: otherPlanId,
                rank: 11,
                sellable: true,
                current: true,
                limitValue: 99
            });

            await expect(
                resolveFromSource({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSource({ reference: anchored, floor: foreignFloor })
                })
            ).rejects.toThrow(GrantFloorPlanMismatchError);
        });
    });

    it('a grant without a floor refuses', async () => {
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

            await expect(
                resolveFromSource({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSourceWithoutFloor(anchored)
                })
            ).rejects.toThrow(GrantWithoutFloorError);
        });
    });

    it('a metered key declared global refuses through the real resolution (AC:V3:3)', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const version = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: true,
                entitlements: [{ key: 'priority_support', planQuota: 5, trialQuota: 3 }]
            });

            await expect(
                resolveFromSource({
                    reader: readerOn(tx),
                    vertical: VERTICAL,
                    sources: grantSource({ reference: version, floor: version })
                })
            ).rejects.toThrow(MeteredKeyGlobalScopeError);
        });
    });

    it('a plain global key does not look metered: trialQuota travels as null (AC:V3:3)', async () => {
        await inRollback(async (tx) => {
            const planId = await seedPlan({ tx });
            const version = await seedVersion({
                tx,
                planId,
                rank: 10,
                sellable: true,
                current: true,
                entitlements: [{ key: 'priority_support', planQuota: null, trialQuota: null }]
            });

            const resolved = await resolveFromSource({
                reader: readerOn(tx),
                vertical: VERTICAL,
                sources: grantSource({ reference: version, floor: version })
            });

            expect(
                resolved?.entitlements.get({
                    key: 'priority_support',
                    userId: 'grant-user',
                    vertical: VERTICAL
                })
            ).toBe(Number.POSITIVE_INFINITY);
        });
    });
});
