import { randomUUID } from 'node:crypto';
import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    type DrizzleClient,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersions,
    users
} from '@repo/db';
import { FLOOR_PLAN_ROLE, PRE_TRIAL_PLAN_ROLE, VerticalEnum } from '@repo/schemas';
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
    rank: number,
    entitlement: string
) {
    const [plan] = await tx
        .insert(plans)
        .values({ vertical, slug: randomUUID(), name: 'Simultaneous verticals' })
        .returning({ id: plans.id });
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan!.id,
            vertical,
            rank,
            sellable: true,
            current: true,
            trialDays: 14,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    await tx.insert(planVersionEntitlements).values({
        planVersionId: version!.id,
        key: entitlement,
        planQuota: null,
        trialQuota: null
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
            const venue = VerticalEnum.VENUE;
            const bootstrap = createBootstrapCoverageReader(tx);
            const accommodationFloor = await bootstrap.findCurrentVersionByRole({
                vertical: accommodation,
                role: FLOOR_PLAN_ROLE
            });
            const venueFloor = await bootstrap.findCurrentVersionByRole({
                vertical: venue,
                role: FLOOR_PLAN_ROLE
            });
            const venuePreTrial = await bootstrap.findCurrentVersionByRole({
                vertical: venue,
                role: PRE_TRIAL_PLAN_ROLE
            });
            if (!accommodationFloor || !venueFloor || !venuePreTrial) {
                throw new Error('Migrated catalog must provide floor and pre-trial versions');
            }
            const subscriptionVersion = await seedVersion(
                tx,
                accommodation,
                5_001,
                'priority_support'
            );
            const preTrial = await resolveTrialAndBaseSources({
                reader: bootstrap,
                input: { userId, vertical: venue }
            });
            expect(preTrial.sources.map((source) => [source.type, source.since])).toEqual([
                ['TRIAL', 'NOT_STARTED'],
                ['BASE', expect.any(Date)]
            ]);
            expect(preTrial.sources.map((source) => source.reference)).toEqual([
                { kind: 'PLAN_VERSION', planVersionId: venuePreTrial.id },
                { kind: 'PLAN_VERSION', planVersionId: venueFloor.id }
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
                reference: { kind: 'PLAN_VERSION', planVersionId: accommodationFloor.id },
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
            billing.setCoverage({ userId, vertical: venue, response: preTrial });
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
            const venueBefore = await read(venue);
            expect(
                accommodationBefore.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBe(Infinity);
            expect(
                venueBefore.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBeUndefined();
            const venueValue = venueBefore.entitlements.get({
                key: 'activate_trial',
                userId,
                vertical: venue
            });
            expect(venueValue).toBe(Infinity);
            expect(coverage).toHaveBeenCalledTimes(2);
            await read(accommodation);
            await read(venue);
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
            const venueAfter = await read(venue);
            const accommodationAfter = await read(accommodation);
            expect(coverage).toHaveBeenCalledTimes(4);
            expect(
                venueAfter.entitlements.get({
                    key: 'activate_trial',
                    userId,
                    vertical: venue
                })
            ).toBe(venueValue);
            expect(
                accommodationAfter.entitlements.get({
                    key: 'priority_support',
                    userId,
                    vertical: null
                })
            ).toBeUndefined();

            redis.failReads = true;
            const venueLive = await read(venue);
            const accommodationLive = await read(accommodation);
            expect(coverage).toHaveBeenCalledTimes(6);
            expect(
                venueLive.entitlements.get({
                    key: 'activate_trial',
                    userId,
                    vertical: venue
                })
            ).toBe(venueValue);
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
