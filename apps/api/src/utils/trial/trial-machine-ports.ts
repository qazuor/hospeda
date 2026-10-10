import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, getDb, trialRedemptions, trials } from '@repo/db';
import type { TrialStatusEnum, Vertical } from '@repo/schemas';
import type {
    TrialAfterCommit,
    TrialExpiryScanner,
    TrialMachineTransaction,
    TrialMachineUnitOfWork
} from '@repo/verticals';
import { trialMachineLockKey } from '@repo/verticals';
import { and, eq, sql } from 'drizzle-orm';
import { invalidateEffectiveSetsForUser } from '../effective-set-cache';
import { getListingAccessPorts } from '../listing-access/ports';

function portOf(tx: DrizzleClient): TrialMachineTransaction {
    return {
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
        /** The outbox write is AC:V4:16 (V4.6, HOS-1448); this port is replaced there. */
        async scheduleExpiryCampaign() {},
        /** The outbox write is AC:V4:16 (V4.6, HOS-1448); this port is replaced there. */
        async scheduleRecoveryCampaign() {},
        /** The outbox write is AC:V4:16 (V4.6, HOS-1448); this port is replaced there. */
        async cancelCampaign() {},
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
        /** PLAZO:7 awaits the vertical deadlines table (V6.9, HOS-1479); action 11 and T3 never call this. */
        async findTrialCeilingDays() {
            throw new Error(
                'PLAZO:7 (trial ceiling) has no value until the verticals deadlines table lands (V6.9, HOS-1479)'
            );
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
