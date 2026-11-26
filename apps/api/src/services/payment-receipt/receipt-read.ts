/**
 * Reads the receipts an account owns (HOS-2566).
 *
 * ---
 * WHO OWNS A RECEIPT
 *
 * A `receipt` row carries no owner column. Its owner is the owner of the thing
 * it was issued for, and there are three such things:
 *
 *   1. an automatic payment of a subscription  -> `subscription.user_id`
 *   2. a manual payment of a subscription      -> `subscription.user_id`
 *   3. an automatic payment of an add-on       -> `addon_instance.owner_id`
 *
 * Every function here resolves the owner through those three paths and filters
 * by it IN THE QUERY, so a receipt that is somebody else's is indistinguishable
 * from one that does not exist: both come back `null`, and the route answers the
 * same 404 for both (`apps/api/docs/error-contract.md`).
 *
 * Amounts are integers in the currency's minor unit. A manual payment stores no
 * amount, so its receipt has none to show (`amountMinor: null`).
 *
 * @module services/payment-receipt/receipt-read
 */

import {
    addonInstances,
    addonProducts,
    addons,
    and,
    eq,
    getDb,
    manualPayments,
    payments,
    plans,
    planVersions,
    receipts,
    subscriptions
} from '@repo/db';

/** What a receipt is for, as the document words it. */
export type ReceiptConcept =
    | { readonly kind: 'PLAN'; readonly name: string | null }
    | { readonly kind: 'ADDON'; readonly name: string | null };

/** One receipt, projected for display. */
export interface OwnReceipt {
    readonly id: string;
    readonly receiptNumber: number;
    readonly issuedAt: Date;
    readonly payerName: string | null;
    readonly payerEmail: string | null;
    /** Minor units; null for a manual payment, which stores no amount. */
    readonly amountMinor: number | null;
    readonly currency: string | null;
    readonly concept: ReceiptConcept;
}

/** Built per call, not at import: partial `@repo/db` mocks in route suites would trip a module-level read. */
function receiptColumns() {
    return {
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        issuedAt: receipts.issuedAt,
        payerName: receipts.payerName,
        payerEmail: receipts.payerEmail
    };
}

/** Rows of the three ownership paths for one account, optionally narrowed to one receipt. */
async function readRows(input: {
    readonly userId: string;
    readonly receiptId?: string;
}): Promise<readonly OwnReceipt[]> {
    const db = getDb();
    const byId = input.receiptId ? eq(receipts.id, input.receiptId) : undefined;

    const [subscriptionPayments, manual, addonPayments] = await Promise.all([
        db
            .select({
                ...receiptColumns(),
                amountMinor: payments.amount,
                currency: payments.currency,
                conceptName: plans.name
            })
            .from(receipts)
            .innerJoin(payments, eq(payments.id, receipts.paymentId))
            .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
            .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .leftJoin(plans, eq(plans.id, planVersions.planId))
            .where(and(eq(subscriptions.userId, input.userId), byId)),
        db
            .select({ ...receiptColumns(), conceptName: plans.name })
            .from(receipts)
            .innerJoin(manualPayments, eq(manualPayments.id, receipts.manualPaymentId))
            .innerJoin(subscriptions, eq(subscriptions.id, manualPayments.subscriptionId))
            .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .leftJoin(plans, eq(plans.id, planVersions.planId))
            .where(and(eq(subscriptions.userId, input.userId), byId)),
        db
            .select({
                ...receiptColumns(),
                amountMinor: payments.amount,
                currency: payments.currency,
                conceptName: addons.name
            })
            .from(receipts)
            .innerJoin(payments, eq(payments.id, receipts.paymentId))
            .innerJoin(addonInstances, eq(addonInstances.id, payments.addonInstanceId))
            .leftJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .leftJoin(addons, eq(addons.id, addonProducts.addonId))
            .where(and(eq(addonInstances.ownerId, input.userId), byId))
    ]);

    return [
        ...subscriptionPayments.map(
            ({ conceptName, ...row }): OwnReceipt => ({
                ...row,
                concept: { kind: 'PLAN', name: conceptName }
            })
        ),
        ...manual.map(
            ({ conceptName, ...row }): OwnReceipt => ({
                ...row,
                amountMinor: null,
                currency: null,
                concept: { kind: 'PLAN', name: conceptName }
            })
        ),
        ...addonPayments.map(
            ({ conceptName, ...row }): OwnReceipt => ({
                ...row,
                concept: { kind: 'ADDON', name: conceptName }
            })
        )
    ];
}

/**
 * Reads one receipt, only if the account owns it.
 *
 * @param input.receiptId - The receipt to read.
 * @param input.userId - The authenticated account.
 * @returns The receipt, or `null` when it does not exist OR is somebody else's.
 */
export async function readOwnReceipt(input: {
    readonly receiptId: string;
    readonly userId: string;
}): Promise<OwnReceipt | null> {
    const rows = await readRows({ userId: input.userId, receiptId: input.receiptId });
    return rows[0] ?? null;
}

/**
 * Lists the receipts an account owns, newest number first.
 *
 * @param input.userId - The authenticated account.
 */
export async function listOwnReceipts(input: {
    readonly userId: string;
}): Promise<readonly OwnReceipt[]> {
    const rows = await readRows({ userId: input.userId });
    return [...rows].sort((a, b) => b.receiptNumber - a.receiptNumber);
}
