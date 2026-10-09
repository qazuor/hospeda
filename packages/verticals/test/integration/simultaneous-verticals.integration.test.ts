import { randomUUID } from 'node:crypto';
import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    users
} from '@repo/db';
import { FLOOR_PLAN_ROLE, type PlanRole, PRE_TRIAL_PLAN_ROLE, VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
    createEffectiveSetCache,
    effectiveSetSnapshotCodec,
    type PlanCatalogReader,
    readEffectiveSet,
    resolveTrialAndBaseSources,
    subscribeCoverageInvalidation
} from '../../src';
import { FakeRedis } from '../effective-set-cache/fake-redis';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
class Rollback extends Error {}

async function inRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as DrizzleClient);
            throw new Rollback();
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}

async function seedVersion(
    tx: DrizzleClient,
    vertical: VerticalEnum,
    role: PlanRole | null,
    rank: number,
    effects: { entitlement?: string; limit?: { key: string; value: number } } = {}
) {
    const [plan] = await tx
        .insert(plans)
        .values({ vertical, role, slug: randomUUID(), name: 'Simultaneous verticals' })
        .returning({ id: plans.id });
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan!.id,
            vertical,
            rank,
            sellable: role === null,
            current: true,
            trialDays: 14,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (effects.entitlement)
        await tx.insert(planVersionEntitlements).values({
            planVersionId: version!.id,
            key: effects.entitlement,
            planQuota: null,
            trialQuota: null
        });
    if (effects.limit)
        await tx.insert(planVersionLimits).values({
            planVersionId: version!.id,
            key: effects.limit.key,
            value: effects.limit.value
        });
    return version!.id;
}

function catalogOn(tx: DrizzleClient): PlanCatalogReader {
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

describe('simultaneous verticals', () => {
    it('TEST:V3:9 resolves covered Alojamiento and PRE_TRIAL Gastronomía independently across invalidation and Redis outage', async () => {
        await inRollback(async (tx) => {
            const [user] = await tx
                .insert(users)
                .values({
                    email: `simultaneous-${randomUUID()}@example.com`,
                    displayName: 'Simultaneous'
                })
                .returning({ id: users.id });
            const userId = user!.id;
            const accommodation = VerticalEnum.ACCOMMODATION;
            const gastronomy = VerticalEnum.GASTRONOMY;
            const accommodationFloor = await seedVersion(
                tx,
                accommodation,
                FLOOR_PLAN_ROLE,
                100,
                {}
            );
            const subscriptionVersion = await seedVersion(tx, accommodation, null, 101, {
                entitlement: 'priority_support'
            });
            await seedVersion(tx, gastronomy, FLOOR_PLAN_ROLE, 102, {
                limit: { key: 'max_gastronomies', value: 1 }
            });
            await seedVersion(tx, gastronomy, PRE_TRIAL_PLAN_ROLE, 103, {
                limit: { key: 'max_gastronomies', value: 2 }
            });

            const bootstrap = createBootstrapCoverageReader(tx);
            const preTrial = await resolveTrialAndBaseSources({
                reader: bootstrap,
                input: { userId, vertical: gastronomy }
            });
            expect(preTrial.sources.map((source) => [source.type, source.since])).toEqual([
                ['TRIAL', 'NOT_STARTED'],
                ['BASE', expect.any(Date)]
            ]);
            const subscription = CoverageSourceSchema.parse({
                type: 'SUBSCRIPTION',
                reference: { kind: 'PLAN_VERSION', planVersionId: subscriptionVersion },
                scope: 'VERTICAL',
                target: null,
                since: new Date('2026-01-01'),
                until: new Date('2027-01-01'),
                charged: true,
                floor: null
            });
            const base = CoverageSourceSchema.parse({
                type: 'BASE',
                reference: { kind: 'PLAN_VERSION', planVersionId: accommodationFloor },
                scope: 'VERTICAL',
                target: null,
                since: new Date('2026-01-01'),
                until: 'NEVER_EXPIRES',
                charged: null,
                floor: null
            });
            const billing = new BillingForVerticalsSimulator();
            billing.setCoverage({
                userId,
                vertical: accommodation,
                response: { covered: true, sources: [subscription, base] }
            });
            billing.setCoverage({ userId, vertical: gastronomy, response: preTrial });
            const redis = new FakeRedis();
            const cache = createEffectiveSetCache({
                getClient: async () => redis,
                clock: { now: () => new Date('2026-10-09T00:00:00Z') },
                logger: { warn: () => {} },
                codec: effectiveSetSnapshotCodec
            });
            const unsubscribe = subscribeCoverageInvalidation({ billing, cache });
            const reader = catalogOn(tx);
            const coverage = vi.spyOn(billing, 'coverage');
            const read = (vertical: VerticalEnum) =>
                readEffectiveSet({ cache, reader, billing, trials: bootstrap, userId, vertical });
            const accommodationBefore = await read(accommodation);
            const gastronomyBefore = await read(gastronomy);
            expect(
                accommodationBefore.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBe(Infinity);
            expect(
                gastronomyBefore.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBeUndefined();
            const gastronomyValue = gastronomyBefore.limits.get({
                key: 'max_gastronomies',
                userId,
                vertical: gastronomy
            });
            expect(gastronomyValue).toBe(3);
            expect(coverage).toHaveBeenCalledTimes(2);
            await read(accommodation);
            await read(gastronomy);
            expect(coverage).toHaveBeenCalledTimes(2);

            billing.setCoverage({
                userId,
                vertical: accommodation,
                response: { covered: false, sources: [base] }
            });
            await billing.emitCoverageChanged({
                event: {
                    userId,
                    vertical: accommodation,
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED'
                }
            });
            const gastronomyAfter = await read(gastronomy);
            const accommodationAfter = await read(accommodation);
            expect(coverage).toHaveBeenCalledTimes(4);
            expect(
                gastronomyAfter.limits.get({
                    key: 'max_gastronomies',
                    userId,
                    vertical: gastronomy
                })
            ).toBe(gastronomyValue);
            expect(
                accommodationAfter.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBeUndefined();

            redis.failReads = true;
            const gastronomyLive = await read(gastronomy);
            const accommodationLive = await read(accommodation);
            expect(coverage).toHaveBeenCalledTimes(6);
            expect(
                gastronomyLive.limits.get({ key: 'max_gastronomies', userId, vertical: gastronomy })
            ).toBe(gastronomyValue);
            expect(
                accommodationLive.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBeUndefined();
            unsubscribe();
        });
    });
});
