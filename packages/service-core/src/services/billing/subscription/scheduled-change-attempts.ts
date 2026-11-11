import { eq, getDb, sql, subscriptionScheduledChanges } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';

const logger = createLogger('scheduled-change-attempts');

/**
 * How many failed S38 attempts a queue row tolerates before it leaves the batch.
 *
 * The `subscription-scheduled-change` cron runs once per hour (`53 * * * *`), so five
 * attempts are roughly five hours of persistent failure: fast enough to surface a billing
 * problem, tolerant enough to ride out a short database outage.
 */
export const SCHEDULED_CHANGE_MAX_ATTEMPTS = 5;

/** Maximum characters stored in `last_error`; the stack is never persisted. */
const MAX_LAST_ERROR_LENGTH = 500;

/** English message emitted, once, when a row reaches {@link SCHEDULED_CHANGE_MAX_ATTEMPTS}. */
const EXHAUSTED_MESSAGE =
    'Scheduled change exhausted its attempts and is excluded from the batch until re-enabled';

const recordFailureInputSchema = z.strictObject({
    scheduledChangeId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    effectiveAt: z.date(),
    now: z.date(),
    error: z.unknown()
});

/**
 * An exhausted queue row. The structured fields travel to Sentry as the captured error's
 * own properties, while `message` is the human-readable explanation.
 */
class ScheduledChangeExhaustedError extends Error {
    readonly scheduledChangeId: string;
    readonly subscriptionId: string;
    readonly effectiveAt: Date;
    readonly attemptCount: number;
    readonly maxAttempts: number;
    readonly lastError: string;

    constructor(input: {
        readonly scheduledChangeId: string;
        readonly subscriptionId: string;
        readonly effectiveAt: Date;
        readonly attemptCount: number;
        readonly maxAttempts: number;
        readonly lastError: string;
    }) {
        super(EXHAUSTED_MESSAGE);
        this.name = 'ScheduledChangeExhaustedError';
        this.scheduledChangeId = input.scheduledChangeId;
        this.subscriptionId = input.subscriptionId;
        this.effectiveAt = input.effectiveAt;
        this.attemptCount = input.attemptCount;
        this.maxAttempts = input.maxAttempts;
        this.lastError = input.lastError;
    }
}

/** The stored failure text: `error.message` or `String(error)`, capped, never a stack. */
function failureMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.slice(0, MAX_LAST_ERROR_LENGTH);
}

/**
 * Records one failed S38 attempt on its queue row and alerts when the row reaches the cap.
 *
 * The `UPDATE` runs on the base connection, OUTSIDE the transaction that failed and already
 * rolled back, so the counter persists (D-4). It targets the queue row id because a client may
 * replace the row mid-run: a new row must not inherit failures that are not its own. A missing
 * row is not an error (it was applied or replaced). A failed `UPDATE` is logged without capture
 * and never rethrown, so one diagnostic write can never abort the batch.
 *
 * @param input - Queue row id, owner subscription, effective date, run clock, and the failure.
 * @returns The stored attempt count, or `null` when the row no longer exists or could not be updated.
 */
export async function recordScheduledChangeFailure(input: {
    readonly scheduledChangeId: string;
    readonly subscriptionId: string;
    readonly effectiveAt: Date;
    readonly now: Date;
    readonly error: unknown;
}): Promise<{ readonly attemptCount: number | null }> {
    const parsed = recordFailureInputSchema.safeParse(input);
    if (!parsed.success) {
        logger.error(
            {
                scheduledChangeId: input.scheduledChangeId,
                subscriptionId: input.subscriptionId,
                error: parsed.error
            },
            'Scheduled change failure input failed validation; skipping attempt counter update'
        );
        return { attemptCount: null };
    }
    const { scheduledChangeId, subscriptionId, effectiveAt, now, error } = parsed.data;
    const lastError = failureMessage(error);
    try {
        const [updated] = await getDb()
            .update(subscriptionScheduledChanges)
            .set({
                attemptCount: sql<number>`${subscriptionScheduledChanges.attemptCount} + 1`,
                lastErrorAt: now,
                lastError
            })
            .where(eq(subscriptionScheduledChanges.id, scheduledChangeId))
            .returning({ attemptCount: subscriptionScheduledChanges.attemptCount });
        if (!updated) return { attemptCount: null };
        if (updated.attemptCount === SCHEDULED_CHANGE_MAX_ATTEMPTS) {
            const exhausted = new ScheduledChangeExhaustedError({
                scheduledChangeId,
                subscriptionId,
                effectiveAt,
                attemptCount: updated.attemptCount,
                maxAttempts: SCHEDULED_CHANGE_MAX_ATTEMPTS,
                lastError
            });
            logger.error(exhausted, exhausted.message, { capture: true });
        }
        return { attemptCount: updated.attemptCount };
    } catch (updateError) {
        logger.error(
            { scheduledChangeId, subscriptionId, error: updateError },
            'Scheduled change attempt counter update failed; continuing batch'
        );
        return { attemptCount: null };
    }
}
