/**
 * The "access ending" reminder of a scheduled cancellation (HOS-2580 §C).
 *
 * A `CANCEL_SCHEDULED` principal keeps its service until `service_ends_at` (S11) and then S12
 * cuts it. A few days before that instant the person gets ONE reminder. The window is the
 * larger PLAZO:13 offset, the same offsets the renewal notice uses (5 and 1 days by default),
 * so a person who cancels hears from us at the same distance as one who renews.
 *
 * Idempotent by the outbox: the dedup key's occurrence is the subscription id, so every later
 * run answers `ALREADY_ENQUEUED`. A run that starts late (the cancellation was asked inside the
 * window) still sends it, with the days that are actually left.
 *
 * @module services/billing/subscription/access-ending-notice
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { resolvePlanDisplayName } from '../plan-display-name';

const logger = createLogger('access-ending-notice');

/** Template key of the access-ending reminder; the notifications renderer repeats the literal. */
export const ACCESS_ENDING_NOTICE_TEMPLATE = 'billing.access-ending';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The due reminder for one service end, in market-local days. */
export interface DueAccessEnding {
    /** Whole market-local days from today to the service end day (at least 1). */
    readonly daysRemaining: number;
    /** Market-local day of the service end (`YYYY-MM-DD`). */
    readonly endDay: string;
}

function dayNumber(day: string): number {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1) / DAY_MS;
}

/**
 * Decides whether the access-ending reminder is due, on the market-local calendar.
 *
 * @param input.serviceEndsAt - The committed end of service
 * @param input.now - The run's instant
 * @param input.daysBefore - The window: the reminder is due from this many days before the end
 * @returns The due reminder, or null before the window, on the end day and after it
 */
export function resolveDueAccessEnding(input: {
    readonly serviceEndsAt: Date;
    readonly now: Date;
    readonly daysBefore: number;
}): DueAccessEnding | null {
    const endDay = getLocalDateString({ instant: input.serviceEndsAt });
    const today = getLocalDateString({ instant: input.now });
    const daysRemaining = dayNumber(endDay) - dayNumber(today);
    if (daysRemaining <= 0 || daysRemaining > input.daysBefore) return null;
    return { daysRemaining, endDay };
}

/** One row handled during an access-ending run. */
export interface AccessEndingRunRow {
    readonly subscriptionId: string;
    readonly outcome: 'ENQUEUED' | 'ALREADY_ENQUEUED' | 'NOT_DUE' | 'FAILED';
    readonly error?: string;
}

/** Aggregate counts and row details of one access-ending run. */
export interface SendAccessEndingNoticesResult {
    readonly enqueued: number;
    readonly alreadyEnqueued: number;
    readonly notDue: number;
    readonly failed: number;
    readonly rows: readonly AccessEndingRunRow[];
}

const runInputSchema = z.strictObject({ limit: z.number().int().positive().max(10_000) });
const milestoneSchema = z.strictObject({
    daysBefore: z.tuple([z.number().int().positive(), z.number().int().positive()])
});

/** Reads the window (the larger PLAZO:13 offset) from the current billing deadlines. */
async function readWindowDays(readValues?: () => Promise<unknown>): Promise<number> {
    const raw = readValues
        ? await readValues()
        : (
              await (
                  await import('../deadlines/billing-deadlines.service')
              ).getCurrentBillingDeadlines()
          ).values;
    const values = BillingDeadlineValuesSchema.safeParse(raw);
    const milestone = values.success ? milestoneSchema.safeParse(values.data['13']) : null;
    if (!milestone?.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'PLAZO:13 must contain two positive daysBefore values'
        );
    return Math.max(...milestone.data.daysBefore);
}

/**
 * Enqueues the due access-ending reminders: `CANCEL_SCHEDULED` principals whose service ends
 * inside the window. Active renewing rows are never selected (they get the renewal notice),
 * ended rows are `CANCELLED` or past `service_ends_at`, and a row already notified answers
 * `ALREADY_ENQUEUED` through the outbox dedup key.
 *
 * @param input.limit - Page size of the run
 * @param input.db - The client; defaults to `getDb()`. A test passes its rollback transaction
 * @param ports.clock - The run's clock, read once
 * @param ports.readDeadlineValues - Reads the current billing deadline values; defaults to the
 *   published version
 * @returns The counts and the handled rows
 */
export async function sendAccessEndingNotices(
    input: { readonly limit: number; readonly db?: DrizzleClient },
    ports: { readonly clock: Clock; readonly readDeadlineValues?: () => Promise<unknown> }
): Promise<SendAccessEndingNoticesResult> {
    const parsed = runInputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid access-ending notice run limit',
            parsed.error.issues
        );
    const dbPackage = await import('@repo/db');
    const {
        and,
        asc,
        buildEmailDedupKey,
        buildEventOccurrence,
        emailOutboxModel,
        eq,
        gt,
        lte,
        plans,
        planVersions,
        subscriptions,
        users
    } = dbPackage;
    const db = input.db ?? dbPackage.getDb();
    const now = ports.clock.now();
    const windowDays = await readWindowDays(ports.readDeadlineValues);
    // One extra day covers the market-local offset; `resolveDueAccessEnding` decides exactly.
    const horizon = new Date(now.getTime() + (windowDays + 1) * DAY_MS);
    const selected = await db
        .select({
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            serviceEndsAt: subscriptions.serviceEndsAt,
            email: users.email,
            planName: plans.name,
            planSlug: plans.slug
        })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                gt(subscriptions.serviceEndsAt, now),
                lte(subscriptions.serviceEndsAt, horizon)
            )
        )
        .orderBy(asc(subscriptions.serviceEndsAt), asc(subscriptions.id))
        .limit(parsed.data.limit);

    const counts = { enqueued: 0, alreadyEnqueued: 0, notDue: 0, failed: 0 };
    const rows: AccessEndingRunRow[] = [];
    for (const row of selected) {
        try {
            const due = row.serviceEndsAt
                ? resolveDueAccessEnding({
                      serviceEndsAt: row.serviceEndsAt,
                      now,
                      daysBefore: windowDays
                  })
                : null;
            if (!due || !row.userId || !row.vertical || !row.serviceEndsAt) {
                counts.notDue += 1;
                rows.push({ subscriptionId: row.subscriptionId, outcome: 'NOT_DUE' });
                continue;
            }
            const queued = await emailOutboxModel.enqueue(
                {
                    recipientUserId: row.userId,
                    recipientEmail: row.email,
                    template: ACCESS_ENDING_NOTICE_TEMPLATE,
                    payload: {
                        subscriptionId: row.subscriptionId,
                        vertical: row.vertical,
                        planName: await resolvePlanDisplayName({
                            vertical: row.vertical,
                            plan: { slug: row.planSlug, name: row.planName }
                        }),
                        serviceEndsAt: row.serviceEndsAt.toISOString(),
                        daysRemaining: due.daysRemaining
                    },
                    dedupKey: buildEmailDedupKey({
                        recipient: row.userId,
                        template: ACCESS_ENDING_NOTICE_TEMPLATE,
                        occurrence: buildEventOccurrence({ eventId: row.subscriptionId })
                    })
                },
                db
            );
            const outcome = queued.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED';
            if (queued.enqueued) counts.enqueued += 1;
            else counts.alreadyEnqueued += 1;
            rows.push({ subscriptionId: row.subscriptionId, outcome });
        } catch (error) {
            counts.failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            logger.error(
                { subscriptionId: row.subscriptionId, error },
                'Access-ending notice row failed; run continues'
            );
            rows.push({ subscriptionId: row.subscriptionId, outcome: 'FAILED', error: message });
        }
    }
    if (selected.length === parsed.data.limit)
        logger.warn({ limit: parsed.data.limit }, 'Access-ending notice page is full');
    logger.info(counts, 'Access-ending notice run finished');
    return { ...counts, rows };
}
