import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { desc, eq, lte } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';

const logger = createLogger('grace-reminder-notice');
export const GRACE_REMINDER_TEMPLATE = 'billing.grace-reminder';

export interface DueGraceReminder {
    readonly daysBefore: number;
    readonly targetDate: string;
}

/** Resolves the latest due grace reminder using the market-local calendar day. */
export function resolveDueGraceReminder(input: {
    readonly graceStartedAt: Date;
    readonly graceEndsAt: Date;
    readonly now: Date;
    readonly daysBefore: readonly number[];
}): DueGraceReminder | null {
    const targetDate = getLocalDateString({ instant: input.graceEndsAt });
    const startDate = getLocalDateString({ instant: input.graceStartedAt });
    const today = getLocalDateString({ instant: input.now });
    if (today >= targetDate) return null;
    const valid = [
        ...new Set(input.daysBefore.filter((days) => Number.isInteger(days) && days > 0))
    ];
    const due = valid.filter((days) => {
        const milestoneDate = subtractDays(targetDate, days);
        return milestoneDate > startDate && milestoneDate <= today;
    });
    const daysBefore = due.length ? Math.min(...due) : null;
    return daysBefore === null ? null : { daysBefore, targetDate };
}

function subtractDays(day: string, days: number): string {
    const [year, month, date] = day.split('-').map(Number);
    const instant = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) - days));
    return `${instant.getUTCFullYear().toString().padStart(4, '0')}-${(instant.getUTCMonth() + 1).toString().padStart(2, '0')}-${instant.getUTCDate().toString().padStart(2, '0')}`;
}

export type GraceReminderOutcome =
    | 'SKIPPED'
    | 'NO_DEADLINE'
    | 'NOT_DUE'
    | 'ENQUEUED'
    | 'ALREADY_ENQUEUED';

/** Resolves and enqueues one reminder while the caller holds the subscription row lock. */
export async function applyGraceReminder(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
}): Promise<{ readonly outcome: GraceReminderOutcome; readonly milestone: string | null }> {
    const db = await import('@repo/db');
    const [row] = await input.tx
        .select({
            id: db.subscriptions.id,
            userId: db.subscriptions.userId,
            status: db.subscriptions.status,
            class: db.subscriptions.class,
            vertical: db.subscriptions.vertical,
            startedAt: db.subscriptions.graceStartedAt,
            endsAt: db.subscriptions.graceEndsAt,
            email: db.users.email
        })
        .from(db.subscriptions)
        .innerJoin(db.users, eq(db.users.id, db.subscriptions.userId))
        .where(eq(db.subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update', { of: db.subscriptions });
    if (
        row?.status !== 'GRACE_PERIOD' ||
        row.class !== 'PRINCIPAL' ||
        !row.startedAt ||
        !row.endsAt ||
        row.endsAt <= input.now
    )
        return { outcome: 'SKIPPED', milestone: null };
    const [version] = await input.tx
        .select({
            version: db.billingDeadlineVersions.version,
            values: db.billingDeadlineVersions.values
        })
        .from(db.billingDeadlineVersions)
        .where(lte(db.billingDeadlineVersions.createdAt, row.startedAt))
        .orderBy(desc(db.billingDeadlineVersions.version))
        .limit(1);
    if (!version)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Grace deadline version is missing'
        );
    const parsed = BillingDeadlineValuesSchema.safeParse(version.values);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Stored billing deadline values are invalid',
            parsed.error.issues
        );
    const config = parsed.data['20'];
    if (!config) {
        logger.info(
            { subscriptionId: row.id, deadlinesVersion: version.version },
            'Grace reminder has no configured deadline'
        );
        return { outcome: 'NO_DEADLINE', milestone: null };
    }
    const milestone = resolveDueGraceReminder({
        graceStartedAt: row.startedAt,
        graceEndsAt: row.endsAt,
        now: input.now,
        daysBefore: config.daysBefore
    });
    if (!milestone) return { outcome: 'NOT_DUE', milestone: null };
    if (!row.userId || !row.email) {
        logger.warn({ subscriptionId: row.id }, 'No user email for grace reminder');
        return { outcome: 'SKIPPED', milestone: null };
    }
    if (!row.vertical)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Grace reminder recipient is incomplete'
        );
    const occurrence = db.buildScheduleOccurrence({
        subjectKind: 'sub',
        subjectId: row.id,
        milestone: `grace:-${milestone.daysBefore}d`,
        targetDate: milestone.targetDate
    });
    const queued = await db.emailOutboxModel.enqueue(
        {
            recipientUserId: row.userId,
            recipientEmail: row.email,
            template: GRACE_REMINDER_TEMPLATE,
            payload: {
                subscriptionId: row.id,
                vertical: row.vertical,
                graceEndsAt: row.endsAt.toISOString(),
                daysBefore: milestone.daysBefore,
                deadlinesVersion: version.version
            },
            dedupKey: db.buildEmailDedupKey({
                recipient: row.userId,
                template: GRACE_REMINDER_TEMPLATE,
                occurrence
            })
        },
        input.tx
    );
    logger.info({ subscriptionId: row.id, enqueued: queued.enqueued }, 'Grace reminder evaluated');
    return {
        outcome: queued.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED',
        milestone: `grace:-${milestone.daysBefore}d`
    };
}
