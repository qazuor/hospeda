import { randomUUID } from 'node:crypto';
import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
    createEffectiveSetCache,
    decodeFiniteOrInfinite,
    encodeFiniteOrInfinite,
    type PlanCatalogReader,
    resolveEffectiveSet,
    resolveGrantSet,
    subscribeCoverageInvalidation
} from '../../src';
import { FakeRedis } from '../effective-set-cache/fake-redis';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const VERTICALS = [VerticalEnum.ACCOMMODATION, VerticalEnum.TOURIST, VerticalEnum.VENUE] as const;
type Vertical = (typeof VERTICALS)[number];
const KEY = 'priority_support';
let nextRank = 4_000;

afterAll(async () => {
    await pool.end();
});

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

interface Snapshot {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly globalGrant: number | null;
    readonly inheritsTouristVip?: boolean;
}

const codec = {
    encode: (value: Snapshot) =>
        JSON.stringify({
            ...value,
            globalGrant:
                value.globalGrant === null ? null : encodeFiniteOrInfinite(value.globalGrant)
        }),
    decode: (raw: string): Snapshot => {
        const value: unknown = JSON.parse(raw);
        if (
            typeof value !== 'object' ||
            value === null ||
            !('userId' in value) ||
            typeof value.userId !== 'string' ||
            !('vertical' in value) ||
            !VERTICALS.includes(value.vertical as Vertical) ||
            !('globalGrant' in value)
        )
            throw new TypeError('Invalid snapshot');
        return {
            userId: value.userId,
            vertical: value.vertical as Vertical,
            ...('inheritsTouristVip' in value && typeof value.inheritsTouristVip === 'boolean'
                ? { inheritsTouristVip: value.inheritsTouristVip }
                : {}),
            globalGrant:
                value.globalGrant === null ? null : decodeFiniteOrInfinite(value.globalGrant)
        };
    }
};

async function seedVersions(
    args: { readonly inheritsTouristVip?: boolean } = {}
): Promise<Record<Vertical, string>> {
    const rank = nextRank++;
    return db.transaction(async (tx) => {
        const ids = {} as Record<Vertical, string>;
        for (const vertical of VERTICALS) {
            const [plan] = await tx
                .insert(plans)
                .values({
                    vertical,
                    slug: `cache-${randomUUID()}`,
                    name: 'Cache integration'
                })
                .returning({ id: plans.id });
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: (plan as { id: string }).id,
                    vertical,
                    rank,
                    sellable: true,
                    current: true,
                    graceDays: 10,
                    trialDays: 14,
                    allowsPause: true,
                    inheritsTouristVip:
                        args.inheritsTouristVip === true && vertical === VerticalEnum.ACCOMMODATION
                })
                .returning({ id: planVersions.id });
            ids[vertical] = (version as { id: string }).id;
            await tx.insert(planVersionEntitlements).values({
                planVersionId: ids[vertical],
                key: KEY,
                planQuota: null,
                trialQuota: null
            });
        }
        return ids;
    });
}

function fixture(versions: Record<Vertical, string>) {
    const billing = new BillingForVerticalsSimulator();
    const redis = new FakeRedis();
    const warn = vi.fn();
    const create = () =>
        createEffectiveSetCache<Snapshot>({
            getClient: async () => redis,
            clock: { now: () => new Date('2026-10-08T00:00:00.000Z') },
            logger: { warn },
            codec
        });
    const cover = (userId: string, vertical: Vertical, covered: boolean) => {
        const source = CoverageSourceSchema.parse({
            type: 'GRANT',
            reference: { kind: 'PLAN_VERSION', planVersionId: versions[vertical] },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01T00:00:00.000Z'),
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: versions[vertical]
        });
        billing.setCoverage({
            userId,
            vertical,
            response: { covered, sources: covered ? [source] : [] }
        });
    };
    const load = (userId: string, vertical: Vertical) => async (): Promise<Snapshot> => {
        const grant = await resolveGrantSet({ reader, billing, userId, vertical });
        return {
            userId,
            vertical,
            globalGrant: grant?.entitlements.get({ key: KEY, userId, vertical: null }) ?? null
        };
    };
    const read = (cache: ReturnType<typeof create>, userId: string, vertical: Vertical) =>
        cache.readThrough({ userId, vertical, load: load(userId, vertical) });
    const notice = (userId: string, vertical: Vertical) =>
        billing.emitCoverageChanged({
            event: { userId, vertical, sourceType: 'GRANT', change: 'REMOVED' }
        });
    return { billing, redis, warn, create, cover, load, read, notice };
}

describe('DB-backed effective-set cache', () => {
    it('TEST:V3:8 invalidates inherited Tourist VIP across verticals and after suspension', async () => {
        const versions = await seedVersions({ inheritsTouristVip: true });
        const f = fixture(versions);
        const cache = f.create();
        const unsubscribe = subscribeCoverageInvalidation({ billing: f.billing, cache });
        const user = randomUUID();
        const other = randomUUID();
        const coverAccommodation = (userId: string, covered: boolean) => {
            const source = CoverageSourceSchema.parse({
                type: 'SUBSCRIPTION',
                reference: {
                    kind: 'PLAN_VERSION',
                    planVersionId: versions[VerticalEnum.ACCOMMODATION]
                },
                scope: 'VERTICAL',
                target: null,
                since: new Date('2026-01-01T00:00:00.000Z'),
                until: 'NO_KNOWN_DATE',
                charged: true,
                floor: null
            });
            f.billing.setCoverage({
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                response: { covered, sources: covered ? [source] : [] }
            });
        };
        const load = (userId: string, vertical: Vertical) => async (): Promise<Snapshot> => {
            const effective = await resolveEffectiveSet({
                reader,
                billing: f.billing,
                trials: { findTrial: async () => null },
                userId,
                vertical
            });
            return {
                userId,
                vertical,
                globalGrant: effective.entries.find((entry) => entry.key === KEY)?.value ?? null,
                inheritsTouristVip: effective.inheritsTouristVip
            };
        };
        const read = (userId: string, vertical: Vertical) =>
            cache.readThrough({ userId, vertical, load: load(userId, vertical) });
        for (const vertical of VERTICALS) {
            if (vertical === VerticalEnum.ACCOMMODATION) {
                coverAccommodation(user, true);
                coverAccommodation(other, true);
            }
            await read(user, vertical);
            await read(other, vertical);
        }
        expect(await read(user, VerticalEnum.TOURIST)).toMatchObject({
            inheritsTouristVip: true,
            globalGrant: Number.POSITIVE_INFINITY
        });
        // Program the post-commit answer first; the contract delivers the notice afterwards.
        coverAccommodation(user, false);
        await f.notice(user, VerticalEnum.ACCOMMODATION);
        expect((await read(user, VerticalEnum.ACCOMMODATION)).globalGrant).toBeNull();
        const live = vi.fn(load(user, VerticalEnum.TOURIST));
        await cache.readThrough({ userId: user, vertical: VerticalEnum.TOURIST, load: live });
        expect(live).toHaveBeenCalledOnce();
        expect(await read(user, VerticalEnum.TOURIST)).toMatchObject({
            inheritsTouristVip: false,
            globalGrant: null
        });
        const gastronomy = vi.fn(load(user, VerticalEnum.VENUE));
        await cache.readThrough({
            userId: user,
            vertical: VerticalEnum.VENUE,
            load: gastronomy
        });
        expect(gastronomy).toHaveBeenCalledOnce();
        const untouched = vi.fn(load(other, VerticalEnum.TOURIST));
        await cache.readThrough({ userId: other, vertical: VerticalEnum.TOURIST, load: untouched });
        expect(untouched).not.toHaveBeenCalled();

        f.redis.failIncr = true;
        coverAccommodation(user, true);
        await f.notice(user, VerticalEnum.ACCOMMODATION);
        f.redis.failIncr = false;
        expect(await read(user, VerticalEnum.TOURIST)).toMatchObject({
            inheritsTouristVip: true,
            globalGrant: Number.POSITIVE_INFINITY
        });
        expect(f.warn).toHaveBeenCalledWith(expect.any(String), {
            suspectEntries: 1,
            userId: user
        });

        await cache.invalidateAll(); // The plan-publication caller is wired in part 2.
        for (const vertical of VERTICALS) {
            const afterPublication = vi.fn(load(other, vertical));
            await cache.readThrough({ userId: other, vertical, load: afterPublication });
            expect(afterPublication).toHaveBeenCalledOnce();
        }
        coverAccommodation(user, false);
        await f.notice(user, VerticalEnum.ACCOMMODATION);
        expect(await read(user, VerticalEnum.TOURIST)).toMatchObject({
            inheritsTouristVip: false,
            globalGrant: null
        });
        unsubscribe();
    });

    it('TEST:V3:12 shares invalidation between two clients and logs a failed one', async () => {
        const f = fixture(await seedVersions());
        const first = f.create();
        const second = f.create();
        const user = randomUUID();
        const unsubscribe = subscribeCoverageInvalidation({ billing: f.billing, cache: first });
        for (const vertical of VERTICALS) {
            f.cover(user, vertical, true);
            await f.read(first, user, vertical);
        }
        f.cover(user, VerticalEnum.ACCOMMODATION, false);
        await f.notice(user, VerticalEnum.ACCOMMODATION);
        for (const vertical of VERTICALS) {
            const load = vi.fn(f.load(user, vertical));
            await second.readThrough({ userId: user, vertical, load });
            expect(load).toHaveBeenCalledOnce();
        }
        expect((await f.read(second, user, VerticalEnum.ACCOMMODATION)).globalGrant).toBeNull();
        f.redis.failIncr = true;
        await expect(first.invalidateUser({ userId: user })).resolves.toBeUndefined();
        expect(f.warn).toHaveBeenCalledWith(expect.any(String), {
            suspectEntries: 1,
            userId: user
        });
        unsubscribe();
    });

    it('TEST:V3:13 reads covered and revoked users live when Redis read and INCR fail', async () => {
        const f = fixture(await seedVersions());
        const cache = f.create();
        const user = randomUUID();
        f.cover(user, VerticalEnum.ACCOMMODATION, true);
        const healthyCovered = await f.read(cache, user, VerticalEnum.ACCOMMODATION);
        f.redis.failReads = true;
        const liveCovered = await f.read(cache, user, VerticalEnum.ACCOMMODATION);
        expect(liveCovered).toEqual(healthyCovered);
        f.redis.failReads = false;
        f.cover(user, VerticalEnum.ACCOMMODATION, false);
        await cache.invalidateUser({ userId: user });
        const healthyRevoked = await f.read(cache, user, VerticalEnum.ACCOMMODATION);
        expect(healthyRevoked.globalGrant).toBeNull();
        f.redis.failReads = true;
        f.redis.failIncr = true;
        await expect(cache.invalidateUser({ userId: user })).resolves.toBeUndefined();
        const liveRevoked = await f.read(cache, user, VerticalEnum.ACCOMMODATION);
        expect(liveRevoked).toEqual(healthyRevoked);
        expect(f.warn).toHaveBeenCalledWith(expect.any(String), {
            suspectEntries: 1,
            userId: user
        });
    });
});
