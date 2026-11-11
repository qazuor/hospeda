import {
    billingDeadlineVersions,
    billingOptions,
    type DrizzleClient,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    planMigrations,
    subscriptions,
    users
} from '@repo/db';
import { BillingCycleSchema, BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { resolveDueRenewalMilestone } from '../subscription/renewal-notice.js';
import { computeApplicationDate } from './plan-migration-application-date.js';
import {
    enqueuePlanMigrationNotice,
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from './plan-migration-notice.js';
import { planMigrationRowPricing } from './plan-migration-pricing.js';

const announcementSchema = z.object({
    planName: z.string().min(1),
    targetPlanName: z.string().min(1),
    direction: z.enum(['UP', 'DOWN'])
});

/** Result of evaluating one locked migration scope row. */
export interface PlanMigrationUpcomingNoticeResult {
    readonly outcome: 'SKIPPED' | 'WAITING' | 'NOT_DUE' | 'ENQUEUED' | 'ALREADY_ENQUEUED';
    readonly milestone: string | null;
    readonly recalculated: boolean;
}

/** Recalculate a customer's date forwards and enqueue the due local-day reminder. */
export async function applyPlanMigrationUpcomingNotice(input: {
    readonly tx: DrizzleClient;
    readonly planMigrationSubscriptionId: string;
    readonly now: Date;
}): Promise<PlanMigrationUpcomingNoticeResult> {
    const [row] = await input.tx
        .select({
            scopeId: planMigrationSubscriptions.id,
            scopeStatus: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            migrationId: planMigrations.id,
            reason: planMigrations.reason,
            cancelledAt: planMigrations.cancelledAt,
            announcedAt: planMigrations.announcedAt,
            noticeDays: planMigrations.noticeDays,
            deadlineVersion: planMigrations.deadlineVersion,
            targetPlanVersionId: planMigrations.targetPlanVersionId,
            vertical: planMigrations.vertical,
            deadlineValues: billingDeadlineVersions.values,
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            email: users.email,
            customerName: users.displayName,
            class: subscriptions.class,
            status: subscriptions.status,
            nextChargeAt: subscriptions.nextChargeAt,
            paymentMethod: subscriptions.paymentMethod,
            billingOptionId: billingOptions.id,
            cycle: billingOptions.cycle
        })
        .from(planMigrationSubscriptions)
        .innerJoin(
            planMigrations,
            eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
        )
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .innerJoin(
            billingDeadlineVersions,
            eq(billingDeadlineVersions.version, planMigrations.deadlineVersion)
        )
        .where(eq(planMigrationSubscriptions.id, input.planMigrationSubscriptionId))
        .limit(1)
        .for('update', { of: [planMigrationSubscriptions, subscriptions] });
    if (!row || row.cancelledAt || row.reason !== 'RETIREMENT' || row.scopeStatus !== 'PENDIENTE')
        return { outcome: 'SKIPPED', milestone: null, recalculated: false };
    if (row.class !== 'PRINCIPAL' || row.status !== 'ACTIVE')
        return { outcome: 'WAITING', milestone: null, recalculated: false };
    if (!row.userId || !row.email)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Migration notice recipient is incomplete'
        );

    const deadlines = BillingDeadlineValuesSchema.safeParse(row.deadlineValues);
    if (!deadlines.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Stored migration deadline values are invalid',
            deadlines.error.issues
        );
    const cycle = BillingCycleSchema.parse(row.cycle);
    const computed = computeApplicationDate({
        nextChargeAt: row.nextChargeAt,
        cycle,
        announcedAt: row.announcedAt,
        noticeDays: row.noticeDays
    });
    const stored = getLocalDateString({ instant: row.applicationDate });
    const applicationDate = computed > stored ? computed : stored;
    const recalculated = computed > stored;
    if (recalculated)
        await input.tx
            .update(planMigrationSubscriptions)
            .set({ applicationDate: new Date(`${applicationDate}T12:00:00.000Z`) })
            .where(eq(planMigrationSubscriptions.id, row.scopeId));

    const due = resolveDueRenewalMilestone({
        nextChargeAt: new Date(`${applicationDate}T12:00:00.000Z`),
        now: input.now,
        daysBefore: deadlines.data['12'].contactDays
    });
    if (!due) return { outcome: 'NOT_DUE', milestone: null, recalculated };

    const announcementKey = planMigrationNoticeDedupKey({
        recipientUserId: row.userId,
        template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
        planMigrationSubscriptionId: row.scopeId,
        milestone: 'mig:announce',
        targetDate: getLocalDateString({ instant: row.announcedAt })
    });
    const [announcement] = await input.tx
        .select({ payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.dedupKey, announcementKey))
        .limit(1);
    const details = announcementSchema.safeParse(announcement?.payload);
    if (!details.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Migration announcement details are missing',
            details.error.issues
        );
    const pricing = await planMigrationRowPricing({
        tx: input.tx,
        row: {
            subscriptionId: row.subscriptionId,
            userId: row.userId,
            customerName: row.customerName,
            customerEmail: row.email,
            billingOptionId: row.billingOptionId,
            cycle,
            nextChargeAt: row.nextChargeAt,
            status: 'ACTIVE',
            alreadyInMigration: true
        },
        targetPlanVersionId: row.targetPlanVersionId,
        at: input.now
    });
    if (pricing.newAmount === null)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Migration destination cycle is missing'
        );
    const milestone = `mig:-${due.daysBefore}d`;
    const queued = await enqueuePlanMigrationNotice({
        tx: input.tx,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        row: { id: row.scopeId, recipientUserId: row.userId, recipientEmail: row.email },
        milestone,
        targetDate: applicationDate,
        payload: {
            planMigrationId: row.migrationId,
            planMigrationSubscriptionId: row.scopeId,
            subscriptionId: row.subscriptionId,
            vertical: row.vertical,
            planName: details.data.planName,
            targetPlanName: details.data.targetPlanName,
            direction: details.data.direction,
            currentAmountMinor: pricing.currentAmount,
            newAmountMinor: pricing.newAmount,
            currency: pricing.currency,
            applicationDate,
            daysBefore: due.daysBefore,
            losesPromo: pricing.losesPromo,
            variant: 'SCHEDULED',
            // Only the third notice (the closest contact day, which travels with S37) tells a card
            // payer that Mercado Pago also announces the amount change (B12 §4, Q-1).
            providerNotifies:
                row.paymentMethod === 'CARD' &&
                due.daysBefore === Math.min(...deadlines.data['12'].contactDays),
            deadlinesVersion: row.deadlineVersion
        }
    });
    return {
        outcome: queued.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED',
        milestone,
        recalculated
    };
}
