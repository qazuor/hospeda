import type { DrizzleClient } from '@repo/db';
import { plans, planVersions, trialRedemptions, trials, verticals } from '@repo/db';
import {
    type TrialStatusEnum,
    type Vertical,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { and, eq, sql } from 'drizzle-orm';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../../../db/src/models/listing/listing-publication.model';
import { trialMachineLockKey } from '../../../src/trial/trial-lock-key';
import type {
    TrialExpiryScanner,
    TrialMachineTransaction,
    TrialMachineUnitOfWork
} from '../../../src/trial/trial-machine-types';

type Campaign = {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly endsAt?: Date;
    readonly expiredAt?: Date;
    readonly deadlinesVersion: number;
    readonly milestones: readonly Date[];
};
type AdminExtension = Parameters<TrialMachineTransaction['recordAdminExtension']>[0];

const LISTING_VERTICAL_BY_VERTICAL: Readonly<Record<Vertical, ListingVertical | null>> = {
    [VerticalEnum.ACCOMMODATION]: VerticalEnum.ACCOMMODATION,
    [VerticalEnum.VENUE]: VerticalEnum.VENUE,
    [VerticalEnum.EXPERIENCE]: VerticalEnum.EXPERIENCE,
    [VerticalEnum.TOURIST]: null,
    [VerticalEnum.PARTNER]: null
};

export function createTrialMachineAdapter(args: {
    readonly db: DrizzleClient;
    readonly ceilingDays: (args: { vertical: string; deadlinesVersion: number }) => number;
    readonly failOn?: 'markExpired' | 'recordAdminExtension';
    readonly onLocked?: () => Promise<void>;
}): {
    unitOfWork: TrialMachineUnitOfWork;
    scanner: TrialExpiryScanner;
    stats: {
        readonly expiryCampaigns: readonly Campaign[];
        readonly recoveryCampaigns: readonly Campaign[];
        readonly cancellations: readonly { userId: string; vertical: Vertical; campaign: string }[];
        readonly adminExtensions: readonly AdminExtension[];
    };
} {
    const stats = {
        expiryCampaigns: [] as Campaign[],
        recoveryCampaigns: [] as Campaign[],
        cancellations: [] as { userId: string; vertical: Vertical; campaign: string }[],
        adminExtensions: [] as AdminExtension[]
    };

    function transactionPortOf(tx: DrizzleClient): TrialMachineTransaction {
        return {
            async findActivationEvent({ vertical }) {
                const [row] = await tx
                    .select({ event: verticals.activationEvent })
                    .from(verticals)
                    .where(eq(verticals.id, vertical))
                    .limit(1);
                return (row?.event ?? null) as VerticalActivationEvent | null;
            },
            async findTrialPlan({ vertical }) {
                const [row] = await tx
                    .select({
                        planId: plans.id,
                        planVersionId: planVersions.id,
                        trialDays: planVersions.trialDays
                    })
                    .from(planVersions)
                    .innerJoin(plans, eq(planVersions.planId, plans.id))
                    .where(
                        sql`${plans.vertical} = ${vertical} AND ${plans.role} = 'trial' AND ${planVersions.current} = true`
                    )
                    .limit(1);
                return row ?? null;
            },
            async findTrialOfUser({ userId, vertical }) {
                const [row] = await tx
                    .select({ id: trials.id })
                    .from(trials)
                    .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                    .limit(1);
                return row ?? null;
            },
            async findTrialByPseudonym({ emailPseudonym, vertical }) {
                const [row] = await tx
                    .select({ userId: trials.userId })
                    .from(trials)
                    .where(
                        and(
                            eq(trials.emailPseudonym, emailPseudonym),
                            eq(trials.vertical, vertical)
                        )
                    )
                    .limit(1);
                return row ?? null;
            },
            async insertTrial({ row }) {
                const inserted = await tx
                    .insert(trials)
                    .values({ ...row })
                    .onConflictDoNothing()
                    .returning({ id: trials.id });
                if (inserted.length > 0) return { inserted: true } as const;
                const [existing] = await tx
                    .select({ id: trials.id })
                    .from(trials)
                    .where(and(eq(trials.userId, row.userId), eq(trials.vertical, row.vertical)))
                    .limit(1);
                return {
                    inserted: false,
                    conflict: existing ? 'USER_VERTICAL' : 'EMAIL_PSEUDONYM'
                } as const;
            },
            async hasExercisedActivationEvent({ userId, vertical }) {
                const listingVertical = LISTING_VERTICAL_BY_VERTICAL[vertical];
                return listingVertical === null
                    ? false
                    : listingPublicationModel.hasOwnerPublished({
                          tx,
                          vertical: listingVertical,
                          userId
                      });
            },
            async findTrialForUpdate({ userId, vertical }) {
                const [row] = await tx
                    .select()
                    .from(trials)
                    .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                    .for('update');
                if (!row) return null;
                return {
                    id: row.id,
                    userId: row.userId,
                    vertical: row.vertical as Vertical,
                    status: row.status as TrialStatusEnum,
                    startedAt: row.startedAt,
                    endsAt: row.endsAt,
                    deadlinesVersion: row.deadlinesVersion
                };
            },
            async markConverted({ trialId }) {
                await tx
                    .update(trials)
                    .set({ status: 'TRIAL_CONVERTED', updatedAt: sql`now()` })
                    .where(eq(trials.id, trialId));
            },
            async markExpired({ trialId, deadlinesVersion }) {
                if (args.failOn === 'markExpired') throw new Error('markExpired failed on purpose');
                await tx
                    .update(trials)
                    .set({ status: 'TRIAL_EXPIRED', deadlinesVersion, updatedAt: sql`now()` })
                    .where(eq(trials.id, trialId));
            },
            async moveEndsAt({ trialId, endsAt }) {
                await tx
                    .update(trials)
                    .set({ endsAt, updatedAt: sql`now()` })
                    .where(eq(trials.id, trialId));
            },
            async scheduleExpiryCampaign(campaign) {
                stats.expiryCampaigns.push(campaign);
            },
            async scheduleRecoveryCampaign(campaign) {
                stats.recoveryCampaigns.push(campaign);
            },
            async cancelCampaign(cancellation) {
                stats.cancellations.push(cancellation);
            },
            async findRedemption({ redemptionKey }) {
                const [row] = await tx
                    .select({
                        userId: trialRedemptions.userId,
                        vertical: trialRedemptions.vertical
                    })
                    .from(trialRedemptions)
                    .where(eq(trialRedemptions.redemptionKey, redemptionKey))
                    .limit(1);
                return (row ?? null) as Awaited<
                    ReturnType<TrialMachineTransaction['findRedemption']>
                >;
            },
            async insertRedemption(redemption) {
                const rows = await tx
                    .insert(trialRedemptions)
                    .values(redemption)
                    .onConflictDoNothing({ target: trialRedemptions.redemptionKey })
                    .returning({ id: trialRedemptions.id });
                return { inserted: rows.length > 0 };
            },
            async findTrialCeilingDays({ vertical, deadlinesVersion }) {
                return args.ceilingDays({ vertical, deadlinesVersion });
            },
            async recordAdminExtension(extension) {
                if (args.failOn === 'recordAdminExtension')
                    throw new Error('recordAdminExtension failed on purpose');
                stats.adminExtensions.push(extension);
            }
        };
    }

    return {
        unitOfWork: {
            runLocked<T>(
                lockArgs: { userId: string; vertical: Vertical },
                work: (tx: TrialMachineTransaction) => Promise<T>
            ) {
                return args.db.transaction(async (tx) => {
                    await tx.execute(
                        sql`SELECT pg_advisory_xact_lock(hashtextextended(${trialMachineLockKey(lockArgs).key}, 0))`
                    );
                    await args.onLocked?.();
                    return work(transactionPortOf(tx as DrizzleClient));
                });
            }
        },
        scanner: {
            async findDueTrials({ now, limit }) {
                const rows = await args.db
                    .select({ userId: trials.userId, vertical: trials.vertical })
                    .from(trials)
                    .where(sql`${trials.status} = 'TRIAL_ACTIVE' AND ${trials.endsAt} <= ${now}`)
                    .orderBy(trials.endsAt)
                    .limit(limit);
                return rows as { userId: string; vertical: Vertical }[];
            }
        },
        stats
    };
}
