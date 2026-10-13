/**
 * Billing's real `retentionStopped()` (`retenciónDetenida(user, vertical)`, contract §4.1;
 * AC:B4:4). The owner's own pause stops the retention clock of their listings in that vertical
 * (DEC-DATA-006): `stopped` is yes ONLY with a `PAUSED` subscription whose open pause has reason
 * `CUSTOMER_REQUEST`; a `COURTESY` pause keeps covering and does not stop it.
 *
 * The end of a pause restarts the clock without writing anything (DEC-DATA-006📌1): the answer
 * carries `pauseEndedAt`, the `actual_end_at` of the latest closed `CUSTOMER_REQUEST` pause, and
 * `coverageLostAt`, the latest coverage loss (contract §4.1, «coberturaPerdidaEn»), which PB9
 * counts from. Only PRINCIPAL rows count (I-7): a complement's pause is opened by S32 for its
 * principal's suspension, not asked for by the person.
 */
import {
    type BillingForVerticals,
    type Clock,
    type RetentionStoppedArgs,
    RetentionStoppedArgsSchema,
    type RetentionStoppedResponse,
    RetentionStoppedResponseSchema
} from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    isNotNull,
    isNull,
    lte,
    max,
    subscriptionPauses,
    subscriptions
} from '@repo/db';

/** The pause reason that stops the retention clock (DEC-DATA-006). */
const CUSTOMER_REQUEST = 'CUSTOMER_REQUEST';

/** The states whose `service_ends_at`, once past, is a coverage loss with no writer (I-5). */
const SERVICE_ENDING_STATUSES = ['CANCEL_SCHEDULED', 'CANCELLED'] as const;

/** What `retentionStopped` reads for one `(user, vertical)`, before deciding. */
export interface RetentionStoppedReading {
    /** How many PRINCIPAL `PAUSED` rows have an open `CUSTOMER_REQUEST` pause. */
    readonly openCustomerPauses: number;
    /** The latest `actual_end_at` of a closed `CUSTOMER_REQUEST` pause of a PRINCIPAL row. */
    readonly latestCustomerPauseEnd: Date | null;
    /** `coverage_loss.lost_at`, written by the writer that dropped the coverage. */
    readonly recordedLoss: Date | null;
    /** The latest `service_ends_at <= now` of a PRINCIPAL `CANCEL_SCHEDULED`/`CANCELLED` row. */
    readonly latestElapsedServiceEnd: Date | null;
}

/** The later of two optional instants, or null when neither exists. */
function latestOf(input: { readonly a: Date | null; readonly b: Date | null }): Date | null {
    if (input.a === null) return input.b;
    if (input.b === null) return input.a;
    return input.a.getTime() >= input.b.getTime() ? input.a : input.b;
}

/**
 * The whole answer of `retenciónDetenida`, pure (contract §4.1; DEC-DATA-006 and its 📌1):
 * `coverageLostAt` is the later of the recorded loss and the elapsed end of service of a
 * scheduled cancellation, whose drop by time has no transaction to write it (I-5).
 *
 * @param input - The reading of one `(user, vertical)`
 * @returns `{ stopped, pauseEndedAt, coverageLostAt }`
 */
export function decideRetentionStopped(input: RetentionStoppedReading): RetentionStoppedResponse {
    return {
        stopped: input.openCustomerPauses > 0,
        pauseEndedAt: input.latestCustomerPauseEnd,
        coverageLostAt: latestOf({ a: input.recordedLoss, b: input.latestElapsedServiceEnd })
    };
}

/** The ports of the real `retentionStopped()`. */
export interface BillingRetentionStoppedPorts {
    /** The injected clock: an end of service is a loss only once it is past. */
    readonly clock: Clock;
}

/** The PRINCIPAL rows of one `(user, vertical)`. */
function principalRowsOf(input: { readonly userId: string; readonly vertical: string }) {
    return and(
        eq(subscriptions.userId, input.userId),
        eq(subscriptions.vertical, input.vertical),
        eq(subscriptions.class, 'PRINCIPAL')
    );
}

/** Reads the four facts the answer is made of; every read is a flat query, and a failure throws. */
async function readRetention(input: {
    readonly db: DrizzleClient;
    readonly userId: string;
    readonly vertical: string;
    readonly now: Date;
}): Promise<RetentionStoppedReading> {
    const { db } = input;
    const [openPauses, closedPauses, losses, serviceEnds] = await Promise.all([
        db
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPauses.subscriptionId))
            .where(
                and(
                    principalRowsOf(input),
                    eq(subscriptions.status, 'PAUSED'),
                    eq(subscriptionPauses.reason, CUSTOMER_REQUEST),
                    isNull(subscriptionPauses.actualEndAt)
                )
            ),
        db
            .select({ endedAt: max(subscriptionPauses.actualEndAt) })
            .from(subscriptionPauses)
            .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPauses.subscriptionId))
            .where(
                and(
                    principalRowsOf(input),
                    eq(subscriptionPauses.reason, CUSTOMER_REQUEST),
                    isNotNull(subscriptionPauses.actualEndAt)
                )
            ),
        db
            .select({ lostAt: coverageLosses.lostAt })
            .from(coverageLosses)
            .where(
                and(
                    eq(coverageLosses.userId, input.userId),
                    eq(coverageLosses.vertical, input.vertical)
                )
            ),
        db
            .select({ endsAt: max(subscriptions.serviceEndsAt) })
            .from(subscriptions)
            .where(
                and(
                    principalRowsOf(input),
                    inArray(subscriptions.status, [...SERVICE_ENDING_STATUSES]),
                    lte(subscriptions.serviceEndsAt, input.now)
                )
            )
    ]);
    return {
        openCustomerPauses: openPauses.length,
        latestCustomerPauseEnd: closedPauses[0]?.endedAt ?? null,
        recordedLoss: losses[0]?.lostAt ?? null,
        latestElapsedServiceEnd: serviceEnds[0]?.endsAt ?? null
    };
}

/**
 * Builds billing's real `retentionStopped()` (contract §4.1; DEC-DATA-006 and its 📌1).
 *
 * Reads, over the PRINCIPAL rows of the `(user, vertical)`, the open `CUSTOMER_REQUEST` pauses of
 * `PAUSED` rows, the latest closed `CUSTOMER_REQUEST` pause, the recorded coverage loss and the
 * latest elapsed end of service of a scheduled or done cancellation, then applies
 * `decideRetentionStopped`. A failed read throws: it never answers for a person it could not read.
 *
 * @param args.ports - The clock
 * @returns `{ retentionStopped }`
 */
export function createBillingRetentionStopped(args: {
    readonly ports: BillingRetentionStoppedPorts;
}): Pick<BillingForVerticals, 'retentionStopped'> {
    const { clock } = args.ports;
    return {
        async retentionStopped(input: RetentionStoppedArgs): Promise<RetentionStoppedResponse> {
            const { userId, vertical } = RetentionStoppedArgsSchema.parse(input);
            const reading = await readRetention({
                db: getDb(),
                userId,
                vertical,
                now: clock.now()
            });
            return RetentionStoppedResponseSchema.parse(decideRetentionStopped(reading));
        }
    };
}
