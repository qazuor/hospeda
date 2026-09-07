/**
 * Where a recurring add-on's billing period comes from, and how its purchase
 * row is found from a MercadoPago preapproval id (HOS-847 PR 5).
 *
 * ## The period is OURS. It is never read off MercadoPago
 *
 * `auto_recurring.free_trial` and `next_payment_date` describe the terms of the
 * PLAN a preapproval was created from, not what MercadoPago is going to do to
 * this payer. HOS-1012 measured two preapprovals for the same payer, two
 * seconds apart, carrying byte-identical `free_trial` — one whose trial ran and
 * one whose trial had already been spent; in production that promised fourteen
 * free days and charged ARS 18.000 one hundred and eighteen seconds later
 * (HOS-522). The repo's answer was to stop asking. So the period here is
 * arithmetic over a CONFIRMED charge and the period we last recorded, and
 * nothing in this module reads a provider field.
 *
 * ## Why a charge inside the paid window does not advance anything
 *
 * A recurring add-on's FIRST charge lands seconds after its preapproval is
 * authorized — after activation has already opened a period. Advancing on
 * every settled charge would hand that buyer two months for one payment.
 * {@link computeNextAddonPeriod} therefore advances only when the charge
 * settles at or after the period it already paid for, which also absorbs a
 * MercadoPago retry of a failed charge (a DIFFERENT payment id, so the ledger's
 * dedupe never sees it, yet still inside the same window).
 *
 * @module services/addon-recurring-period
 */

import type { AddonBillingIntervalLabel } from './billing/mp-addon-plan-provisioning.service.js';

/**
 * Months one cadence buys.
 *
 * Annual is twelve MONTHS and not one year because that is what MercadoPago
 * accepts — `frequency_type` admits only `'days' | 'months'`, and
 * `toMercadoPagoInterval` converts a year to `months × 12` before the request
 * leaves. Keeping the local arithmetic in the same unit means the row and the
 * preapproval cannot describe different schedules.
 */
const ADDON_INTERVAL_MONTHS: Readonly<Record<AddonBillingIntervalLabel, number>> = {
    monthly: 1,
    annual: 12
};

/**
 * Cadence assumed when a purchase row carries no `billing_interval`.
 *
 * Every row PR 4 writes carries `'monthly'`, so this is only reachable for a
 * row written before that column existed or hand-edited since. Monthly is the
 * conservative default: it grants the SHORTER window, so an unknown cadence
 * under-serves rather than gives a year away.
 */
const ADDON_FALLBACK_INTERVAL: AddonBillingIntervalLabel = 'monthly';

/**
 * Narrow a raw `billing_addon_purchases.billing_interval` value (a plain
 * `varchar`, so anything at all) to a cadence this module can compute with.
 *
 * @param raw - The column value, possibly `null` or an unknown string.
 * @returns The matching cadence, or {@link ADDON_FALLBACK_INTERVAL}.
 */
export function normalizeAddonBillingInterval(
    raw: string | null | undefined
): AddonBillingIntervalLabel {
    return raw === 'annual' || raw === 'monthly' ? raw : ADDON_FALLBACK_INTERVAL;
}

/**
 * Add whole months to a date, clamping the day-of-month rather than rolling
 * over into the next month.
 *
 * `new Date(2026, 0, 31)` plus one month is 28 or 29 February, never 2 or 3
 * March. JavaScript's own `setMonth` rolls over, which would walk a
 * subscription bought on the 31st forward by a day every February — a slow
 * drift nobody would notice until a customer was billed on the wrong date.
 *
 * @param params.from - The anchor date (not mutated).
 * @param params.months - Whole months to add. Must be positive in practice.
 * @returns A new `Date`, `months` later, with the time-of-day preserved.
 */
export function addMonthsClamped(params: { readonly from: Date; readonly months: number }): Date {
    const { from, months } = params;
    const target = new Date(from.getTime());
    const dayOfMonth = target.getUTCDate();

    // Move to the 1st first so the month increment cannot roll over on its own,
    // then clamp the day back down to whatever the destination month allows.
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);

    const daysInTargetMonth = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    target.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));

    return target;
}

/** The window a confirmed charge opened, when it opened a new one. */
export interface AddonBillingPeriod {
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
}

/**
 * Decide what a confirmed add-on charge does to the purchase's billing period.
 *
 * Three cases, and the middle one is the whole point:
 *
 *  1. **No period recorded yet** — the row was activated by a path that could
 *     not open one, or the activation webhook never arrived and this charge is
 *     the first thing we have heard. The charge opens `[settledAt, +interval]`.
 *  2. **The charge settles INSIDE the recorded period** — it is the charge that
 *     funded that period (the initial authorization charge lands seconds after
 *     activation), or a MercadoPago retry within it. Returns `null`: nothing to
 *     advance. Without this, every recurring add-on would be handed a free
 *     second period on its first day.
 *  3. **The charge settles at or after the period end** — a genuine renewal.
 *     The new window is anchored on the OLD `currentPeriodEnd`, not on
 *     `settledAt`, so webhook latency cannot walk the billing date forward.
 *
 * @param params.currentPeriodEnd - As stored, or `null` when never set.
 * @param params.settledAt - When MercadoPago settled this charge.
 * @param params.billingInterval - The purchase's cadence.
 * @returns The new period, or `null` when this charge advances nothing.
 */
export function computeNextAddonPeriod(params: {
    readonly currentPeriodEnd: Date | null;
    readonly settledAt: Date;
    readonly billingInterval: AddonBillingIntervalLabel;
}): AddonBillingPeriod | null {
    const { currentPeriodEnd, settledAt, billingInterval } = params;
    const months = ADDON_INTERVAL_MONTHS[billingInterval];

    if (currentPeriodEnd === null) {
        return {
            currentPeriodStart: settledAt,
            currentPeriodEnd: addMonthsClamped({ from: settledAt, months })
        };
    }

    if (settledAt.getTime() < currentPeriodEnd.getTime()) {
        return null;
    }

    return {
        currentPeriodStart: currentPeriodEnd,
        currentPeriodEnd: addMonthsClamped({ from: currentPeriodEnd, months })
    };
}

/**
 * The period a freshly authorized preapproval opens.
 *
 * Activation opens the window even though no charge is confirmed yet, because
 * MercadoPago authorizing a preapproval created WITHOUT a free trial means it
 * is charging now — and the alternative (leave `current_period_end` null until
 * the charge webhook lands) reproduces the exact hole HOS-847 exists to close:
 * a live recurring purchase invisible to every date-bounded sweep.
 * {@link computeNextAddonPeriod} case 2 is what stops that same charge from
 * then opening a SECOND window.
 *
 * @param params.from - Activation instant.
 * @param params.billingInterval - The purchase's cadence.
 * @returns The opening window.
 */
export function computeInitialAddonPeriod(params: {
    readonly from: Date;
    readonly billingInterval: AddonBillingIntervalLabel;
}): AddonBillingPeriod {
    return {
        currentPeriodStart: params.from,
        currentPeriodEnd: addMonthsClamped({
            from: params.from,
            months: ADDON_INTERVAL_MONTHS[params.billingInterval]
        })
    };
}

/**
 * The `billing_addon_purchases` row backing one MercadoPago preapproval, as the
 * webhook routing needs it.
 */
export interface RecurringAddonPurchaseRow {
    readonly id: string;
    readonly customerId: string;
    /**
     * The customer's PLAN subscription — see the column's own comment in
     * `addon.checkout.recurring-write.ts`. NEVER the add-on's own preapproval
     * row; that one is reached through `mpSubscriptionId`.
     */
    readonly subscriptionId: string | null;
    readonly addonSlug: string;
    readonly status: string;
    readonly mpSubscriptionId: string | null;
    readonly billingInterval: string | null;
    readonly currentPeriodEnd: Date | null;
    readonly metadata: Record<string, unknown> | null;
}

/**
 * Find the add-on purchase a MercadoPago preapproval id belongs to.
 *
 * **This is the routing predicate for the whole PR.** A `true` answer means the
 * event must never reach the plan-subscription handlers: the preapproval
 * belongs to an add-on, and `billing_subscriptions` also carries a row for it
 * (PR 4 writes one, with `product_domain = 'addon'`), so the plan handlers
 * would happily resolve it and run a customer's whole subscription lifecycle —
 * activation, notifications, featured sync, entity-subscription reconcile —
 * against an add-on.
 *
 * Deliberately UNFILTERED by status. A `'canceled'` purchase whose preapproval
 * is somehow still charging is precisely the HOS-751 shape, and handing that
 * charge to the plan handler because the row was not `'active'` is the worst
 * available outcome.
 *
 * `limit(1)` with no ordering, because a preapproval id belongs to at most one
 * purchase row: every checkout attempt creates a NEW preapproval, and
 * `addon.checkout.recurring-idempotency.ts` either hands the SAME one back
 * (writing no new row) or cancels the stale preapproval and closes its row
 * before opening another. No path writes one preapproval id onto two rows.
 *
 * @remarks
 * Nothing at the DATABASE level enforces that — there is no unique index on
 * `mp_subscription_id`. Adding one, or detecting a violation, is left to PR 7's
 * reconciler; it is the only thing that sweeps these rows at all.
 *
 * @param preapprovalId - MercadoPago preapproval id from the webhook.
 * @returns The purchase row, or `null` when the id belongs to no add-on.
 */
export async function findRecurringAddonPurchaseByPreapprovalId(
    preapprovalId: string
): Promise<RecurringAddonPurchaseRow | null> {
    const { getDb, and, eq, isNull } = await import('@repo/db');
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

    const rows = await getDb()
        .select({
            id: billingAddonPurchases.id,
            customerId: billingAddonPurchases.customerId,
            subscriptionId: billingAddonPurchases.subscriptionId,
            addonSlug: billingAddonPurchases.addonSlug,
            status: billingAddonPurchases.status,
            mpSubscriptionId: billingAddonPurchases.mpSubscriptionId,
            billingInterval: billingAddonPurchases.billingInterval,
            currentPeriodEnd: billingAddonPurchases.currentPeriodEnd,
            metadata: billingAddonPurchases.metadata
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.mpSubscriptionId, preapprovalId),
                isNull(billingAddonPurchases.deletedAt)
            )
        )
        .limit(1);

    const row = rows[0] as Partial<RecurringAddonPurchaseRow> | undefined;

    // The row has to LOOK like an add-on purchase for THIS preapproval before
    // this function will claim the event.
    //
    // `addon_slug` is `NOT NULL` on `billing_addon_purchases` and exists on no
    // other table in the billing schema, so requiring it is the cheapest
    // available proof that what came back is an add-on purchase and not, say, a
    // `billing_subscriptions` row. The consequence of getting this wrong runs
    // in the SAFE direction either way: a false negative sends an add-on's
    // event to the plan handler (the bug PR 5 exists to prevent), while a false
    // positive silently swallows a real plan renewal. Both are unacceptable, so
    // this asserts rather than assumes — the same reason
    // `linkPreapprovalToLocalSub` re-`retrieve()`s before it will link.
    if (
        !row ||
        typeof row.addonSlug !== 'string' ||
        row.addonSlug.length === 0 ||
        row.mpSubscriptionId !== preapprovalId
    ) {
        return null;
    }

    return row as RecurringAddonPurchaseRow;
}
