/** TEST:V5:10 — migrated catalog and bootstrap coverage decide listing writes. */
import { randomUUID } from 'node:crypto';
import {
    accommodations,
    type DrizzleClient,
    destinations,
    planCatalogModel,
    plans,
    planVersions,
    trials,
    users
} from '@repo/db';
import {
    FLOOR_PLAN_ROLE,
    PRE_TRIAL_PLAN_ROLE,
    PublicationStatusEnum,
    TRIAL_PLAN_ROLE,
    TrialStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { resolveEffectiveSet } from '../../src/effective-set/resolve-effective-set';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
class Rollback extends Error {}
async function inRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}

const vertical = VerticalEnum.ACCOMMODATION;

describe('AC:V5:9 / TEST:V5:10 migrated coverage and effective set', () => {
    it('checks published EDIT, draft EDIT and PUBLISH, then trial EDIT', async () => {
        await inRollback(async (tx) => {
            const [user] = await tx
                .insert(users)
                .values({
                    email: `coverage-step-${randomUUID()}@example.com`,
                    displayName: 'Coverage owner'
                })
                .returning({ id: users.id });
            if (!user) throw new Error('User insert failed');
            const [destination] = await tx
                .insert(destinations)
                .values({
                    destinationType: 'CITY',
                    path: `/coverage-step-${randomUUID()}`,
                    slug: randomUUID(),
                    name: 'Coverage city',
                    summary: 'Coverage city',
                    description: 'Coverage city',
                    location: { coordinates: { lat: '-32.49', long: '-58.23' } }
                })
                .returning({ id: destinations.id });
            if (!destination) throw new Error('Destination insert failed');
            const [listing] = await tx
                .insert(accommodations)
                .values({
                    type: 'HOTEL',
                    slug: randomUUID(),
                    name: 'Coverage listing',
                    summary: 'Coverage listing',
                    description: 'Coverage listing',
                    ownerId: user.id,
                    destinationId: destination.id,
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: new Date(),
                    deadlinesVersion: 1
                })
                .returning({
                    id: accommodations.id,
                    ownerId: accommodations.ownerId,
                    publicationStatus: accommodations.publicationStatus
                });
            if (!listing) throw new Error('Listing insert failed');
            const bootstrapReader = createBootstrapCoverageReader(tx);
            const billing = createBootstrapBillingForVerticals({ reader: bootstrapReader });
            const coverage = vi.spyOn(billing, 'coverage');
            const reader = {
                findPlanVersion: ({ id }: { readonly id: string }) =>
                    planCatalogModel.findPlanVersion({ id, tx }),
                findPlanVersionEffects: ({ id }: { readonly id: string }) =>
                    planCatalogModel.findPlanVersionEffects({ id, tx }),
                findAddonVersion: ({ id }: { readonly id: string }) =>
                    planCatalogModel.findAddonVersion({ id, tx }),
                findPlanVersionSummary: ({ id }: { readonly id: string }) =>
                    planCatalogModel.findPlanVersionSummary({ id, tx }),
                findSellableCurrentVersions: ({
                    vertical: requestedVertical
                }: {
                    readonly vertical: string;
                }) =>
                    planCatalogModel.findSellableCurrentVersions({
                        vertical: requestedVertical,
                        tx
                    }),
                findCurrentPlanVersion: ({ planId }: { readonly planId: string }) =>
                    planCatalogModel.findCurrentPlanVersion({ planId, tx })
            };
            const effectiveSet = async (args: {
                readonly userId: string;
                readonly vertical: VerticalEnum;
            }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    ...(await resolveEffectiveSet({
                        reader,
                        billing,
                        trials: bootstrapReader,
                        ...args
                    }))
                });
            const common = {
                actorId: user.id,
                vertical,
                facts: {
                    ownerId: listing.ownerId,
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                },
                billing,
                effectiveSet
            };
            expect(await resolveListingAccess({ ...common, operation: 'EDIT' })).toEqual({
                allowed: false,
                reason: 'NO_CAPABILITY',
                key: 'edit_accommodation_info'
            });
            expect(coverage).toHaveBeenCalledWith({ userId: user.id, vertical });
            expect(
                (await billing.coverage({ userId: user.id, vertical })).sources.some(
                    (source) => source.type === 'BASE'
                )
            ).toBe(true);
            const draft = {
                ...common,
                facts: { ...common.facts, publicationStatus: PublicationStatusEnum.DRAFT }
            };
            expect(await resolveListingAccess({ ...draft, operation: 'EDIT' })).toEqual({
                allowed: true,
                subjectId: user.id,
                evaluatedSteps: [4, 5]
            });
            expect(await resolveListingAccess({ ...draft, operation: 'PUBLISH' })).toEqual({
                allowed: true,
                subjectId: user.id,
                evaluatedSteps: [4, 5, 6]
            });

            const roles = await tx
                .select({ role: plans.role, planId: plans.id, versionId: planVersions.id })
                .from(plans)
                .innerJoin(planVersions, eq(planVersions.planId, plans.id))
                .where(and(eq(plans.vertical, vertical), eq(planVersions.current, true)));
            const versionFor = (
                role: typeof PRE_TRIAL_PLAN_ROLE | typeof FLOOR_PLAN_ROLE | typeof TRIAL_PLAN_ROLE
            ) => {
                const row = roles.find((item) => item.role === role);
                if (!row) throw new Error(`Missing migrated ${role} version`);
                return row;
            };
            const preTrial = versionFor(PRE_TRIAL_PLAN_ROLE);
            const floor = versionFor(FLOOR_PLAN_ROLE);
            const trial = versionFor(TRIAL_PLAN_ROLE);
            const [premium] = await tx
                .select({ versionId: planVersions.id })
                .from(plans)
                .innerJoin(planVersions, eq(planVersions.planId, plans.id))
                .where(and(eq(plans.slug, 'owner-premium'), eq(planVersions.current, true)))
                .limit(1);
            if (!premium) throw new Error('Missing migrated premium version');
            const startedAt = new Date();
            const endsAt = new Date(startedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
            await tx.insert(trials).values({
                userId: user.id,
                vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                trialPlanId: trial.planId,
                floorEntitlementsVersionId: premium.versionId,
                floorLimitsVersionId: floor.versionId,
                floorTrialPlanVersionId: trial.versionId,
                startedAt,
                endsAt,
                emailPseudonym: randomUUID().replaceAll('-', '').padEnd(64, '0'),
                deadlinesVersion: 1
            });
            expect(preTrial.versionId).toBeDefined();
            expect(await resolveListingAccess({ ...common, operation: 'EDIT' })).toEqual({
                allowed: true,
                subjectId: user.id,
                evaluatedSteps: [4, 5, 6]
            });
        });
    });
});
