/**
 * Reads everything a printed receipt can say beyond its own row (HOS-2682).
 *
 * The receipt row ({@link OwnReceipt}) carries the number, the issue date, the
 * payer and the amount. The owner asked for "every piece of data we have" on
 * the document, so this module gathers the rest from the rows the receipt was
 * issued for: the account, the plan and its vertical, the billing cycle, the
 * covered period, the payment method and its operation id, and the promo codes
 * a payment spent a charge of.
 *
 * ---
 * OWNERSHIP IS NOT DECIDED HERE
 *
 * The caller passes a receipt that {@link readOwnReceipt} already returned for
 * the authenticated account, so ownership was settled IN THE QUERY before this
 * runs. This module only reads by id.
 *
 * ---
 * ONLY WHAT IS TRUE OF THE PAYMENT
 *
 * A subscription's `plan_version_id` and `billing_option_id` are rewritten in
 * place when a scheduled change applies, and the payment row stores no
 * snapshot of either. So the subscription's plan and cycle describe TODAY, not
 * necessarily the day of the payment:
 *
 *   - the period end comes from the NEXT covered period of the subscription
 *     when there is one (a historical fact), and the cycle is printed only when
 *     it agrees with that end;
 *   - when a plan migration applied after the payment, the plan and the cycle
 *     are left out rather than printed wrong;
 *   - no catalog price is ever read, so no subtotal or discount amount is
 *     invented: the promo codes are named, the amount is the one paid.
 *
 * Every field is optional on purpose: a manual payment has no provider, an
 * add-on has no plan, a payment without a promo has no code. The renderer
 * leaves out what is missing instead of printing a placeholder.
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
    and,
    asc,
    billingOptions,
    coveredPeriods,
    desc,
    eq,
    getDb,
    gt,
    isNull,
    manualPayments,
    payments,
    planMigrationSubscriptions,
    plans,
    planVersions,
    promoCodes,
    promoRedemptionCharges,
    promoRedemptions,
    receipts,
    sql,
    subscriptions,
    users
} from '@repo/db';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { notHeldByPageChargeMark, resolvePlanDisplayName } from '@repo/service-core';
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
    /** Promo codes whose charges this payment spent, oldest redemption first. */
    readonly promoCodes: readonly string[];
    /**
     * Whether the subscription's plan today is known to be the payment's. When
     * `false`, no plan name may be printed, not even the receipt row's.
     */
    readonly planTrusted: boolean;
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
    promoCodes: [],
    planTrusted: true
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

/**
 * How a payment reached Hospeda, from its row.
 *
 * Providers are stored as `MERCADO_PAGO` (and `FAKE` in tests); the comparison
 * ignores case and separators so a spelling change does not silently demote a
 * real Mercado Pago receipt to "Pago en línea".
 *
 * @param input.provider - `payment.provider`, or `null` for a manual payment.
 * @param input.isManual - Whether the receipt was issued for a manual payment.
 */
export function resolveReceiptPaymentMethod(input: {
    readonly provider: string | null;
    readonly isManual: boolean;
}): ReceiptPaymentMethod {
    if (input.isManual) return 'MANUAL';
    const normalized = input.provider?.replace(/[^a-z]/gi, '').toLowerCase();
    return normalized === 'mercadopago' ? 'MERCADOPAGO' : 'OTHER';
}

/**
 * The cycle and the end of a covered period, printed only when they are true
 * of the payment (see the module header).
 *
 * @param input.periodStart - Start of this payment's covered period.
 * @param input.nextPeriodStart - Start of the subscription's next covered period, if any.
 * @param input.cycle - The cycle the subscription has today.
 * @param input.planTrusted - Whether today's plan is known to be the payment's.
 */
export function resolveReceiptPeriod(input: {
    readonly periodStart: Date | null;
    readonly nextPeriodStart: Date | null;
    readonly cycle: string | null;
    readonly planTrusted: boolean;
}): { readonly periodEnd: Date | null; readonly cycle: string | null } {
    const { periodStart, nextPeriodStart } = input;
    const cycle = input.planTrusted ? input.cycle : null;
    const computed = computeReceiptPeriodEnd({ periodStart, cycle });
    if (nextPeriodStart) {
        const agrees = computed !== null && computed.getTime() === nextPeriodStart.getTime();
        return { periodEnd: nextPeriodStart, cycle: agrees ? cycle : null };
    }
    return { periodEnd: computed, cycle: computed ? cycle : null };
}

/** The account, plan and cycle a subscription has today. */
async function readSubscriptionFacts(subscriptionId: string) {
    const [row] = await getDb()
        .select({
            vertical: subscriptions.vertical,
            planSlug: plans.slug,
            planName: plans.name,
            cycle: billingOptions.cycle,
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
        cycle: row.cycle
    };
}

/** The account and add-on name of an add-on instance (anchored to its product at purchase). */
async function readAddonFacts(addonInstanceId: string) {
    const [row] = await getDb()
        .select({
            name: addons.name,
            cycle: addonProducts.cycle,
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
        cycle: row.cycle
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
        // A payment held by a page-charge mark is never a purchase's payment
        // (GUARD:HELD-ROWS); `readOwnReceipt` already excludes it, and so does this.
        .where(and(eq(receipts.id, input.receipt.id), notHeldByPageChargeMark(payments.id)))
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
    const paidAt = isManual ? (base.manualRegisteredAt ?? null) : (base.factAt ?? null);

    const [facts, covered, promos, laterMigration] = await Promise.all([
        subscriptionId
            ? readSubscriptionFacts(subscriptionId)
            : base.addonInstanceId
              ? readAddonFacts(base.addonInstanceId)
              : Promise.resolve(null),
        // A refund releases a period and a re-imputation adds another for the same
        // payment: the open row wins, then the latest credited.
        coveredMatch
            ? db
                  .select({ periodStart: coveredPeriods.periodStart })
                  .from(coveredPeriods)
                  .where(coveredMatch)
                  .orderBy(
                      sql`${coveredPeriods.releasedAt} IS NULL DESC`,
                      desc(coveredPeriods.creditedAt)
                  )
                  .limit(1)
            : Promise.resolve([]),
        // Stackable promos: one charge row per redemption for the same payment.
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
                  .orderBy(asc(promoRedemptions.redeemedAt), asc(promoCodes.code))
            : Promise.resolve([]),
        subscriptionId && paidAt
            ? db
                  .select({ id: planMigrationSubscriptions.id })
                  .from(planMigrationSubscriptions)
                  .where(
                      and(
                          eq(planMigrationSubscriptions.subscriptionId, subscriptionId),
                          gt(planMigrationSubscriptions.appliedAt, paidAt)
                      )
                  )
                  .limit(1)
            : Promise.resolve([])
    ]);

    const periodStart = covered[0]?.periodStart ?? base.manualPeriodStart ?? null;
    const next =
        subscriptionId && periodStart
            ? await db
                  .select({ periodStart: coveredPeriods.periodStart })
                  .from(coveredPeriods)
                  .where(
                      and(
                          eq(coveredPeriods.subscriptionId, subscriptionId),
                          gt(coveredPeriods.periodStart, periodStart),
                          isNull(coveredPeriods.releasedAt)
                      )
                  )
                  .orderBy(asc(coveredPeriods.periodStart))
                  .limit(1)
            : [];
    const planTrusted = laterMigration.length === 0;
    const period = resolveReceiptPeriod({
        periodStart,
        nextPeriodStart: next[0]?.periodStart ?? null,
        cycle: facts?.cycle ?? null,
        planTrusted
    });

    return {
        accountName: facts?.accountName ?? null,
        accountEmail: facts?.accountEmail ?? null,
        vertical: facts?.vertical ?? null,
        productName: planTrusted ? (facts?.productName ?? null) : null,
        cycle: period.cycle,
        periodStart,
        periodEnd: period.periodEnd,
        method: resolveReceiptPaymentMethod({ provider: base.provider, isManual }),
        operationId: isManual ? base.manualPaymentId : (base.providerPaymentId ?? null),
        paidAt,
        promoCodes: [...new Set(promos.map((row) => row.code))],
        planTrusted
    };
}
