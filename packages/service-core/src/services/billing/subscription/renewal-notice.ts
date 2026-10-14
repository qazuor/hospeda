import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ServiceError } from '../../../types';

const logger = createLogger('renewal-notice');

/** Template key for the new system's upcoming renewal email. */
export const RENEWAL_UPCOMING_TEMPLATE = 'billing.renewal-upcoming';
/** Maximum distance of a next charge from the renewal notice run's clock. */
export const RENEWAL_NOTICE_LOOKAHEAD_DAYS = 400;

/** A configured milestone due for a target charge day. */
export interface DueRenewalMilestone {
    readonly daysBefore: number;
    readonly targetDate: string;
}

/** Resolves the most recent due PLAZO:13 milestone using the market-local calendar day. */
export function resolveDueRenewalMilestone(input: {
    readonly nextChargeAt: Date;
    readonly now: Date;
    readonly daysBefore: readonly number[];
}): DueRenewalMilestone | null {
    const targetDate = getLocalDateString({ instant: input.nextChargeAt });
    const today = getLocalDateString({ instant: input.now });
    if (today >= targetDate) return null;
    const uniqueDays = [
        ...new Set(input.daysBefore.filter((day) => Number.isInteger(day) && day > 0))
    ].sort((left, right) => right - left);
    const due = uniqueDays.filter((days) => subtractDays(targetDate, days) <= today);
    const daysBefore = due.length > 0 ? Math.min(...due) : null;
    return daysBefore === null ? null : { daysBefore, targetDate };
}

function subtractDays(day: string, days: number): string {
    const [year, month, date] = day.split('-').map(Number);
    const instant = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) - days));
    return `${instant.getUTCFullYear().toString().padStart(4, '0')}-${(instant.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}-${instant.getUTCDate().toString().padStart(2, '0')}`;
}

/** A row outcome from applying one renewal notice within its caller's transaction. */
export type RenewalNoticeOutcome =
    | 'SKIPPED'
    | 'STAMPED_NOT_DUE'
    | 'NOT_DUE'
    | 'ENQUEUED'
    | 'ALREADY_ENQUEUED';

/** Values for the current published billing deadline snapshot. */
export interface CurrentRenewalDeadlines {
    readonly version: number;
    readonly values: unknown;
}

/** Stamps both renewal clock columns together on an active subscription. */
async function stampRenewalNoticeClock(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly version: number;
    readonly chargeAt: Date;
    readonly now: Date;
}): Promise<void> {
    const { subscriptions } = await import('@repo/db');
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            renewalNoticeDeadlineVersion: input.version,
            renewalNoticeChargeAt: input.chargeAt,
            updatedAt: input.now
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'ACTIVE')))
        .returning({ id: subscriptions.id });
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Active subscription could not be stamped with its renewal notice clock'
        );
}

const renewalMilestoneSchema = z.strictObject({
    daysBefore: z.tuple([z.number().int().positive(), z.number().int().positive()])
});

/** Applies the frozen PLAZO:13 notice logic and enqueue for one locked subscription. */
export async function applyRenewalNotice(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly current: CurrentRenewalDeadlines;
}): Promise<{
    readonly outcome: RenewalNoticeOutcome;
    readonly milestone: string | null;
    readonly stamped: boolean;
}> {
    const {
        billingDeadlineVersions,
        buildEmailDedupKey,
        buildScheduleOccurrence,
        emailOutboxModel,
        eq,
        plans,
        planVersions,
        subscriptions,
        users
    } = await import('@repo/db');
    const [row] = await input.tx
        .select({
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            class: subscriptions.class,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt,
            noticeVersion: subscriptions.renewalNoticeDeadlineVersion,
            noticeChargeAt: subscriptions.renewalNoticeChargeAt,
            storedValues: billingDeadlineVersions.values,
            email: users.email,
            planName: plans.name
        })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .leftJoin(
            billingDeadlineVersions,
            eq(billingDeadlineVersions.version, subscriptions.renewalNoticeDeadlineVersion)
        )
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update', { of: subscriptions });
    if (
        row?.status !== 'ACTIVE' ||
        row.class !== 'PRINCIPAL' ||
        row.paymentMethod !== 'CARD' ||
        !row.nextChargeAt ||
        row.nextChargeAt <= input.now
    ) {
        return { outcome: 'SKIPPED', milestone: null, stamped: false };
    }

    const needsStamp =
        !row.noticeChargeAt || row.noticeChargeAt.getTime() !== row.nextChargeAt.getTime();
    if (needsStamp) {
        await stampRenewalNoticeClock({
            tx: input.tx,
            subscriptionId: row.subscriptionId,
            version: input.current.version,
            chargeAt: row.nextChargeAt,
            now: input.now
        });
    }
    const deadlinesVersion = needsStamp ? input.current.version : row.noticeVersion;
    const rawValues = needsStamp ? input.current.values : row.storedValues;
    if (!deadlinesVersion || !rawValues)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Renewal deadline clock is missing'
        );
    const deadlineValues = BillingDeadlineValuesSchema.safeParse(rawValues);
    if (!deadlineValues.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Stored billing deadline values are invalid',
            deadlineValues.error.issues
        );
    const parsedMilestone = renewalMilestoneSchema.safeParse(deadlineValues.data['13']);
    if (!parsedMilestone.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'PLAZO:13 must contain two positive daysBefore values',
            parsedMilestone.error.issues
        );
    const milestone = resolveDueRenewalMilestone({
        nextChargeAt: row.nextChargeAt,
        now: input.now,
        daysBefore: parsedMilestone.data.daysBefore
    });
    if (!milestone)
        return {
            outcome: needsStamp ? 'STAMPED_NOT_DUE' : 'NOT_DUE',
            milestone: null,
            stamped: needsStamp
        };
    if (!row.userId || !row.email || !row.vertical || !row.planName)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Renewal notice recipient is incomplete'
        );
    const occurrence = buildScheduleOccurrence({
        subjectKind: 'sub',
        subjectId: row.subscriptionId,
        milestone: `renov:-${milestone.daysBefore}d`,
        targetDate: milestone.targetDate
    });
    const milestoneName = `renov:-${milestone.daysBefore}d`;
    const dedupKey = buildEmailDedupKey({
        recipient: row.userId,
        template: RENEWAL_UPCOMING_TEMPLATE,
        occurrence
    });
    const queued = await emailOutboxModel.enqueue(
        {
            recipientUserId: row.userId,
            recipientEmail: row.email,
            template: RENEWAL_UPCOMING_TEMPLATE,
            payload: {
                subscriptionId: row.subscriptionId,
                vertical: row.vertical,
                planName: row.planName,
                renewalDate: milestone.targetDate,
                daysBefore: milestone.daysBefore,
                deadlinesVersion
            },
            dedupKey
        },
        input.tx
    );
    logger.info(
        { subscriptionId: row.subscriptionId, enqueued: queued.enqueued },
        'Renewal notice evaluated'
    );
    return {
        outcome: queued.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED',
        milestone: milestoneName,
        stamped: needsStamp
    };
}
