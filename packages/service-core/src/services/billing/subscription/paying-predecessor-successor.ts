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
 * never read: the declaration base comes from the successor's first charge. The
 * shape is checked on the direct predecessor only; whether it was paying is
 * {@link isPayingPrincipal}, which walks the whole chain (owner, HOS-2224). A
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
        paymentMethod: subscriptions.paymentMethod,
        predecessorId: subscriptions.succeedsId
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
    return isPayingPrincipal({
        principal: { id: predecessor.id, predecessorId: predecessor.predecessorId },
        payments,
        tx
    });
}

/**
 * Upper bound on the rows {@link isPayingPrincipal} visits along one succession chain. Every
 * hop is a plan change, so a real chain is far shorter; reaching it means corrupt links.
 */
export const MAX_SUCCESSION_CHAIN_ROWS = 64;

/** A row of a succession chain: its id and its own `sucede_a` (null once closed). */
export interface SuccessionChainRow {
    readonly id: string;
    readonly predecessorId: string | null;
}

/**
 * Reads the predecessor of a chain row: by its `sucede_a` while the succession is in progress,
 * or by the predecessor's `sucedida_por` once it was closed (INV:D15, AC:B8b:10). A row nobody
 * names as successor (a first subscription, or one whose link was cleared, such as the
 * predecessor of an abandoned successor) has none.
 */
async function readPredecessor({
    row,
    tx
}: {
    readonly row: SuccessionChainRow;
    readonly tx?: DrizzleClient;
}): Promise<SuccessionChainRow | null> {
    const db = tx ?? getDb();
    const columns = { id: subscriptions.id, predecessorId: subscriptions.succeedsId };
    const [predecessor] =
        row.predecessorId === null
            ? await db
                  .select(columns)
                  .from(subscriptions)
                  .where(eq(subscriptions.succeededById, row.id))
                  .limit(1)
            : await db
                  .select(columns)
                  .from(subscriptions)
                  .where(eq(subscriptions.id, row.predecessorId))
                  .limit(1);
    return predecessor ?? null;
}

/**
 * «Pagando» of a principal (`NUCLEO/01` §2, B/16 §2.2, `03-maquinas` A1 and §3.2): it has a
 * credited payment of its own, or it is the successor of a predecessor that was paying. The
 * definition is recursive, so the succession chain is walked back until a row with a credited
 * payment (paying) or a row with no predecessor (not paying). A1, the USER/GLOBAL orphanhood
 * read and the S4/S16 guards all read this one predicate (owner, HOS-2224).
 *
 * Each hop reads the predecessor by the row's `sucede_a` or, once the succession was closed,
 * by the predecessor's `sucedida_por` (INV:D15, AC:B8b:10): closing it clears `succeeds_id` on
 * the successor, and a successor in the credit of a plan change has no payment of its own until
 * its first charge — after two plan changes in a row, neither does its predecessor. A read
 * error, a cycle, or a chain longer than {@link MAX_SUCCESSION_CHAIN_ROWS} is thrown, never
 * taken as "not paying".
 *
 * @param input.principal - The principal's id and its `succeeds_id`
 * @param input.payments - The credited-payment ledger
 * @param input.tx - Optional transaction every read runs in
 * @returns True when some row of the principal's succession chain has a credited payment
 */
export async function isPayingPrincipal({
    principal,
    payments,
    tx
}: {
    readonly principal: SuccessionChainRow;
    readonly payments: SubscriptionPayments;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const visited = new Set<string>();
    let row: SuccessionChainRow | null = principal;
    while (row !== null) {
        if (visited.has(row.id)) {
            throw new Error(`Succession chain of ${principal.id} has a cycle at ${row.id}`);
        }
        if (visited.size >= MAX_SUCCESSION_CHAIN_ROWS) {
            throw new Error(
                `Succession chain of ${principal.id} exceeds ${MAX_SUCCESSION_CHAIN_ROWS} rows`
            );
        }
        visited.add(row.id);
        if (await payments.hasCreditedPayment({ subscriptionId: row.id, tx })) return true;
        row = await readPredecessor({ row, tx });
    }
    return false;
}

/** A row the sweep or the receiver may find in grace through the successor branch of S4. */
export interface PayingSuccessorInGraceCandidate extends PayingSuccessorCandidate {
    readonly status: string;
}

/**
 * Whether the row is in `GRACE_PERIOD` because it entered by the successor branch of
 * S4 (AC:B7:4, DEC-SUB-022; I-1, derived, no column): a card principal in grace,
 * with no credited payment of its own, that {@link isSuccessorOfPayingPredecessor}
 * admits. Only that row has its preapproval re-read every day and is suspended by
 * S6 (second or fifth event) when the provider paused or cancelled it. A read
 * error is thrown, never taken as "not that successor".
 */
export async function isPayingSuccessorInGrace({
    subscription,
    payments,
    tx
}: {
    readonly subscription: PayingSuccessorInGraceCandidate;
    readonly payments: SubscriptionPayments;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    if (subscription.status !== 'GRACE_PERIOD') return false;
    if (!successorDeclaredFromPayingBase({ successor: subscription })) return false;
    if (await payments.hasCreditedPayment({ subscriptionId: subscription.id, tx })) return false;
    return isSuccessorOfPayingPredecessor({ subscription, payments, tx });
}

/**
 * Reads the row by id and answers whether it is the successor of a paying
 * predecessor in grace ({@link isPayingSuccessorInGrace}); the receiver asks this
 * before mirroring a provider cancellation on grace (D-8).
 *
 * @returns The row's id and grace start when it is that successor, else `null`
 */
export async function readPayingSuccessorInGrace({
    subscriptionId,
    payments,
    tx
}: {
    readonly subscriptionId: string;
    readonly payments: SubscriptionPayments;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly id: string; readonly graceStartedAt: Date } | null> {
    const db = tx ?? getDb();
    const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    if (!row || row.graceStartedAt === null) return null;
    if (!(await isPayingSuccessorInGrace({ subscription: row, payments, tx }))) return null;
    return { id: row.id, graceStartedAt: row.graceStartedAt };
}
