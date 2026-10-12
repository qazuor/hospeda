import {
    and,
    coveredPeriods,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    lt,
    max,
    ne,
    or,
    type SelectSubscription,
    subscriptions
} from '@repo/db';
import {
    type ActStart,
    type AuthorizationSnapshot,
    assertFreshForAct,
    type ProviderRead
} from '@repo/payments';

/** A money amount as the provider and the payment ledger carry it. */
export interface LatePaymentAmount {
    readonly amountMinor: number;
    readonly currency: string;
}

/** Which of the four conditions of `05` §3 failed (the event names it, not the reason). */
export type LatePaymentFailedCondition = 1 | 2 | 3 | 4;

/**
 * Verdict of the four conditions of `05` §3 for one credited late payment.
 *
 * `retainedForS19` is the single exception of the section: the row is the
 * predecessor of a succession in progress, so S19 keeps the payment and the
 * succession's close decides it (D-4), whatever condition would fail.
 */
export type LatePaymentConditionsVerdict =
    | { readonly ok: true }
    | { readonly ok: false; readonly failedCondition: LatePaymentFailedCondition }
    | { readonly retainedForS19: true };

/** The facts the four conditions decide on, already read in the same act. */
export interface LatePaymentFacts {
    /** The subscription's current status. */
    readonly status: string;
    /** The statuses condition 1 admits (S5: GRACE_PERIOD; S7: SUSPENDED). */
    readonly admittedStatuses: readonly string[];
    /** `sucedida_por`: a closed succession already replaced this row. */
    readonly succeededById: string | null;
    /** A live principal successor points at this row (`sucede_a`). */
    readonly isPredecessorInSuccession: boolean;
    /** Another live principal of the same user + vertical exists. */
    readonly hasOtherLivePrincipal: boolean;
    /** The credited payment's amount. */
    readonly paymentAmount: LatePaymentAmount;
    /** The authorization's amount, reread by id in this act. */
    readonly authorizationAmount: LatePaymentAmount;
    /**
     * The payment's own covered period is THE unpaid period (P1 wrote it, so it is not
     * a duplicate — DUPLICATE_MARKED writes none — and it is not a replay of an earlier,
     * already paid period). See `paymentCoversUnpaidPeriod`.
     */
    readonly paymentCoversUnpaidPeriod: boolean;
}

/**
 * Pure evaluation of the four conditions of `05` §3.
 *
 * Order: the succession exception first (D-4: "falle la condición que falle"),
 * then condition 1, then condition 4 (a duplicate of an already paid period is
 * P1's `COBRO_DUPLICADO`, never reason 7: D-3), then conditions 2 and 3.
 *
 * @param input.facts - The facts read in the same act
 * @returns Whether the late payment may reactivate, which condition failed, or S19 retention
 */
export function evaluateLatePaymentConditions(input: {
    readonly facts: LatePaymentFacts;
}): LatePaymentConditionsVerdict {
    const { facts } = input;
    if (facts.isPredecessorInSuccession) return { retainedForS19: true };
    if (!facts.admittedStatuses.includes(facts.status)) return { ok: false, failedCondition: 1 };
    if (!facts.paymentCoversUnpaidPeriod) return { ok: false, failedCondition: 4 };
    if (
        facts.paymentAmount.amountMinor !== facts.authorizationAmount.amountMinor ||
        facts.paymentAmount.currency !== facts.authorizationAmount.currency
    )
        return { ok: false, failedCondition: 2 };
    if (facts.hasOtherLivePrincipal || facts.succeededById !== null)
        return { ok: false, failedCondition: 3 };
    return { ok: true };
}

/**
 * D-4 (glossary «fila viva», rows 8 and 12): whether a live principal successor
 * points at this row, i.e. the row is the predecessor of a succession in progress.
 *
 * @param input.subscriptionId - The row that may be a predecessor
 * @param input.tx - Optional transaction
 * @returns True when a live successor points at the row
 */
export async function isLiveSuccessionPredecessor(input: {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const db = input.tx ?? getDb();
    const [successor] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.succeedsId, input.subscriptionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        )
        .limit(1);
    return Boolean(successor);
}

/**
 * Condition 3 (glossary «fila viva», row 6): whether another live principal of
 * the same user + vertical exists — the six live statuses, PENDING_AUTHORIZATION
 * included. A successor pointing at this row is D-4, not condition 3.
 *
 * @param input.subscription - The row being evaluated
 * @param input.tx - Optional transaction
 * @returns True when another live principal of the same user + vertical exists
 */
export async function hasOtherLivePrincipal(input: {
    readonly subscription: Pick<SelectSubscription, 'id' | 'userId' | 'vertical'>;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const { subscription } = input;
    if (!subscription.userId || !subscription.vertical) return false;
    const db = input.tx ?? getDb();
    const [other] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, subscription.userId),
                eq(subscriptions.vertical, subscription.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                ne(subscriptions.id, subscription.id),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES),
                or(isNull(subscriptions.succeedsId), ne(subscriptions.succeedsId, subscription.id))
            )
        )
        .limit(1);
    return Boolean(other);
}

/**
 * Condition 4, bound to the cycle that failed: whether the payment's covered period
 * is the unpaid period (`05` §3, condition 4: «no hay otro pago acreditado para el
 * mismo período»; condition 2: «el esperado para el período que cubre»; AC:B7:6:
 * «entra el pago del período»). Strictest reading, since the spec does not name the
 * period by column:
 *
 * - the payment has an open covered period (P1 wrote it; a `COBRO_DUPLICADO` has none, D-3);
 * - it was credited at or after `unpaidSince` (S5: `grace_started_at`, the instant S4 read
 *   the rejection) — so a replayed notice or a sweep of a payment credited BEFORE the
 *   grace opened can never reactivate the row;
 * - and its period starts after every open covered period already credited before
 *   `unpaidSince` — so a late credit of an earlier period does not count either.
 *
 * A missing `unpaidSince` fails closed.
 *
 * @param input.subscriptionId - The subscription the payment belongs to
 * @param input.paymentId - The credited payment
 * @param input.unpaidSince - When the unpaid period was observed (S5: `grace_started_at`)
 * @param input.tx - Optional transaction
 * @returns True only when the payment covers the unpaid period
 */
export async function paymentCoversUnpaidPeriod(input: {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly unpaidSince: Date | null;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    if (!input.unpaidSince) return false;
    const db = input.tx ?? getDb();
    const [covered] = await db
        .select({ periodStart: coveredPeriods.periodStart, creditedAt: coveredPeriods.creditedAt })
        .from(coveredPeriods)
        .where(
            and(eq(coveredPeriods.paymentId, input.paymentId), isNull(coveredPeriods.releasedAt))
        )
        .limit(1);
    if (!covered || covered.creditedAt.getTime() < input.unpaidSince.getTime()) return false;
    const [paidBefore] = await db
        .select({ latest: max(coveredPeriods.periodStart) })
        .from(coveredPeriods)
        .where(
            and(
                eq(coveredPeriods.subscriptionId, input.subscriptionId),
                isNull(coveredPeriods.releasedAt),
                lt(coveredPeriods.creditedAt, input.unpaidSince)
            )
        );
    const latest = paidBefore?.latest ?? null;
    return latest === null || covered.periodStart.getTime() > new Date(latest).getTime();
}

/**
 * Reads the facts of `05` §3 for one credited payment in the same act and
 * evaluates the four conditions. The authorization's amount is taken only from
 * a fresh read by id (I-2, G17).
 *
 * @param input.subscription - The subscription the payment belongs to
 * @param input.payment - The credited payment (id and amount)
 * @param input.authorizationRead - The authorization reread by id for this act
 * @param input.act - The act deciding on the read
 * @param input.admittedStatuses - The statuses condition 1 admits for the caller
 * @param input.unpaidSince - When the unpaid period was observed (S5: `grace_started_at`)
 * @param input.tx - Optional transaction
 * @returns The verdict of the four conditions
 */
export async function checkLatePaymentConditions(input: {
    readonly subscription: Pick<
        SelectSubscription,
        'id' | 'userId' | 'vertical' | 'status' | 'succeededById'
    >;
    readonly payment: { readonly id: string; readonly amount: LatePaymentAmount };
    readonly authorizationRead: ProviderRead<AuthorizationSnapshot>;
    readonly act: ActStart;
    readonly admittedStatuses: readonly string[];
    readonly unpaidSince: Date | null;
    readonly tx?: DrizzleClient;
}): Promise<LatePaymentConditionsVerdict> {
    const { snapshot: authorization } = assertFreshForAct({
        read: input.authorizationRead,
        act: input.act
    });
    return evaluateLatePaymentConditions({
        facts: {
            status: input.subscription.status,
            admittedStatuses: input.admittedStatuses,
            succeededById: input.subscription.succeededById,
            isPredecessorInSuccession: await isLiveSuccessionPredecessor({
                subscriptionId: input.subscription.id,
                tx: input.tx
            }),
            hasOtherLivePrincipal: await hasOtherLivePrincipal({
                subscription: input.subscription,
                tx: input.tx
            }),
            paymentAmount: input.payment.amount,
            authorizationAmount: {
                amountMinor: authorization.amount.amountMinor,
                currency: authorization.amount.currency
            },
            paymentCoversUnpaidPeriod: await paymentCoversUnpaidPeriod({
                subscriptionId: input.subscription.id,
                paymentId: input.payment.id,
                unpaidSince: input.unpaidSince,
                tx: input.tx
            })
        }
    });
}
