import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersions,
    subscriptions
} from '@repo/db';
import type { PlanCatalogReader } from '@repo/verticals';
import { resolveTrialValues } from '@repo/verticals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { up } from '../../src/data-migrations/0133-hos-2037-video-link-all-plans.js';

// Must point at a disposable, migrated PostgreSQL database. Never defaults to the shared test DB.
const isolatedDb = process.env.HOSPEDA_ISOLATED_DATABASE_URL;
let pool: Pool | undefined;
let db: DrizzleClient | undefined;

beforeAll(() => {
    if (!isolatedDb) return;
    pool = new Pool({ connectionString: isolatedDb });
    db = drizzle(pool) as unknown as DrizzleClient;
});

afterAll(async () => {
    await pool?.end();
});

describe('HOS-2037 isolated data migration', () => {
    it.skipIf(!isolatedDb)(
        'publishes Basic, moves its live subscriptions, and leaves trial rows empty',
        async () => {
            if (!db) throw new Error('Isolated database was not initialized');
            const [basic] = await db
                .select()
                .from(plans)
                .where(and(eq(plans.vertical, 'accommodation'), eq(plans.slug, 'owner-basico')));
            const [trial] = await db
                .select()
                .from(plans)
                .where(and(eq(plans.vertical, 'accommodation'), eq(plans.role, 'trial')));
            if (!basic || !trial) throw new Error('Expected accommodation catalog plans');
            const [oldBasicVersion] = await db
                .select()
                .from(planVersions)
                .where(and(eq(planVersions.planId, basic.id), eq(planVersions.current, true)));
            if (!oldBasicVersion) throw new Error('Expected the pre-migration Basic version');
            await db.transaction(async (tx) => up({ db: tx } as Parameters<typeof up>[0]));
            const [basicVersion] = await db
                .select()
                .from(planVersions)
                .where(and(eq(planVersions.planId, basic.id), eq(planVersions.current, true)));
            const [trialVersion] = await db
                .select()
                .from(planVersions)
                .where(and(eq(planVersions.planId, trial.id), eq(planVersions.current, true)));
            if (!basicVersion || !trialVersion) throw new Error('Expected current plan versions');
            const sellable = await db
                .select()
                .from(planVersions)
                .where(
                    and(
                        eq(planVersions.vertical, 'accommodation'),
                        eq(planVersions.current, true),
                        eq(planVersions.sellable, true)
                    )
                );
            const highestRank = sellable.reduce((top, version) =>
                version.rank > top.rank ? version : top
            );
            const lowestRank = sellable.reduce((top, version) =>
                version.rank < top.rank ? version : top
            );
            const trialReader = {
                findSellableCurrentVersions: (args) =>
                    planCatalogModel.findSellableCurrentVersions({ ...args, tx: db }),
                findCurrentPlanVersion: (args) =>
                    planCatalogModel.findCurrentPlanVersion({ ...args, tx: db }),
                findPlanVersionEffects: (args) =>
                    planCatalogModel.findPlanVersionEffects({ ...args, tx: db })
            } as unknown as PlanCatalogReader;
            const resolvedTrial = await resolveTrialValues({
                reader: trialReader,
                trial: {
                    userId: '00000000-0000-4000-8000-000000000001',
                    vertical: 'accommodation',
                    trialPlanId: trial.id,
                    floor: {
                        entitlementsVersionId: highestRank.id,
                        limitsVersionId: lowestRank.id,
                        trialPlanVersionId: trialVersion.id
                    }
                }
            });
            expect(resolvedTrial.some((grant) => grant.key === 'can_embed_video')).toBe(true);
            const basicVideo = await db
                .select()
                .from(planVersionEntitlements)
                .where(
                    and(
                        eq(planVersionEntitlements.planVersionId, basicVersion.id),
                        eq(planVersionEntitlements.key, 'can_embed_video')
                    )
                );
            const trialEffects = await db
                .select()
                .from(planVersionEntitlements)
                .where(eq(planVersionEntitlements.planVersionId, trialVersion.id));
            expect(basicVideo).toHaveLength(1);
            expect(trialEffects).toHaveLength(0);
            const derivedTrialVideo = await db
                .select()
                .from(planVersionEntitlements)
                .where(
                    and(
                        eq(planVersionEntitlements.planVersionId, highestRank.id),
                        eq(planVersionEntitlements.key, 'can_embed_video')
                    )
                );
            expect(derivedTrialVideo).toHaveLength(1);
            for (const slug of ['owner-pro', 'owner-premium']) {
                const [plan] = await db
                    .select()
                    .from(plans)
                    .where(and(eq(plans.vertical, 'accommodation'), eq(plans.slug, slug)));
                if (!plan) throw new Error(`Expected ${slug} plan`);
                const [version] = await db
                    .select()
                    .from(planVersions)
                    .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)));
                if (!version) throw new Error(`Expected ${slug} current version`);
                const grant = await db
                    .select()
                    .from(planVersionEntitlements)
                    .where(
                        and(
                            eq(planVersionEntitlements.planVersionId, version.id),
                            eq(planVersionEntitlements.key, 'can_embed_video')
                        )
                    );
                expect(grant, slug).toHaveLength(1);
            }
            const basicOptions = await db
                .select()
                .from(billingOptions)
                .where(eq(billingOptions.planVersionId, basicVersion.id));
            expect(basicOptions.length).toBeGreaterThan(0);
            const oldAnchors = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.planVersionId, oldBasicVersion.id),
                        eq(subscriptions.class, 'PRINCIPAL'),
                        inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                    )
                );
            expect(oldAnchors).toHaveLength(0);
            const anchored = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.planVersionId, basicVersion.id),
                        eq(subscriptions.class, 'PRINCIPAL')
                    )
                );
            expect(anchored.every((row) => row.billingOptionId != null)).toBe(true);
        }
    );
});
