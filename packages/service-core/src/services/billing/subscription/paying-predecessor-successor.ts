import type { DrizzleClient } from '@repo/db';
import { eq, getDb, subscriptions } from '@repo/db';
import type { SubscriptionPayments } from './subscription-billing-ports';

/** The successor facts the paying-predecessor branch of S4 reads (AC:B7:4). */
export interface PayingSuccessorFacts {
    readonly class: string;
    readonly paymentMethod: string | null;
    readonly firstChargeAt: Date | null;
    readonly authorizationWindowEndsAt: Date | null;
}

/** The predecessor facts the paying-predecessor branch of S4 reads (AC:B7:4). */
export interface PayingPredecessorFacts {
    readonly class: string;
    readonly paymentMethod: string | null;
}

/** A row that may be the successor of a paying predecessor. */
export interface PayingSuccessorCandidate extends PayingSuccessorFacts {
    readonly id: string;
    readonly succeedsId: string | null;
}

/**
 * Pure half of the successor branch of S4 (DEC-SUB-022, AC:B7:4): true when the
 * successor is a card principal declared from `ACTIVE` or `CANCEL_SCHEDULED`.
 *
 * The declaration base is read from the successor's own first charge (AC:B3:24,
 * INV:D8): every successor is born with its first charge after its authorization
 * window, except the successor of a card `SUSPENDED`, which charges on
 * authorization. A missing first charge or window fails towards S16.
 */
export function successorDeclaredFromPayingBase({
    successor
}: {
    readonly successor: PayingSuccessorFacts;
}): boolean {
    if (successor.class !== 'PRINCIPAL' || successor.paymentMethod !== 'CARD') return false;
    if (successor.firstChargeAt === null || successor.authorizationWindowEndsAt === null)
        return false;
    return successor.firstChargeAt.getTime() > successor.authorizationWindowEndsAt.getTime();
}

/**
 * Pure shape check of the successor branch of S4 over facts already read: the
 * successor qualifies by {@link successorDeclaredFromPayingBase} and its
 * predecessor exists and is a card principal (a manual payer is never reached,
 * DEC-SUB-022 📌1). Whether the predecessor was paying is read separately.
 */
export function payingSuccessorShape({
    successor,
    predecessor
}: {
    readonly successor: PayingSuccessorFacts;
    readonly predecessor: PayingPredecessorFacts | null;
}): boolean {
    if (!successorDeclaredFromPayingBase({ successor })) return false;
    if (predecessor === null) return false;
    return predecessor.class === 'PRINCIPAL' && predecessor.paymentMethod === 'CARD';
}

/**
 * The single predicate shared by the guards of S4 and S16 (TRANS:B:S4,
 * TRANS:B:S16, DEC-SUB-022, AC:B7:4): whether the row is the successor of a
 * predecessor that was paying, so its first rejected charge enters grace
 * instead of `CHARGE_DECLINED`.
 *
 * The predecessor is read by the row's `sucede_a` or, once the succession was
 * closed, by the predecessor's `sucedida_por` (INV:D15). Its current status is
 * never read: the declaration base comes from the successor's first charge. A
 * read error is thrown, never taken as "not a successor".
 */
export async function isSuccessorOfPayingPredecessor({
    subscription,
    payments,
    tx
}: {
    readonly subscription: PayingSuccessorCandidate;
    readonly payments: SubscriptionPayments;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    if (!successorDeclaredFromPayingBase({ successor: subscription })) return false;
    const db = tx ?? getDb();
    const predecessorColumns = {
        id: subscriptions.id,
        class: subscriptions.class,
        paymentMethod: subscriptions.paymentMethod
    };
    const [predecessor] =
        subscription.succeedsId === null
            ? await db
                  .select(predecessorColumns)
                  .from(subscriptions)
                  .where(eq(subscriptions.succeededById, subscription.id))
                  .limit(1)
            : await db
                  .select(predecessorColumns)
                  .from(subscriptions)
                  .where(eq(subscriptions.id, subscription.succeedsId))
                  .limit(1);
    if (!predecessor) return false;
    if (!payingSuccessorShape({ successor: subscription, predecessor })) return false;
    return payments.hasCreditedPayment({ subscriptionId: predecessor.id, tx });
}
