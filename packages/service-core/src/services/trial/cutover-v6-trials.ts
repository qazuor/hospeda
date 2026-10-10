import type { DrizzleClient } from '@repo/db';
import {
    accommodations,
    and,
    asc,
    desc,
    eq,
    experiences,
    gastronomies,
    getDb,
    isNull,
    plans,
    planVersions,
    trials,
    users,
    verticalDeadlineVersions
} from '@repo/db';
import type { Vertical } from '@repo/schemas';
import { ServiceErrorCode, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import type { TrialStartTransaction } from '@repo/verticals';
import { computePreExpiryMilestones } from '@repo/verticals';
import { ServiceError } from '../../types';
import { computeTrialEmailPseudonym } from './trial-email-pseudonym';

/** One published listing and its owner, for operator reconciliation. */
export interface CutoverTrialListing {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly listingId: string;
}

/** The complete proposed row, including the catalog references frozen at cutover. */
export interface CutoverTrialPlan extends CutoverTrialListing {
    readonly emailPseudonym: string;
    readonly trialPlanId: string;
    readonly floorEntitlementsVersionId: string;
    readonly floorLimitsVersionId: string;
    readonly floorTrialPlanVersionId: string;
    readonly startedAt: Date;
    readonly endsAt: Date;
    readonly deadlinesVersion: number;
}

/** Results to check against the five owners by hand. */
export interface CutoverTrialResult {
    readonly planned: readonly CutoverTrialPlan[];
    readonly written: readonly CutoverTrialListing[];
    readonly skipped: readonly CutoverTrialListing[];
}

type CampaignPort = TrialStartTransaction['scheduleExpiryCampaign'];

/**
 * V6 cutover tool, run after paso 3's `db:migrate` (DEC-MIG-006 pin 3).
 * This is a writer in the new system, not T1: it does not check coverage or
 * emit an activation notice. The standalone `scripts/cutover/` script never
 * imports system code. V4.6 will supply the real campaign adapter and its CLI;
 * until then the identical T1 scheduling port is injected by the caller.
 */
export async function writeCutoverTrials({
    db = getDb(),
    scheduleExpiryCampaign,
    dryRun = false
}: {
    readonly db?: DrizzleClient;
    readonly scheduleExpiryCampaign: CampaignPort;
    readonly dryRun?: boolean;
}): Promise<CutoverTrialResult> {
    const [accommodationRows, gastronomyRows, experienceRows] = await Promise.all([
        db
            .select({
                listingId: accommodations.id,
                userId: accommodations.ownerId,
                startedAt: accommodations.inactiveSince
            })
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.publicationStatus, 'PUBLISHED'),
                    isNull(accommodations.deletedAt)
                )
            ),
        db
            .select({
                listingId: gastronomies.id,
                userId: gastronomies.ownerId,
                startedAt: gastronomies.inactiveSince
            })
            .from(gastronomies)
            .where(
                and(eq(gastronomies.publicationStatus, 'PUBLISHED'), isNull(gastronomies.deletedAt))
            ),
        db
            .select({
                listingId: experiences.id,
                userId: experiences.ownerId,
                startedAt: experiences.inactiveSince
            })
            .from(experiences)
            .where(
                and(eq(experiences.publicationStatus, 'PUBLISHED'), isNull(experiences.deletedAt))
            )
    ]);
    const listings = [
        ...accommodationRows.map((row) => ({ ...row, vertical: VerticalEnum.ACCOMMODATION })),
        ...gastronomyRows.map((row) => ({ ...row, vertical: VerticalEnum.GASTRONOMY })),
        ...experienceRows.map((row) => ({ ...row, vertical: VerticalEnum.EXPERIENCE }))
    ];
    if (listings.length > 5) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'V6 cutover has more than five published listings'
        );
    }
    const seen = new Set<string>();
    for (const listing of listings) {
        const key = `${listing.userId}:${listing.vertical}`;
        if (seen.has(key)) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'V6 cutover owner has multiple published listings in one vertical'
            );
        }
        seen.add(key);
    }

    const [deadline] = await db
        .select({ version: verticalDeadlineVersions.version })
        .from(verticalDeadlineVersions)
        .orderBy(desc(verticalDeadlineVersions.version))
        .limit(1);
    if (!deadline) {
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'V6 cutover has no vertical deadline version'
        );
    }

    const planned: CutoverTrialPlan[] = [];
    for (const listing of listings) {
        const [owner] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, listing.userId))
            .limit(1);
        if (!owner) {
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'V6 cutover owner is missing'
            );
        }
        const pseudonym = computeTrialEmailPseudonym({ email: owner.email });
        if (!pseudonym.ok) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'V6 cutover owner has an invalid email'
            );
        }
        const versions = await db
            .select({
                id: planVersions.id,
                planId: planVersions.planId,
                rank: planVersions.rank,
                sellable: planVersions.sellable,
                trialDays: planVersions.trialDays,
                role: plans.role
            })
            .from(planVersions)
            .innerJoin(plans, eq(planVersions.planId, plans.id))
            .where(and(eq(planVersions.vertical, listing.vertical), eq(planVersions.current, true)))
            .orderBy(asc(planVersions.rank));
        const trial = versions.find((version) => version.role === 'trial');
        const sellable = versions.filter((version) => version.sellable);
        const lowest = sellable[0];
        const highest = sellable.at(-1);
        if (!trial || trial.trialDays < 1 || !lowest || !highest) {
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                `V6 cutover catalog is incomplete for ${listing.vertical}`
            );
        }
        if (!listing.startedAt) {
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'V6 cutover listing has no cutover instant'
            );
        }
        planned.push({
            userId: listing.userId,
            vertical: listing.vertical,
            listingId: listing.listingId,
            emailPseudonym: pseudonym.pseudonym,
            trialPlanId: trial.planId,
            floorEntitlementsVersionId: highest.id,
            floorLimitsVersionId: lowest.id,
            floorTrialPlanVersionId: trial.id,
            startedAt: listing.startedAt,
            endsAt: new Date(listing.startedAt.getTime() + trial.trialDays * 86_400_000),
            deadlinesVersion: deadline.version
        });
    }

    if (dryRun) return { planned, written: [], skipped: [] };
    const written: CutoverTrialListing[] = [];
    const skipped: CutoverTrialListing[] = [];
    for (const row of planned) {
        const inserted = await db.transaction(async (tx) => {
            const [created] = await tx
                .insert(trials)
                .values({
                    userId: row.userId,
                    vertical: row.vertical,
                    status: TrialStatusEnum.TRIAL_ACTIVE,
                    trialPlanId: row.trialPlanId,
                    floorEntitlementsVersionId: row.floorEntitlementsVersionId,
                    floorLimitsVersionId: row.floorLimitsVersionId,
                    floorTrialPlanVersionId: row.floorTrialPlanVersionId,
                    startedAt: row.startedAt,
                    endsAt: row.endsAt,
                    emailPseudonym: row.emailPseudonym,
                    deadlinesVersion: row.deadlinesVersion
                })
                .onConflictDoNothing({ target: [trials.userId, trials.vertical] })
                .returning({ id: trials.id });
            if (!created) return false;
            await scheduleExpiryCampaign({
                userId: row.userId,
                vertical: row.vertical,
                endsAt: row.endsAt,
                deadlinesVersion: row.deadlinesVersion,
                milestones: computePreExpiryMilestones({ endsAt: row.endsAt })
            });
            return true;
        });
        const listing = { userId: row.userId, vertical: row.vertical, listingId: row.listingId };
        (inserted ? written : skipped).push(listing);
    }
    return { planned, written, skipped };
}
