import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    desc,
    eq,
    inArray,
    manualPayments,
    payments,
    refunds,
    sql,
    subscriptions
} from '@repo/db';
import { startOfMarketDay } from '@repo/utils';
import {
    type BillingOptionReader,
    readAnchoredBillingOption
} from '../read-anchored-billing-option';
import type { RefundSource } from '../refund/refund-source';

/**
 * The revocation window of S36, in calendar days after the day of the charge being revoked
 * (Resolución 424/2020 on art. 34 of Ley 24.240; DEC-RF-001). It is fixed by the law, not a
 * versionable deadline of `billing_deadline_version` (02-nucleo.md:1748-1751), so it lives in code.
 */
export const REVOCATION_WINDOW_DAYS = 10;

/**
 * Provider payment statuses that count as credited (`payment-ledger.ts`). Local literals on
 * purpose: nothing from `@repo/db` is evaluated at module level.
 */
const CREDITED_PAYMENT_STATUSES = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;

/** The payment S36 returns by its RF1, found through the `sucedida_por` chain (AC:B5:22). */
export interface RevocablePayment {
    /** The `payment` or `manual_payment` the RF1 hangs from. */
    readonly source: RefundSource;
    /** When it was credited: `payment.fact_at` or `manual_payment.registered_at`. */
    readonly chargedAt: Date;
    /** The subscription row that owns the payment (the revoked row or a predecessor). */
    readonly ownerSubscriptionId: string;
    /** Cents: a payment's balance, or a manual payment's anchored option price (0 when unknown). */
    readonly amount: number;
    /** The currency of that amount; `null` when a manual payment has no anchored option. */
    readonly currency: string | null;
}

/**
 * The exclusive end of the revocation window: midnight (Buenos Aires) that starts the
 * eleventh calendar day after the charge's local day, so the window ends when the tenth
 * calendar day after the charge ends (I-4; in the customer's favour).
 *
 * @param input.chargedAt - The instant the revoked charge was credited
 * @returns The first instant outside the window
 */
export function revocationWindowEndsAt(input: { readonly chargedAt: Date }): Date {
    return startOfMarketDay({ instant: input.chargedAt, offsetDays: REVOCATION_WINDOW_DAYS + 1 });
}

/** One credited candidate of a single row, before choosing the latest. */
interface Candidate {
    readonly source: RefundSource;
    readonly chargedAt: Date;
    readonly createdAt: Date;
}

/** Later charge first; ties by `created_at`, then by `id` (I-3). */
function isLater(a: Candidate, b: Candidate): boolean {
    if (a.chargedAt.getTime() !== b.chargedAt.getTime())
        return a.chargedAt.getTime() > b.chargedAt.getTime();
    if (a.createdAt.getTime() !== b.createdAt.getTime())
        return a.createdAt.getTime() > b.createdAt.getTime();
    return a.source.id > b.source.id;
}

/** The latest credited payment of ONE row (provider or manual), or `null`. */
async function latestCreditedOfRow(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<Candidate | null> {
    const [provider] = await input.tx
        .select({ id: payments.id, factAt: payments.factAt, createdAt: payments.createdAt })
        .from(payments)
        .where(
            and(
                eq(payments.subscriptionId, input.subscriptionId),
                inArray(payments.status, [...CREDITED_PAYMENT_STATUSES])
            )
        )
        .orderBy(desc(payments.factAt), desc(payments.createdAt), desc(payments.id))
        .limit(1);
    const [manual] = await input.tx
        .select({
            id: manualPayments.id,
            registeredAt: manualPayments.registeredAt,
            createdAt: manualPayments.createdAt
        })
        .from(manualPayments)
        .where(
            and(
                eq(manualPayments.subscriptionId, input.subscriptionId),
                eq(manualPayments.status, 'REGISTERED')
            )
        )
        .orderBy(
            desc(manualPayments.registeredAt),
            desc(manualPayments.createdAt),
            desc(manualPayments.id)
        )
        .limit(1);
    const fromProvider: Candidate | null = provider
        ? {
              source: { kind: 'PAYMENT', id: provider.id },
              chargedAt: provider.factAt,
              createdAt: provider.createdAt
          }
        : null;
    // A REGISTERED manual payment always has `registered_at` (ck_manual_payment_registered).
    const fromManual: Candidate | null = manual?.registeredAt
        ? {
              source: { kind: 'MANUAL_PAYMENT', id: manual.id },
              chargedAt: manual.registeredAt,
              createdAt: manual.createdAt
          }
        : null;
    if (fromProvider && fromManual)
        return isLater(fromManual, fromProvider) ? fromManual : fromProvider;
    return fromProvider ?? fromManual;
}

/** The row whose `sucedida_por` points at this one (I-5); never `sucede_a`. */
async function predecessorOf(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<string | null> {
    const [row] = await input.tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.succeededById, input.subscriptionId))
        .limit(1);
    return row?.id ?? null;
}

/** A billing option reader bound to the caller's transaction. */
function readerIn(tx: DrizzleClient): BillingOptionReader {
    return {
        async findByVersionAndId({ planVersionId, billingOptionId }) {
            const [row] = await tx
                .select({
                    id: billingOptions.id,
                    planVersionId: billingOptions.planVersionId,
                    cycle: billingOptions.cycle,
                    amount: billingOptions.amount,
                    currency: billingOptions.currency
                })
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, planVersionId),
                        eq(billingOptions.id, billingOptionId)
                    )
                )
                .limit(1);
            return row ?? null;
        }
    };
}

/** The amount S36 returns for a candidate: the payment balance, or the anchored price (I-2). */
async function amountOf(input: {
    readonly tx: DrizzleClient;
    readonly candidate: Candidate;
    readonly ownerSubscriptionId: string;
}): Promise<{ readonly amount: number; readonly currency: string | null }> {
    const { tx, candidate } = input;
    if (candidate.source.kind === 'PAYMENT') {
        const [payment] = await tx
            .select({ amount: payments.amount, currency: payments.currency })
            .from(payments)
            .where(eq(payments.id, candidate.source.id))
            .limit(1);
        const [executed] = await tx
            .select({ amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
            .from(refunds)
            .where(and(eq(refunds.paymentId, candidate.source.id), eq(refunds.status, 'EXECUTED')));
        return {
            amount: (payment?.amount ?? 0) - (executed?.amount ?? 0),
            currency: payment?.currency ?? null
        };
    }
    const [owner] = await tx
        .select({
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.ownerSubscriptionId))
        .limit(1);
    if (!owner?.planVersionId || !owner.billingOptionId) return { amount: 0, currency: null };
    const option = await readAnchoredBillingOption({
        subscription: {
            planVersionId: owner.planVersionId,
            billingOptionId: owner.billingOptionId
        },
        reader: readerIn(tx)
    });
    return { amount: option?.amount ?? 0, currency: option?.currency ?? null };
}

/**
 * The last credited payment S36 revokes (AC:B5:22; I-3, I-5). For the row itself, the
 * latest credited `payment` (by `fact_at`) or `REGISTERED` `manual_payment` (by
 * `registered_at`); a successor living on the credit of DEC-SUB-006 has none, so the walk
 * goes back through the row whose `succeeded_by_id` is this one, and so on, until the
 * first row with a credited payment. A cycle ends the walk with `null`. Every read runs in
 * the caller's `tx`.
 *
 * @param input.tx - The caller's transaction
 * @param input.subscriptionId - The row being revoked
 * @returns The payment, its credit instant, owner row and amount; `null` when the chain has none
 */
export async function findRevocablePayment(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<RevocablePayment | null> {
    const visited = new Set<string>();
    let current: string | null = input.subscriptionId;
    while (current && !visited.has(current)) {
        visited.add(current);
        const candidate = await latestCreditedOfRow({ tx: input.tx, subscriptionId: current });
        if (candidate) {
            const { amount, currency } = await amountOf({
                tx: input.tx,
                candidate,
                ownerSubscriptionId: current
            });
            return {
                source: candidate.source,
                chargedAt: candidate.chargedAt,
                ownerSubscriptionId: current,
                amount,
                currency
            };
        }
        current = await predecessorOf({ tx: input.tx, subscriptionId: current });
    }
    return null;
}
