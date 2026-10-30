import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, getDb, plans, planVersions, trialRedemptions, trials } from '@repo/db';
import type { TrialStatusEnum, Vertical } from '@repo/schemas';
import {
    TRIAL_PLAN_ROLE,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VerticalEnum
} from '@repo/schemas';
import { recordCoverageLossIfUncovered } from '@repo/service-core';
import type {
    TrialAfterCommit,
    TrialExpiryScanner,
    TrialMachineTransaction,
    TrialMachineUnitOfWork
} from '@repo/verticals';
import { trialMachineLockKey } from '@repo/verticals';
import { and, eq, sql } from 'drizzle-orm';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { getClock } from '../clock';
import { invalidateEffectiveSetsForUser } from '../effective-set-cache';
import { getListingAccessPorts } from '../listing-access/ports';
import { buildTrialCampaignOutbox } from './trial-campaign-outbox';
import { readTrialCeilingDays } from './trial-ceiling';

export { TrialCeilingConfigurationError } from './trial-ceiling';

function portOf(tx: DrizzleClient): TrialMachineTransaction {
    const listingVerticalByVertical: Readonly<Record<Vertical, ListingVertical | null>> = {
        [VerticalEnum.ACCOMMODATION]: VerticalEnum.ACCOMMODATION,
        [VerticalEnum.VENUE]: VerticalEnum.VENUE,
        [VerticalEnum.EXPERIENCE]: VerticalEnum.EXPERIENCE,
        [VerticalEnum.TOURIST]: null,
        [VerticalEnum.PARTNER]: null
    };
    return {
        async findActivationEvent({ vertical }) {
            return VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[vertical];
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
                    sql`${plans.vertical} = ${vertical} AND ${plans.role} = ${TRIAL_PLAN_ROLE} AND ${planVersions.current} = true`
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
                    and(eq(trials.emailPseudonym, emailPseudonym), eq(trials.vertical, vertical))
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
            const listingVertical = listingVerticalByVertical[vertical];
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
        /**
         * Expires the trial and, in the SAME transaction, records the coverage
         * loss of its `(user, vertical)` when no billing source is left (I-5,
         * AC:B4:4): `retentionStopped` answers that instant after the commit
         * even when the coverage notice is delayed or lost.
         */
        async markExpired({ trialId, deadlinesVersion }) {
            const [expired] = await tx
                .update(trials)
                .set({ status: 'TRIAL_EXPIRED', deadlinesVersion, updatedAt: sql`now()` })
                .where(eq(trials.id, trialId))
                .returning({ userId: trials.userId, vertical: trials.vertical });
            if (!expired) return;
            const { clock } = getClock();
            await recordCoverageLossIfUncovered({
                tx,
                userId: expired.userId,
                vertical: expired.vertical,
                lostAt: clock.now(),
                clock
            });
        },
        async moveEndsAt({ trialId, endsAt }) {
            await tx
                .update(trials)
                .set({ endsAt, updatedAt: sql`now()` })
                .where(eq(trials.id, trialId));
        },
        ...buildTrialCampaignOutbox({ tx, clock: getClock().clock }),
        async findRedemption({ redemptionKey }) {
            const [row] = await tx
                .select({ userId: trialRedemptions.userId, vertical: trialRedemptions.vertical })
                .from(trialRedemptions)
                .where(eq(trialRedemptions.redemptionKey, redemptionKey))
                .limit(1);
            return (row ?? null) as Awaited<ReturnType<TrialMachineTransaction['findRedemption']>>;
        },
        async insertRedemption(redemption) {
            const rows = await tx
                .insert(trialRedemptions)
                .values(redemption)
                .onConflictDoNothing({ target: trialRedemptions.redemptionKey })
                .returning({ id: trialRedemptions.id });
            return { inserted: rows.length > 0 };
        },
        /** PLAZO:7 is shared by verticals and pinned to each trial's deadlines version. */
        async findTrialCeilingDays({ vertical, deadlinesVersion }) {
            return readTrialCeilingDays({ db: tx, vertical, deadlinesVersion });
        },
        async recordAdminExtension({
            trialId,
            actorId,
            reason,
            days,
            previousEndsAt,
            endsAt,
            occurredAt
        }) {
            await domainEventModel.insert({
                eventType: 'trial.extended',
                entityType: 'trial',
                entityId: trialId,
                actorId,
                actorType: 'admin',
                reason,
                correlationId: randomUUID(),
                changes: [
                    {
                        field: 'endsAt',
                        old: previousEndsAt.toISOString(),
                        new: endsAt.toISOString()
                    },
                    { field: 'days', new: days },
                    { field: 'origin', new: 'SUPER_ADMIN' }
                ],
                occurredAt,
                tx
            });
        }
    };
}

let ports:
    | {
          readonly unitOfWork: TrialMachineUnitOfWork;
          readonly scanner: TrialExpiryScanner;
          readonly afterCommit: TrialAfterCommit;
      }
    | undefined;

/** Production composition for T2–T5; tests replace this module with vi.mock. */
export function getTrialMachinePorts(): {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly scanner: TrialExpiryScanner;
    readonly afterCommit: TrialAfterCommit;
} {
    if (ports) return ports;
    ports = {
        unitOfWork: {
            runLocked<T>(
                args: { userId: string; vertical: Vertical },
                work: (tx: TrialMachineTransaction) => Promise<T>
            ) {
                return getDb().transaction(async (tx) => {
                    await tx.execute(
                        sql`SELECT pg_advisory_xact_lock(hashtextextended(${trialMachineLockKey(args).key}, 0))`
                    );
                    return work(portOf(tx as DrizzleClient));
                });
            }
        },
        scanner: {
            async findDueTrials({ now, limit }) {
                const rows = await getDb()
                    .select({ userId: trials.userId, vertical: trials.vertical })
                    .from(trials)
                    .where(sql`${trials.status} = 'TRIAL_ACTIVE' AND ${trials.endsAt} <= ${now}`)
                    .orderBy(trials.endsAt)
                    .limit(limit);
                return rows as { userId: string; vertical: Vertical }[];
            }
        },
        afterCommit: {
            emitCoverageChanged: (event) =>
                getListingAccessPorts().billing.emitCoverageChanged(event),
            invalidateUser: ({ userId }) => invalidateEffectiveSetsForUser(userId)
        }
    };
    return ports;
}
