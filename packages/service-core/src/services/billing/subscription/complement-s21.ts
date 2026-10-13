/**
 * S21 (TRANS:B:S21; AC:B5:28): the complement subscription follows its instance. When the
 * addon instance hanging from a live COMPLEMENTO row reaches `CANCELLED` —by any clause of
 * `A5` or by `A6`— the row goes to `CANCELLED` in the same act: no grace, no end-of-service
 * date (notas I-4), never through `CANCEL_SCHEDULED`, no automatic refund and nothing sent to
 * the provider (the one preapproval is cancelled by `A5`/`A6`, never twice). Its condition is a
 * STATE, so it is re-evaluated: {@link findComplementsAwaitingS21} finds the run that died
 * between `A5` and `S21`. It runs in the caller's transaction and never commits.
 */
import {
    addonInstances,
    and,
    asc,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

const logger = createLogger('complement-s21');

/** One of the six live states of a subscription: the `desde` of S21 (glossary row 20). */
export type ComplementLiveStatus = (typeof LIVE_SUBSCRIPTION_STATUSES)[number];

/** What S21 did. */
export type S21Result =
    | { readonly outcome: 'CANCELLED'; readonly from: ComplementLiveStatus }
    | { readonly outcome: 'ALREADY_CANCELLED' }
    | { readonly outcome: 'NOT_APPLICABLE' };

/**
 * The `desde` of S21 and which origin closes an open pause (a `PAUSED` complement, by `S32` or
 * a customer pause, gets `actual_end_at`). Exhaustive by origin, never a ternary. Local
 * literals: nothing from `@repo/db` is evaluated at module level.
 */
const CLOSES_OPEN_PAUSE: Readonly<Record<ComplementLiveStatus, boolean>> = {
    PENDING_AUTHORIZATION: false,
    ACTIVE: false,
    GRACE_PERIOD: false,
    PAUSED: true,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false
};

function isComplementLiveStatus(status: string): status is ComplementLiveStatus {
    return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

const applySchema = z.object({
    complementSubscriptionId: z.uuid(),
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

const awaitingSchema = z.object({
    limit: z.int().positive().max(10_000),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

function invalid(issues: unknown): never {
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid S21 input',
        issues,
        'INVALID_S21_INPUT'
    );
}

/**
 * S21 on one complement row, inside the caller's transaction. Reads the row `FOR UPDATE`;
 * `NOT_APPLICABLE` when it is not a COMPLEMENTO, when the instance hanging from it is not
 * `CANCELLED` (its condition is that state), or when it is not live (`ABANDONED`,
 * `CHARGE_DECLINED`: notas I-13); `ALREADY_CANCELLED` without writing anything (idempotent).
 * Otherwise ONE write guarded by the state read under the lock: `CANCELLED`, the grace clock
 * off, `service_ends_at` untouched; from `PAUSED` it closes the open pause with
 * `actual_end_at = now`. It never calls the provider, enqueues mail, creates a refund or opens
 * a mark. The write is the subscription's own, so the inventory of G5 names `applyS21`.
 *
 * @param input.tx - The caller's transaction
 * @param input.complementSubscriptionId - The COMPLEMENTO row
 * @param input.now - The instant of the act
 * @returns What S21 did
 * @throws ServiceError when the row does not exist or left its state under the lock
 */
export async function applyS21(input: {
    readonly tx: DrizzleClient;
    readonly complementSubscriptionId: string;
    readonly now: Date;
}): Promise<S21Result> {
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) invalid(parsed.error.issues);
    const { tx, complementSubscriptionId, now } = input;
    const [row] = await tx
        .select({ status: subscriptions.status, class: subscriptions.class })
        .from(subscriptions)
        .where(eq(subscriptions.id, complementSubscriptionId))
        .limit(1)
        .for('update');
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Complement subscription ${complementSubscriptionId} not found`,
            undefined,
            'S21_SUBSCRIPTION_NOT_FOUND'
        );
    if (row.class !== 'COMPLEMENTO') return { outcome: 'NOT_APPLICABLE' };
    const [instance] = await tx
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.complementSubscriptionId, complementSubscriptionId))
        .limit(1);
    if (instance?.status !== 'CANCELLED') return { outcome: 'NOT_APPLICABLE' };
    if (row.status === 'CANCELLED') return { outcome: 'ALREADY_CANCELLED' };
    const from = row.status;
    if (!isComplementLiveStatus(from)) return { outcome: 'NOT_APPLICABLE' };

    const [written] = await tx
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null, updatedAt: now })
        .where(and(eq(subscriptions.id, complementSubscriptionId), eq(subscriptions.status, from)))
        .returning({ id: subscriptions.id });
    if (!written)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Complement subscription ${complementSubscriptionId} left ${from} under the lock`,
            undefined,
            'S21_STATE_CHANGED'
        );
    if (CLOSES_OPEN_PAUSE[from]) {
        const closed = await tx
            .update(subscriptionPauses)
            .set({ actualEndAt: now })
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, complementSubscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .returning({ id: subscriptionPauses.id });
        if (closed.length === 0)
            logger.warn(
                { subscriptionId: complementSubscriptionId },
                'S21 cancelled a PAUSED complement that had no open pause to close'
            );
    }
    return { outcome: 'CANCELLED', from };
}

/**
 * The re-evaluation of S21 (notas I-9): the live COMPLEMENTO rows whose instance is already
 * `CANCELLED`, i.e. a run that wrote `A5` (or `A6`) and died before `S21`. No cron calls it yet:
 * wiring it to the sweep is B11/B5.9's.
 *
 * @param input.tx - The caller's transaction (or any client)
 * @param input.limit - The maximum number of rows
 * @returns `{ subscriptionIds }`, ordered by id
 */
export async function findComplementsAwaitingS21(input: {
    readonly tx: DrizzleClient;
    readonly limit: number;
}): Promise<{ readonly subscriptionIds: readonly string[] }> {
    const parsed = awaitingSchema.safeParse(input);
    if (!parsed.success) invalid(parsed.error.issues);
    const rows = await input.tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .innerJoin(addonInstances, eq(addonInstances.complementSubscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.class, 'COMPLEMENTO'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES),
                eq(addonInstances.status, 'CANCELLED')
            )
        )
        .orderBy(asc(subscriptions.id))
        .limit(input.limit);
    return { subscriptionIds: rows.map((row) => row.id) };
}
