import {
    type DrizzleClient,
    emailOutbox,
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    subscriptions,
    users
} from '@repo/db';
import {
    PlanMigrationCancelInputSchema,
    type PlanMigrationCancelResult,
    PlanMigrationCancelResultSchema
} from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    assertPlanMigrationActionPermitted,
    planMigrationRejection
} from './plan-migration-authorization.js';
import {
    enqueuePlanMigrationNotice,
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_CANCELLED_TEMPLATE,
    planMigrationNoticeDedupKey
} from './plan-migration-notice.js';

const announcementSchema = z.object({
    planMigrationId: z.string().uuid(),
    planMigrationSubscriptionId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    vertical: z.string().min(1),
    planName: z.string().min(1),
    targetPlanName: z.string().min(1),
    direction: z.enum(['UP', 'DOWN']),
    currentAmountMinor: z.number().int().nonnegative(),
    newAmountMinor: z.number().int().nonnegative().nullable(),
    currency: z.string().min(1),
    applicationDate: z.string().nullable(),
    losesPromo: z.boolean(),
    deadlinesVersion: z.number().int().positive(),
    // Absent on a retirement announcement, which is what keeps its payload byte-identical.
    reason: z.enum(['RETIREMENT', 'PRICE_INCREASE']).optional()
});

/** Cancel an announced migration and queue each affected customer's notice atomically. */
export async function cancelPlanMigration(
    input: {
        readonly actor?: Actor;
        readonly planMigrationId: unknown;
        readonly db?: DrizzleClient;
    },
    ports: { readonly clock: { readonly now: () => Date } }
): Promise<PlanMigrationCancelResult> {
    assertPlanMigrationActionPermitted({ actor: input.actor });
    const parsed = PlanMigrationCancelInputSchema.safeParse({
        planMigrationId: input.planMigrationId
    });
    if (!parsed.success)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration input.'
        });
    const actor = input.actor;
    if (!actor)
        throw planMigrationRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    const db = input.db ?? getDb();
    return db.transaction(async (tx) => {
        const [migration] = await tx
            .select({
                id: planMigrations.id,
                announcedAt: planMigrations.announcedAt,
                cancelledAt: planMigrations.cancelledAt
            })
            .from(planMigrations)
            .where(eq(planMigrations.id, parsed.data.planMigrationId))
            .for('update');
        if (!migration)
            throw planMigrationRejection({
                reason: 'PLAN_MIGRATION_NOT_FOUND',
                message: 'Plan migration not found.'
            });
        if (migration.cancelledAt)
            throw planMigrationRejection({
                reason: 'PLAN_MIGRATION_ALREADY_CANCELLED',
                message: 'Plan migration already cancelled.'
            });

        const rows = await tx
            .select({
                id: planMigrationSubscriptions.id,
                subscriptionId: planMigrationSubscriptions.subscriptionId,
                status: planMigrationSubscriptions.status,
                applicationDate: planMigrationSubscriptions.applicationDate
            })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, migration.id))
            .orderBy(planMigrationSubscriptions.id)
            .for('update');
        const cancelledAt = ports.clock.now();
        const today = getLocalDateString({ instant: cancelledAt });
        await tx
            .update(planMigrations)
            .set({ cancelledAt, cancelledBy: actor.id })
            .where(eq(planMigrations.id, migration.id));
        const counts = { cancelled: 0, alreadyStarted: 0, untouched: 0 };
        for (const row of rows) {
            if (row.status === 'PENDIENTE' || row.status === 'PARA_RESOLVER') {
                await tx
                    .update(planMigrationSubscriptions)
                    .set({ status: 'CANCELADA' })
                    .where(eq(planMigrationSubscriptions.id, row.id));
                counts.cancelled += 1;
                if (row.status === 'PENDIENTE')
                    await enqueueCancellation({
                        tx,
                        migrationId: migration.id,
                        announcedAt: migration.announcedAt,
                        row,
                        today,
                        variant: 'NOTHING_CHANGES'
                    });
            } else if (
                row.status === 'APLICADA' &&
                getLocalDateString({ instant: row.applicationDate }) > today
            ) {
                counts.alreadyStarted += 1;
                await enqueueCancellation({
                    tx,
                    migrationId: migration.id,
                    announcedAt: migration.announcedAt,
                    row,
                    today,
                    variant: 'ALREADY_STARTED'
                });
            } else {
                counts.untouched += 1;
            }
        }
        return PlanMigrationCancelResultSchema.parse({
            planMigrationId: migration.id,
            cancelledAt,
            rows: counts
        });
    });
}

async function enqueueCancellation(args: {
    readonly tx: DrizzleClient;
    readonly migrationId: string;
    readonly announcedAt: Date;
    readonly row: {
        readonly id: string;
        readonly subscriptionId: string;
        readonly applicationDate: Date;
    };
    readonly today: string;
    readonly variant: 'NOTHING_CHANGES' | 'ALREADY_STARTED';
}): Promise<void> {
    const [recipient] = await args.tx
        .select({ userId: users.id, email: users.email })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .where(eq(subscriptions.id, args.row.subscriptionId));
    if (!recipient?.email) throw new Error('Migration cancellation recipient missing');
    const announcementKey = planMigrationNoticeDedupKey({
        recipientUserId: recipient.userId,
        template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
        planMigrationSubscriptionId: args.row.id,
        milestone: 'mig:announce',
        targetDate: getLocalDateString({ instant: args.announcedAt })
    });
    const [announcement] = await args.tx
        .select({ payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.dedupKey, announcementKey));
    const { reason, ...details } = announcementSchema.parse(announcement?.payload);
    if (args.variant === 'ALREADY_STARTED' && details.newAmountMinor === null)
        throw new Error('Applied migration destination price missing');
    await enqueuePlanMigrationNotice({
        tx: args.tx,
        template: PLAN_MIGRATION_CANCELLED_TEMPLATE,
        row: {
            id: args.row.id,
            recipientUserId: recipient.userId,
            recipientEmail: recipient.email
        },
        milestone: 'mig:cancel',
        targetDate: args.today,
        payload: {
            ...details,
            applicationDate:
                args.variant === 'ALREADY_STARTED'
                    ? getLocalDateString({ instant: args.row.applicationDate })
                    : null,
            variant: args.variant,
            // Same criterion as the announcement and the reminder: only an increase names its motive.
            ...(reason === 'PRICE_INCREASE' ? { reason } : {})
        }
    });
}
