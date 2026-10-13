import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    SUCCESSION_RETAINED_PAYMENT_RELEASE_REASONS,
    successionRetainedPayments
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type { RetainedPeriodPayment } from './subscription-billing-ports';

const logger = createLogger('succession-retained-payment');

/** The partial unique index that keeps one OPEN retention per provider payment. */
const OPEN_PAYMENT_RETENTION_INDEX = 'uq_succession_retained_payment_open_payment';

/** One of the acts that turn the S19 flag off (HOS-1561 H2). */
export type SuccessionRetainedPaymentReleaseReason =
    (typeof SUCCESSION_RETAINED_PAYMENT_RELEASE_REASONS)[number];

/**
 * The payment S19 retains. Only the provider payment exists at the MVP cut; the
 * manual door (`MP1`/`MP4`) arrives in Phase 4 (HOS-1561 H3).
 */
export interface RetainablePayment {
    readonly source: 'PAYMENT';
    readonly id: string;
}

const retainInputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    payment: z.strictObject({ source: z.literal('PAYMENT'), id: z.uuid() }),
    unpaidSince: z.date(),
    now: z.date()
});

const subscriptionInputSchema = z.strictObject({ subscriptionId: z.uuid() });

/**
 * The reason schema is built lazily: the tuple comes from `@repo/db`, and this
 * module is exported from the service-core barrel, which API unit tests load with
 * `@repo/db` mocked whole (nothing from `@repo/db` is evaluated at load time).
 */
function releaseInputSchema() {
    return z.strictObject({
        paymentId: z.uuid(),
        reason: z.enum(SUCCESSION_RETAINED_PAYMENT_RELEASE_REASONS),
        now: z.date()
    });
}

/** Result of {@link retainPaymentForSuccession}. */
export interface RetainPaymentForSuccessionResult {
    /** `ALREADY_RETAINED` when the payment already had an open retention (a replay). */
    readonly outcome: 'RETAINED' | 'ALREADY_RETAINED';
}

/**
 * S19 (B7.md, AC:B7:16; `04-catalogos.md`, TRANS:B:S19): records the payment of
 * the unpaid period that entered on the predecessor of a live succession and
 * leaves it pending resolution. It does not reactivate, refund, open a mark or
 * notify; it only raises "the flag" (HOS-1561 H1/H4).
 *
 * Runs inside the caller's transaction, which already holds the subscription row
 * with `FOR UPDATE`. The insert runs in a SAVEPOINT so that the partial unique
 * index rejecting a second OPEN retention of the same payment (a replayed notice)
 * does not abort the caller's transaction; that rejection, recognised by the
 * constraint name in the `cause` chain, is `ALREADY_RETAINED`. Any other error is
 * rethrown untouched.
 *
 * @param input.subscriptionId - The predecessor that retains the payment
 * @param input.payment - The provider payment of the unpaid period
 * @param input.unpaidSince - The anchor of the unpaid period (`grace_started_at`)
 * @param input.now - The instant of the act
 * @param input.tx - The caller's transaction (row already locked)
 * @returns Whether this call opened the retention or found it already open
 */
export async function retainPaymentForSuccession(input: {
    readonly subscriptionId: string;
    readonly payment: RetainablePayment;
    readonly unpaidSince: Date;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<RetainPaymentForSuccessionResult> {
    const value = retainInputSchema.parse({
        subscriptionId: input.subscriptionId,
        payment: input.payment,
        unpaidSince: input.unpaidSince,
        now: input.now
    });
    try {
        await input.tx.transaction(async (savepoint) => {
            await savepoint.insert(successionRetainedPayments).values({
                subscriptionId: value.subscriptionId,
                paymentId: value.payment.id,
                manualPaymentId: null,
                unpaidSince: value.unpaidSince,
                retainedAt: value.now,
                createdAt: value.now,
                updatedAt: value.now
            });
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === OPEN_PAYMENT_RETENTION_INDEX)
            return { outcome: 'ALREADY_RETAINED' };
        throw error;
    }
    return { outcome: 'RETAINED' };
}

/**
 * Whether the row holds an open S19 retention (S6's guard, AC:B7:16: while a
 * payment is pending resolution S6 does not run). A read error is thrown, never
 * turned into "no retention" (fails closed).
 *
 * @param input.subscriptionId - The row
 * @param input.tx - Optional transaction (S6 asks again inside its write)
 * @returns True when an open retention exists for the row
 */
export async function hasOpenRetention(input: {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const value = subscriptionInputSchema.parse({ subscriptionId: input.subscriptionId });
    const db = input.tx ?? getDb();
    const [open] = await db
        .select({ id: successionRetainedPayments.id })
        .from(successionRetainedPayments)
        .where(
            and(
                eq(successionRetainedPayments.subscriptionId, value.subscriptionId),
                isNull(successionRetainedPayments.releasedAt)
            )
        )
        .limit(1);
    return Boolean(open);
}

/**
 * S6's default retained-payment port (HOS-1561 H5): the real read of an open S19
 * retention of the row. Only functions here; nothing from `@repo/db` is evaluated
 * at load time.
 */
export const openSuccessionRetentions: RetainedPeriodPayment = {
    async hasRetainedPeriodPayment(input) {
        return hasOpenRetention({
            subscriptionId: input.subscriptionId,
            ...(input.tx ? { tx: input.tx } : {})
        });
    }
};

/** An open S19 retention as the later branches read it. */
export interface OpenSuccessionRetention {
    readonly id: string;
    readonly subscriptionId: string;
    readonly paymentId: string | null;
    readonly manualPaymentId: string | null;
    readonly unpaidSince: Date;
    readonly retainedAt: Date;
}

/**
 * The open S19 retentions of one row, oldest first.
 *
 * @param input.subscriptionId - The row
 * @param input.tx - Optional transaction
 * @returns The open retentions (empty when there is none)
 */
export async function findOpenRetentionsBySubscription(input: {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}): Promise<readonly OpenSuccessionRetention[]> {
    const value = subscriptionInputSchema.parse({ subscriptionId: input.subscriptionId });
    const db = input.tx ?? getDb();
    return db
        .select({
            id: successionRetainedPayments.id,
            subscriptionId: successionRetainedPayments.subscriptionId,
            paymentId: successionRetainedPayments.paymentId,
            manualPaymentId: successionRetainedPayments.manualPaymentId,
            unpaidSince: successionRetainedPayments.unpaidSince,
            retainedAt: successionRetainedPayments.retainedAt
        })
        .from(successionRetainedPayments)
        .where(
            and(
                eq(successionRetainedPayments.subscriptionId, value.subscriptionId),
                isNull(successionRetainedPayments.releasedAt)
            )
        )
        .orderBy(successionRetainedPayments.retainedAt);
}

/**
 * Turns the S19 flag off for one payment: closes its OPEN retention with
 * `released_at = now` and the act that decided its destination (HOS-1561 H2).
 * Closed retentions are never touched again.
 *
 * @param input.paymentId - The retained provider payment
 * @param input.reason - The act that turns the flag off
 * @param input.now - The instant of the act
 * @param input.tx - The caller's transaction
 * @returns Whether an open retention was closed
 */
export async function releaseRetainedPayment(input: {
    readonly paymentId: string;
    readonly reason: SuccessionRetainedPaymentReleaseReason;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<{ readonly released: boolean }> {
    const value = releaseInputSchema().parse({
        paymentId: input.paymentId,
        reason: input.reason,
        now: input.now
    });
    const [released] = await input.tx
        .update(successionRetainedPayments)
        .set({ releasedAt: value.now, releaseReason: value.reason, updatedAt: value.now })
        .where(
            and(
                eq(successionRetainedPayments.paymentId, value.paymentId),
                isNull(successionRetainedPayments.releasedAt)
            )
        )
        .returning({
            id: successionRetainedPayments.id,
            subscriptionId: successionRetainedPayments.subscriptionId
        });
    if (released)
        logger.info(
            {
                subscriptionId: released.subscriptionId,
                paymentId: value.paymentId,
                reason: value.reason
            },
            'S19 retention released'
        );
    return { released: Boolean(released) };
}
