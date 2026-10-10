/** TEST:V6:21 — the V6 cutover writer against the real migrated catalog. */

import type { DrizzleClient } from '@repo/db';
import {
    accommodations,
    and,
    eq,
    experiences,
    gastronomies,
    inArray,
    isNull,
    plans,
    planVersions,
    trials,
    users,
    verticalDeadlineVersions
} from '@repo/db';
import type { Vertical } from '@repo/schemas';
import { PublicationStatusEnum, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import type { TrialStartTransaction } from '@repo/verticals';
import { computePreExpiryMilestones } from '@repo/verticals';
import { afterAll, describe, expect, it } from 'vitest';
import { computeTrialEmailPseudonym, writeCutoverTrials } from '../../../src/services/trial';
import {
    closeServiceTestPool,
    seedAccommodation,
    seedExperience,
    seedGastronomy,
    withServiceTestTransaction
} from './helpers';

type Campaign = Parameters<TrialStartTransaction['scheduleExpiryCampaign']>[0];
type Kind = 'accommodation' | 'gastronomy' | 'experience';
interface SeededListing {
    readonly userId: string;
    readonly listingId: string;
    readonly vertical: Vertical;
    readonly email: string;
}
const cutoverInstant = new Date('2026-10-10T12:00:00.000Z');

async function hideOtherPublishedListings(tx: DrizzleClient): Promise<void> {
    await tx
        .update(accommodations)
        .set({ publicationStatus: 'DRAFT' })
        .where(
            and(eq(accommodations.publicationStatus, 'PUBLISHED'), isNull(accommodations.deletedAt))
        );
    await tx
        .update(gastronomies)
        .set({ publicationStatus: 'DRAFT' })
        .where(
            and(eq(gastronomies.publicationStatus, 'PUBLISHED'), isNull(gastronomies.deletedAt))
        );
    await tx
        .update(experiences)
        .set({ publicationStatus: 'DRAFT' })
        .where(and(eq(experiences.publicationStatus, 'PUBLISHED'), isNull(experiences.deletedAt)));
}

async function seedPublished(tx: DrizzleClient, kind: Kind): Promise<SeededListing> {
    const overrides = {
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        inactiveSince: cutoverInstant
    };
    let userId: string;
    let listingId: string;
    let vertical: Vertical;
    if (kind === 'accommodation') {
        const row = await seedAccommodation(tx, overrides);
        userId = row.userId;
        listingId = row.accommodationId;
        vertical = VerticalEnum.ACCOMMODATION;
    } else if (kind === 'gastronomy') {
        const row = await seedGastronomy(tx, overrides);
        userId = row.ownerId;
        listingId = row.gastronomyId;
        vertical = VerticalEnum.GASTRONOMY;
    } else {
        const row = await seedExperience(tx, overrides);
        userId = row.ownerId;
        listingId = row.experienceId;
        vertical = VerticalEnum.EXPERIENCE;
    }
    const email = `cutover-${userId}@example.test`;
    await tx.update(users).set({ email }).where(eq(users.id, userId));
    return { userId, listingId, vertical, email };
}

async function trialsFor(tx: DrizzleClient, seeded: readonly SeededListing[]) {
    return tx
        .select()
        .from(trials)
        .where(
            inArray(
                trials.userId,
                seeded.map((row) => row.userId)
            )
        );
}

/** Independent catalog read used for assertions, never the writer's planned row. */
async function expectedCatalog(tx: DrizzleClient, vertical: Vertical) {
    const versions = await tx
        .select({
            id: planVersions.id,
            planId: planVersions.planId,
            trialDays: planVersions.trialDays,
            rank: planVersions.rank,
            sellable: planVersions.sellable,
            role: plans.role
        })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(and(eq(plans.vertical, vertical), eq(planVersions.current, true)));
    const trial = versions.find((row) => row.role === 'trial');
    const ordered = versions.filter((row) => row.sellable).sort((a, b) => a.rank - b.rank);
    const limits = ordered[0];
    const entitlements = ordered.at(-1);
    if (!trial || !limits || !entitlements) throw new Error('Missing seeded plan catalog');
    return { trial, limits, entitlements };
}

describe('TEST:V6:21 cutover V6 trials', () => {
    afterAll(closeServiceTestPool);

    it('writes five active catalog-backed trials and schedules five campaigns; a rerun skips them', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const seeded = await Promise.all([
                seedPublished(tx, 'accommodation'),
                seedPublished(tx, 'accommodation'),
                seedPublished(tx, 'gastronomy'),
                seedPublished(tx, 'gastronomy'),
                seedPublished(tx, 'experience')
            ]);
            const campaigns: Campaign[] = [];
            const scheduleExpiryCampaign: TrialStartTransaction['scheduleExpiryCampaign'] = async (
                args
            ) => {
                campaigns.push(args);
            };
            const result = await writeCutoverTrials({ db: tx, scheduleExpiryCampaign });
            expect(result.written).toHaveLength(5);
            expect(result.skipped).toHaveLength(0);
            expect(new Set(result.written.map((row) => row.listingId))).toEqual(
                new Set(seeded.map((row) => row.listingId))
            );
            const stored = await trialsFor(tx, seeded);
            expect(stored).toHaveLength(5);
            const allDeadlines = await tx
                .select({ version: verticalDeadlineVersions.version })
                .from(verticalDeadlineVersions);
            const maxVersion = Math.max(...allDeadlines.map((row) => row.version));
            for (const owner of seeded) {
                const row = stored.find((entry) => entry.userId === owner.userId);
                expect(row).toBeDefined();
                const pseudonym = computeTrialEmailPseudonym({ email: owner.email });
                expect(pseudonym.ok).toBe(true);
                if (!row || !pseudonym.ok) throw new Error('Missing trial or pseudonym');
                const catalog = await expectedCatalog(tx, owner.vertical);
                const endsAt = new Date(
                    cutoverInstant.getTime() + catalog.trial.trialDays * 86_400_000
                );
                expect(row).toMatchObject({
                    vertical: owner.vertical,
                    status: TrialStatusEnum.TRIAL_ACTIVE,
                    emailPseudonym: pseudonym.pseudonym,
                    trialPlanId: catalog.trial.planId,
                    floorTrialPlanVersionId: catalog.trial.id,
                    floorLimitsVersionId: catalog.limits.id,
                    floorEntitlementsVersionId: catalog.entitlements.id,
                    deadlinesVersion: maxVersion
                });
                expect(row.startedAt).toEqual(cutoverInstant);
                expect(row.endsAt).toEqual(endsAt);
                expect(campaigns.find((campaign) => campaign.userId === owner.userId)).toEqual({
                    userId: owner.userId,
                    vertical: owner.vertical,
                    endsAt,
                    deadlinesVersion: maxVersion,
                    milestones: computePreExpiryMilestones({ endsAt })
                });
            }
            expect(campaigns).toHaveLength(5);
            const second = await writeCutoverTrials({ db: tx, scheduleExpiryCampaign });
            expect(second.written).toEqual([]);
            expect(second.skipped).toHaveLength(5);
            expect(await trialsFor(tx, seeded)).toHaveLength(5);
            expect(campaigns).toHaveLength(5);
        });
    });

    it('rejects six published listings before writing any trial', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const seeded = await Promise.all(
                Array.from({ length: 6 }, () => seedPublished(tx, 'accommodation'))
            );
            const campaigns: Campaign[] = [];
            await expect(
                writeCutoverTrials({
                    db: tx,
                    scheduleExpiryCampaign: async (args) => {
                        campaigns.push(args);
                    }
                })
            ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
            expect(await trialsFor(tx, seeded)).toEqual([]);
            expect(campaigns).toEqual([]);
        });
    });

    it('rejects two published listings for one owner and vertical before writing', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const first = await seedPublished(tx, 'accommodation');
            const second = await seedPublished(tx, 'accommodation');
            await tx
                .update(accommodations)
                .set({ ownerId: first.userId })
                .where(eq(accommodations.id, second.listingId));
            await expect(
                writeCutoverTrials({ db: tx, scheduleExpiryCampaign: async () => {} })
            ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
            expect(await trialsFor(tx, [first, second])).toEqual([]);
        });
    });

    it('rejects an invalid owner email before writing', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const good = await seedPublished(tx, 'accommodation');
            const bad = await seedPublished(tx, 'gastronomy');
            await tx.update(users).set({ email: 'invalid-email' }).where(eq(users.id, bad.userId));
            await expect(
                writeCutoverTrials({ db: tx, scheduleExpiryCampaign: async () => {} })
            ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
            expect(await trialsFor(tx, [good, bad])).toEqual([]);
        });
    });

    it('returns a dry-run plan without inserts or campaigns', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const seeded = [await seedPublished(tx, 'experience')];
            const campaigns: Campaign[] = [];
            const result = await writeCutoverTrials({
                db: tx,
                dryRun: true,
                scheduleExpiryCampaign: async (args) => {
                    campaigns.push(args);
                }
            });
            expect(result.planned).toHaveLength(1);
            expect(result.planned[0]).toMatchObject({
                userId: seeded[0]?.userId,
                listingId: seeded[0]?.listingId
            });
            expect(result.written).toEqual([]);
            expect(result.skipped).toEqual([]);
            expect(await trialsFor(tx, seeded)).toEqual([]);
            expect(campaigns).toEqual([]);
        });
    });

    it('rolls back only the failed third row and completes it on retry', async () => {
        await withServiceTestTransaction(async (tx) => {
            await hideOtherPublishedListings(tx);
            const seeded = [
                await seedPublished(tx, 'accommodation'),
                await seedPublished(tx, 'gastronomy'),
                await seedPublished(tx, 'experience')
            ];
            const failure = new Error('campaign unavailable');
            let calls = 0;
            await expect(
                writeCutoverTrials({
                    db: tx,
                    scheduleExpiryCampaign: async () => {
                        calls += 1;
                        if (calls === 3) throw failure;
                    }
                })
            ).rejects.toBe(failure);
            expect(await trialsFor(tx, seeded)).toHaveLength(2);
            const retry: Campaign[] = [];
            const result = await writeCutoverTrials({
                db: tx,
                scheduleExpiryCampaign: async (args) => {
                    retry.push(args);
                }
            });
            expect(result.written).toHaveLength(1);
            expect(result.skipped).toHaveLength(2);
            expect(await trialsFor(tx, seeded)).toHaveLength(3);
            expect(retry).toHaveLength(1);
        });
    });
});
