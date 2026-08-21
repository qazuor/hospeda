/**
 * The webhook recovery queue: policy + the write that fills it (HOS-717).
 *
 * ## What was broken
 *
 * `billing_webhook_dead_letter` and the hourly `webhook-retry` cron that drains
 * it both shipped long ago, but **no production code ever inserted a row**. The
 * only writer in the repo was an integration test, and that test is not run by
 * any CI job. So the cron ran every hour against a table that was permanently
 * empty and reported success — a recovery net that existed on paper only.
 *
 * The gap was invisible because MercadoPago's own retry-on-5xx was silently
 * doing the recovery for us. HOS-707 deliberately closed that door for terminal
 * deliveries (they now answer 200 so the provider stops), which left retryable
 * failures depending entirely on a provider retry schedule we neither control
 * nor can configure. This module is the missing link.
 *
 * ## Where the write happens
 *
 * Exactly one place: {@link markEventFailedByProviderId} in `./utils`, which is
 * the single choke point every failure path already funnels through
 * (`handleWebhookError`'s retryable branch, `payment-handler`, and
 * `subscription-payment-handler`). Enqueueing per call site would have been four
 * independent chances to forget; enqueueing at the choke point is one.
 *
 * Terminal failures never reach it — `handleWebhookError` sends those to
 * `markEventProcessedByProviderId` instead — so a delivery that can never
 * succeed is never queued for a retry that can never succeed.
 *
 * ## Two counters, two jobs
 *
 * - `billing_webhook_events.attempts` counts **inbound delivery failures** for
 *   this provider event. It is incremented by `markEventFailedByProviderId` in
 *   the same UPDATE that flips the status, and is what the admin listing shows.
 *   Before HOS-717 nothing wrote it, so the `attempts = 0` seen during the
 *   HOS-707 incident looked like data drift when it was actually the column
 *   being inert by construction.
 * - `billing_webhook_dead_letter.attempts` counts **recovery attempts** made by
 *   the cron. The cron owns it end to end; this module always enqueues at `0`.
 *
 * @module routes/webhooks/mercadopago/dead-letter
 */

import {
    and,
    billingWebhookDeadLetter,
    billingWebhookEvents,
    eq,
    getDb,
    isNull,
    sql
} from '@repo/db';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';

/**
 * How many times the recovery cron retries a queued event before giving up.
 *
 * Reaching this count is terminal: the cron stamps `resolved_at`, overwrites
 * `error` with the give-up reason, and raises an admin alert. The row stays in
 * the table as an audit record and is never picked up again.
 *
 * A cap is not optional. Without one the queue fills with zombie events that
 * are re-attempted forever — the exact failure mode HOS-707 removed on the
 * provider side, reintroduced on ours.
 */
export const WEBHOOK_RETRY_MAX_ATTEMPTS = 5;

/**
 * Base spacing of the exponential backoff, in hours.
 *
 * The cron itself runs hourly, so anything below 1h is unreachable in practice
 * and this is also the floor of the effective resolution.
 */
export const WEBHOOK_RETRY_BASE_DELAY_HOURS = 1;

/**
 * Hours that must elapse **after the row was queued** before the attempt
 * following `attempts` failures may run.
 *
 * The delay between consecutive attempts doubles (1h, 2h, 4h, 8h, 16h), so the
 * cumulative wait measured from `created_at` is `2^attempts - 1` hours:
 *
 * | attempts so far | eligible at created_at + | gap since previous try |
 * |----------------:|-------------------------:|-----------------------:|
 * | 0               | 0h (next hourly tick)    | —                      |
 * | 1               | 1h                       | 1h                     |
 * | 2               | 3h                       | 2h                     |
 * | 3               | 7h                       | 4h                     |
 * | 4               | 15h                      | 8h                     |
 * | 5               | never — gave up          | —                      |
 *
 * The last attempt therefore lands ~15h after the failure, which comfortably
 * outlives the transient conditions this queue exists for (a provider blip, a
 * timeout, a few seconds of DB unavailability) without letting a genuinely dead
 * event linger for days.
 *
 * Expressing the schedule as a function of `created_at` and `attempts` is what
 * lets the cron gate on it in SQL with **no extra column** — see
 * {@link webhookRetryDueCondition}. A `next_attempt_at` column would have had to
 * be added to a table owned by `@qazuor/qzpay-drizzle`, where the next
 * `drizzle-kit generate` would propose dropping it again.
 *
 * @param attempts - Recovery attempts already made for the queued event.
 * @returns Cumulative hours to wait, measured from `created_at`.
 */
export function webhookRetryDelayHours(attempts: number): number {
    const normalized = Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0;
    const capped = Math.min(normalized, WEBHOOK_RETRY_MAX_ATTEMPTS);
    return (2 ** capped - 1) * WEBHOOK_RETRY_BASE_DELAY_HOURS;
}

/**
 * SQL predicate form of {@link webhookRetryDelayHours}, for the cron's batch query.
 *
 * Mirrors the TS function exactly: a row is due once
 * `created_at + (2^attempts - 1) hours` has passed. Kept next to the function it
 * mirrors so the two cannot drift apart unnoticed.
 *
 * @returns A Drizzle SQL condition selecting only rows whose backoff has elapsed.
 */
export function webhookRetryDueCondition() {
    return sql`${billingWebhookDeadLetter.createdAt} + ((power(2, ${billingWebhookDeadLetter.attempts})::int - 1) * ${WEBHOOK_RETRY_BASE_DELAY_HOURS} * interval '1 hour') <= now()`;
}

/**
 * A `billing_webhook_events` row, reduced to what the recovery queue needs.
 *
 * Produced by the `RETURNING` clause of the status UPDATE in
 * `markEventFailedByProviderId`, so enqueueing costs no extra SELECT.
 */
export interface FailedWebhookEventRow {
    readonly providerEventId: string;
    readonly provider: string;
    readonly type: string;
    readonly payload: unknown;
    readonly livemode?: boolean | null;
}

/** What {@link enqueueWebhookForRetry} did, for logging and tests. */
export type EnqueueOutcome = 'enqueued' | 'already-queued' | 'failed';

/**
 * Put a failed webhook delivery into the recovery queue.
 *
 * Idempotent per provider event: if an **unresolved** entry already exists for
 * the same `providerEventId`, its `error` is refreshed and no second row is
 * created. Without that check a provider redelivering the same failing event
 * would multiply queue rows, and each copy would carry its own independent
 * attempt budget — five retries would silently become fifteen.
 *
 * New entries always start at `attempts = 0`: this function records that
 * recovery is *needed*, the cron records how often it has been *tried*.
 *
 * Never throws. A recovery queue that can break the error handler feeding it is
 * worse than no queue at all — the caller is already handling a failure, and a
 * secondary fault here must not turn a 500-with-a-retry into an unhandled
 * rejection. Failures are logged and reported as `'failed'`.
 *
 * @param params.event - The just-failed webhook event row.
 * @param params.errorMessage - Why processing failed.
 * @returns The outcome; `'failed'` when the queue write itself did not succeed.
 */
export async function enqueueWebhookForRetry({
    event,
    errorMessage
}: {
    readonly event: FailedWebhookEventRow;
    readonly errorMessage: string;
}): Promise<EnqueueOutcome> {
    const error = errorMessage.trim().length > 0 ? errorMessage : 'Unknown webhook failure';

    try {
        const db = getDb();

        const existing = await db
            .select({ id: billingWebhookDeadLetter.id })
            .from(billingWebhookDeadLetter)
            .where(
                and(
                    eq(billingWebhookDeadLetter.providerEventId, event.providerEventId),
                    isNull(billingWebhookDeadLetter.resolvedAt)
                )
            )
            .limit(1);

        const alreadyQueued = existing[0];

        if (alreadyQueued) {
            await db
                .update(billingWebhookDeadLetter)
                .set({ error })
                .where(eq(billingWebhookDeadLetter.id, alreadyQueued.id));

            apiLogger.debug(
                { providerEventId: event.providerEventId, deadLetterId: alreadyQueued.id },
                'Webhook failure already in the recovery queue - refreshed error, attempts untouched'
            );

            return 'already-queued';
        }

        await db.insert(billingWebhookDeadLetter).values({
            providerEventId: event.providerEventId,
            provider: event.provider,
            type: event.type,
            payload: event.payload,
            error,
            attempts: 0,
            // Same single source of truth as the INSERT in event-handler.ts and
            // middlewares/billing.ts (HOS-708): sandbox mode means every
            // persisted row is non-live. Prefer the value already resolved on
            // the originating event row; fall back to the env only when the
            // column is null, never to the column's `DEFAULT true`, which would
            // relabel every sandbox failure as production.
            livemode:
                typeof event.livemode === 'boolean'
                    ? event.livemode
                    : !env.HOSPEDA_MERCADO_PAGO_SANDBOX
        });

        apiLogger.info(
            {
                providerEventId: event.providerEventId,
                provider: event.provider,
                type: event.type,
                maxAttempts: WEBHOOK_RETRY_MAX_ATTEMPTS
            },
            'Queued failed webhook for recovery'
        );

        return 'enqueued';
    } catch (queueError) {
        apiLogger.error(
            {
                providerEventId: event.providerEventId,
                type: event.type,
                originalError: error,
                error: queueError instanceof Error ? queueError.message : String(queueError)
            },
            'Failed to queue webhook for recovery - this delivery will not be retried locally'
        );

        return 'failed';
    }
}

/**
 * Column list shared by the enqueue path's `RETURNING` clause.
 *
 * Exported so `utils.ts` cannot drift from {@link FailedWebhookEventRow}.
 */
export const FAILED_WEBHOOK_EVENT_RETURNING = {
    providerEventId: billingWebhookEvents.providerEventId,
    provider: billingWebhookEvents.provider,
    type: billingWebhookEvents.type,
    payload: billingWebhookEvents.payload,
    livemode: billingWebhookEvents.livemode
} as const;
