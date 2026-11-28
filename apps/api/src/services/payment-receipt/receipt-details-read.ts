/**
 * Reads everything a printed receipt can say beyond its own row (HOS-2682).
 *
 * The receipt row ({@link OwnReceipt}) carries the number, the issue date, the
 * payer and the amount. The owner asked for "every piece of data we have" on
 * the document, so this module gathers the rest from the rows the receipt was
 * issued for: the account, the plan and its vertical, the billing cycle and the
 * catalog price, the covered period, the payment method and its operation id,
 * and the promo code a payment spent a charge of.
 *
 * ---
 * OWNERSHIP IS NOT DECIDED HERE
 *
 * The caller passes a receipt that {@link readOwnReceipt} already returned for
 * the authenticated account, so ownership was settled IN THE QUERY before this
 * runs. This module only reads by id.
 *
 * Every field is optional on purpose: a manual payment has no provider, an
 * add-on has no plan, a payment without a promo has no code. The renderer
 * leaves out what is `null` instead of printing a placeholder.
 *
 * The listing a payment pays for is NOT read: a subscription covers the whole
 * vertical of an account (it has no listing column), and an add-on's
 * `target_id` is polymorphic with no type column to resolve it by.
 *
 * @module services/payment-receipt/receipt-details-read
 */

import {
    addonInstances,
    addonProducts,
    addons,
    billingOptions,
    coveredPeriods,
    eq,
    getDb,
    manualPayments,
    payments,
    plans,
    planVersions,
    promoCodes,
    promoRedemptionCharges,
    promoRedemptions,
    receipts,
    subscriptions,
    users
} from '@repo/db';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { resolvePlanDisplayName } from '@repo/service-core';
import { addCalendarMonths } from '@repo/utils';
import type { OwnReceipt } from './receipt-read.js';

/** How the receipt's payment reached Hospeda. */
export type ReceiptPaymentMethod = 'MERCADOPAGO' | 'MANUAL' | 'OTHER';

/** What the document prints besides the receipt row. Every field may be absent. */
export interface ReceiptDetails {
    /** Display name of the account the payment belongs to. */
    readonly accountName: string | null;
    /** Sign-in email of that account. */
    readonly accountEmail: string | null;
    /** Vertical id of the subscription (`accommodation`, `venue`, ...). */
    readonly vertical: string | null;
    /** User-facing plan or add-on name (the stored plan name is not user-facing). */
    readonly productName: string | null;
    /** Billing cycle (`monthly`, `quarterly`, `semiannual`, `annual`). */
    readonly cycle: string | null;
    /** First instant of the period this payment covers. */
    readonly periodStart: Date | null;
    /** Instant the covered period ends (exclusive). */
    readonly periodEnd: Date | null;
    /** `null` when the payment row could not be read. */
    readonly method: ReceiptPaymentMethod | null;
    /** The provider's id for the operation, or Hospeda's own id for a manual payment. */
    readonly operationId: string | null;
    /** When the provider charged, or when Hospeda registered the manual payment. */
    readonly paidAt: Date | null;
    /** Catalog price of one cycle, in minor units. Only meaningful next to a promo. */
    readonly listAmountMinor: number | null;
    readonly listCurrency: string | null;
    /** Promo code whose charge this payment spent, if any. */
    readonly promoCode: string | null;
}

/** The details of a receipt nothing more could be read for. */
export const EMPTY_RECEIPT_DETAILS: ReceiptDetails = {
    accountName: null,
    accountEmail: null,
    vertical: null,
    productName: null,
    cycle: null,
    periodStart: null,
    periodEnd: null,
    method: null,
    operationId: null,
    paidAt: null,
    listAmountMinor: null,
    listCurrency: null,
    promoCode: null
};

/**
 * End of a covered period: the start plus one cycle, day clamped to the month.
 *
 * @param input.periodStart - Start of the period, or `null`.
 * @param input.cycle - Billing cycle, or `null`.
 * @returns The exclusive end, or `null` when either input is missing or unknown.
 */
export function computeReceiptPeriodEnd(input: {
    readonly periodStart: Date | null;
    readonly cycle: string | null;
}): Date | null {
    const { periodStart, cycle } = input;
    if (!periodStart || !cycle || !Object.hasOwn(BILLING_CYCLE_MONTHS, cycle)) return null;
    const months = BILLING_CYCLE_MONTHS[cycle as keyof typeof BILLING_CYCLE_MONTHS];
    return addCalendarMonths({ from: periodStart, months, dayOverflow: 'clamp' });
}

/** Display name of an account: the chosen one, else first + last name. */
function accountNameOf(row: {
    readonly displayName: string | null;
    readonly firstName: string | null;
    readonly lastName: string | null;
}): string | null {
    if (row.displayName?.trim()) return row.displayName.trim();
    const full = [row.firstName, row.lastName]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(' ')
        .trim();
    return full === '' ? null : full;
}

function methodOf(provider: string | null, isManual: boolean): ReceiptPaymentMethod {
    if (isManual) return 'MANUAL';
    return provider?.toLowerCase() === 'mercadopago' ? 'MERCADOPAGO' : 'OTHER';
}

/** The account, plan, cycle and price of a subscription. */
async function readSubscriptionFacts(subscriptionId: string) {
    const [row] = await getDb()
        .select({
            vertical: subscriptions.vertical,
            planSlug: plans.slug,
            planName: plans.name,
            cycle: billingOptions.cycle,
            listAmount: billingOptions.amount,
            listCurrency: billingOptions.currency,
            displayName: users.displayName,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email
        })
        .from(subscriptions)
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .leftJoin(plans, eq(plans.id, planVersions.planId))
        .leftJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .leftJoin(users, eq(users.id, subscriptions.userId))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    if (!row) return null;
    const productName =
        row.planSlug && row.planName
            ? await resolvePlanDisplayName({
                  vertical: row.vertical,
                  plan: { slug: row.planSlug, name: row.planName }
              })
            : null;
    return {
        accountName: accountNameOf(row),
        accountEmail: row.email,
        vertical: row.vertical,
        productName,
        cycle: row.cycle,
        listAmountMinor: row.listAmount,
        listCurrency: row.listCurrency
    };
}

/** The account, add-on name, cycle and price of an add-on instance. */
async function readAddonFacts(addonInstanceId: string) {
    const [row] = await getDb()
        .select({
            name: addons.name,
            cycle: addonProducts.cycle,
            price: addonProducts.price,
            currency: addonProducts.currency,
            displayName: users.displayName,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email
        })
        .from(addonInstances)
        .leftJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .leftJoin(addons, eq(addons.id, addonProducts.addonId))
        .leftJoin(users, eq(users.id, addonInstances.ownerId))
        .where(eq(addonInstances.id, addonInstanceId))
        .limit(1);
    if (!row) return null;
    return {
        accountName: accountNameOf(row),
        accountEmail: row.email,
        vertical: null,
        productName: row.name,
        cycle: row.cycle,
        listAmountMinor: row.price,
        listCurrency: row.currency
    };
}

/**
 * Reads the printable details of a receipt the caller already owns.
 *
 * @param input.receipt - A receipt returned by {@link readOwnReceipt} for the caller.
 * @returns The details; fields that do not apply are `null`.
 */
export async function readReceiptDetails(input: {
    readonly receipt: OwnReceipt;
}): Promise<ReceiptDetails> {
    const db = getDb();
    const [base] = await db
        .select({
            paymentId: payments.id,
            provider: payments.provider,
            providerPaymentId: payments.providerPaymentId,
            factAt: payments.factAt,
            paymentSubscriptionId: payments.subscriptionId,
            addonInstanceId: payments.addonInstanceId,
            manualPaymentId: manualPayments.id,
            manualSubscriptionId: manualPayments.subscriptionId,
            manualPeriodStart: manualPayments.periodStart,
            manualRegisteredAt: manualPayments.registeredAt
        })
        .from(receipts)
        .leftJoin(payments, eq(payments.id, receipts.paymentId))
        .leftJoin(manualPayments, eq(manualPayments.id, receipts.manualPaymentId))
        .where(eq(receipts.id, input.receipt.id))
        .limit(1);
    if (!base) return EMPTY_RECEIPT_DETAILS;

    const isManual = base.manualPaymentId !== null;
    const subscriptionId = base.paymentSubscriptionId ?? base.manualSubscriptionId;

    const coveredMatch = isManual
        ? base.manualPaymentId
            ? eq(coveredPeriods.manualPaymentId, base.manualPaymentId)
            : undefined
        : base.paymentId
          ? eq(coveredPeriods.paymentId, base.paymentId)
          : undefined;

    const [facts, covered, promo] = await Promise.all([
        subscriptionId
            ? readSubscriptionFacts(subscriptionId)
            : base.addonInstanceId
              ? readAddonFacts(base.addonInstanceId)
              : Promise.resolve(null),
        coveredMatch
            ? db
                  .select({ periodStart: coveredPeriods.periodStart })
                  .from(coveredPeriods)
                  .where(coveredMatch)
                  .limit(1)
            : Promise.resolve([]),
        base.paymentId
            ? db
                  .select({ code: promoCodes.code })
                  .from(promoRedemptionCharges)
                  .innerJoin(
                      promoRedemptions,
                      eq(promoRedemptions.id, promoRedemptionCharges.redemptionId)
                  )
                  .innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
                  .where(eq(promoRedemptionCharges.paymentId, base.paymentId))
                  .limit(1)
            : Promise.resolve([])
    ]);

    const periodStart = covered[0]?.periodStart ?? base.manualPeriodStart ?? null;
    const cycle = facts?.cycle ?? null;

    return {
        accountName: facts?.accountName ?? null,
        accountEmail: facts?.accountEmail ?? null,
        vertical: facts?.vertical ?? null,
        productName: facts?.productName ?? null,
        cycle,
        periodStart,
        periodEnd: computeReceiptPeriodEnd({ periodStart, cycle }),
        method: methodOf(base.provider, isManual),
        operationId: isManual ? base.manualPaymentId : (base.providerPaymentId ?? null),
        paidAt: isManual ? (base.manualRegisteredAt ?? null) : (base.factAt ?? null),
        listAmountMinor: facts?.listAmountMinor ?? null,
        listCurrency: facts?.listCurrency ?? null,
        promoCode: promo[0]?.code ?? null
    };
}
