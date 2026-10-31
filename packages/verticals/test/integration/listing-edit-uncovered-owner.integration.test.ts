/**
 * HOS-1884 — an owner with no coverage reads their listing but cannot edit it.
 *
 * Twin of `apps/e2e/tests/verticals/uncovered-owner-read-not-edit.spec.ts`: same
 * rule, decided by the real `resolveListingAccess` over the migrated catalog and
 * the real bootstrap coverage, with no HTTP and no mocks in between.
 *
 * Measured: a spent trial leaves `sources = [BASE]` and `covered = false`. The
 * BASE source is always present, so step 5 (`NO_COVERAGE`, empty sources) never
 * fires for a real account; the EDIT of a PUBLISHED listing is refused by step 6
 * with `NO_CAPABILITY` on `edit_accommodation_info`, which the API maps to
 * `403 ENTITLEMENT_REQUIRED`.
 */
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
    PublicationStatusEnum,
    TRIAL_PLAN_ROLE,
    TrialStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
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
const DAY_MS = 24 * 60 * 60 * 1000;

/** Owner + PUBLISHED listing + the access ports, all inside one rolled-back transaction. */
async function arrange(tx: DrizzleClient) {
    const [user] = await tx
        .insert(users)
        .values({ email: `uncovered-${randomUUID()}@example.com`, displayName: 'Uncovered owner' })
        .returning({ id: users.id });
    if (!user) throw new Error('User insert failed');
    const [destination] = await tx
        .insert(destinations)
        .values({
            destinationType: 'CITY',
            path: `/uncovered-${randomUUID()}`,
            slug: randomUUID(),
            name: 'Uncovered city',
            summary: 'Uncovered city',
            description: 'Uncovered city',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Destination insert failed');
    const [listing] = await tx
        .insert(accommodations)
        .values({
            type: 'HOTEL',
            slug: randomUUID(),
            name: 'Uncovered listing',
            summary: 'Uncovered listing',
            description: 'Uncovered listing',
            ownerId: user.id,
            destinationId: destination.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1
        })
        .returning({ ownerId: accommodations.ownerId });
    if (!listing) throw new Error('Listing insert failed');

    const bootstrapReader = createBootstrapCoverageReader(tx);
    const billing = createBootstrapBillingForVerticals({ reader: bootstrapReader });
    const reader = {
        findPlanVersion: ({ id }: { readonly id: string }) =>
            planCatalogModel.findPlanVersion({ id, tx }),
        findPlanVersionEffects: ({ id }: { readonly id: string }) =>
            planCatalogModel.findPlanVersionEffects({ id, tx }),
        findAddonVersion: ({ id }: { readonly id: string }) =>
            planCatalogModel.findAddonVersion({ id, tx }),
        findPlanVersionSummary: ({ id }: { readonly id: string }) =>
            planCatalogModel.findPlanVersionSummary({ id, tx }),
        findSellableCurrentVersions: ({ vertical: requested }: { readonly vertical: string }) =>
            planCatalogModel.findSellableCurrentVersions({ vertical: requested, tx }),
        findCurrentPlanVersion: ({ planId }: { readonly planId: string }) =>
            planCatalogModel.findCurrentPlanVersion({ planId, tx })
    };
    const effectiveSet = async (args: {
        readonly userId: string;
        readonly vertical: VerticalEnum;
    }) =>
        rehydrateEffectiveSet({
            version: 1,
            ...(await resolveEffectiveSet({ reader, billing, trials: bootstrapReader, ...args }))
        });
    return {
        userId: user.id,
        ownerId: listing.ownerId,
        billing,
        effectiveSet
    };
}

/** Insert the owner's trial in the given status, with its clock on the matching side of now. */
async function insertTrial(args: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly status: TrialStatusEnum.TRIAL_ACTIVE | TrialStatusEnum.TRIAL_EXPIRED;
}): Promise<void> {
    const { tx, userId, status } = args;
    const roles = await tx
        .select({ role: plans.role, planId: plans.id, versionId: planVersions.id })
        .from(plans)
        .innerJoin(planVersions, eq(planVersions.planId, plans.id))
        .where(and(eq(plans.vertical, vertical), eq(planVersions.current, true)));
    const find = (role: typeof FLOOR_PLAN_ROLE | typeof TRIAL_PLAN_ROLE) => {
        const row = roles.find((item) => item.role === role);
        if (!row) throw new Error(`Missing migrated ${role} version`);
        return row;
    };
    const floor = find(FLOOR_PLAN_ROLE);
    const trial = find(TRIAL_PLAN_ROLE);
    const [premium] = await tx
        .select({ versionId: planVersions.id })
        .from(plans)
        .innerJoin(planVersions, eq(planVersions.planId, plans.id))
        .where(and(eq(plans.slug, 'owner-premium'), eq(planVersions.current, true)))
        .limit(1);
    if (!premium) throw new Error('Missing migrated premium version');
    const now = Date.now();
    const active = status === TrialStatusEnum.TRIAL_ACTIVE;
    await tx.insert(trials).values({
        userId,
        vertical,
        status,
        trialPlanId: trial.planId,
        floorEntitlementsVersionId: premium.versionId,
        floorLimitsVersionId: floor.versionId,
        floorTrialPlanVersionId: trial.versionId,
        startedAt: new Date(active ? now : now - 31 * DAY_MS),
        endsAt: new Date(active ? now + 14 * DAY_MS : now - DAY_MS),
        emailPseudonym: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        deadlinesVersion: 1
    });
}

describe('HOS-1884 uncovered owner: read yes, edit no', () => {
    it('with a spent trial: coverage is BASE only, READ_OWN passes, EDIT of a PUBLISHED listing is NO_CAPABILITY', async () => {
        await inRollback(async (tx) => {
            // Arrange
            const ctx = await arrange(tx);
            await insertTrial({ tx, userId: ctx.userId, status: TrialStatusEnum.TRIAL_EXPIRED });
            const common = {
                actorId: ctx.userId,
                vertical,
                facts: { ownerId: ctx.ownerId, publicationStatus: PublicationStatusEnum.PUBLISHED },
                billing: ctx.billing,
                effectiveSet: ctx.effectiveSet
            };

            // Act
            const coverage = await ctx.billing.coverage({ userId: ctx.userId, vertical });
            const read = await resolveListingAccess({ ...common, operation: 'READ_OWN' });
            const edit = await resolveListingAccess({ ...common, operation: 'EDIT' });

            // Assert
            expect(coverage.covered).toBe(false);
            expect(coverage.sources.map((source) => source.type)).toEqual(['BASE']);
            expect(read).toEqual({ allowed: true, subjectId: ctx.userId, evaluatedSteps: [4] });
            expect(edit).toEqual({
                allowed: false,
                reason: 'NO_CAPABILITY',
                key: 'edit_accommodation_info'
            });
        });
    });

    it('control: the same listing with an active trial passes EDIT', async () => {
        await inRollback(async (tx) => {
            // Arrange
            const ctx = await arrange(tx);
            await insertTrial({ tx, userId: ctx.userId, status: TrialStatusEnum.TRIAL_ACTIVE });

            // Act
            const edit = await resolveListingAccess({
                actorId: ctx.userId,
                vertical,
                facts: { ownerId: ctx.ownerId, publicationStatus: PublicationStatusEnum.PUBLISHED },
                billing: ctx.billing,
                effectiveSet: ctx.effectiveSet,
                operation: 'EDIT'
            });

            // Assert
            expect(edit).toEqual({
                allowed: true,
                subjectId: ctx.userId,
                evaluatedSteps: [4, 5, 6]
            });
        });
    });
});
