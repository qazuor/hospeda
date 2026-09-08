/**
 * Answers, for a catalog row a BUYER is about to read, whether purchasing it
 * today opens a recurring charge (HOS-847).
 *
 * ## Why the wire needs this at all
 *
 * `apps/web` renders a warning on an add-on card — "it renews on its own and is
 * charged every month" — and until this module existed it decided that from
 * `billingType === 'recurring'` alone. That is a property of the CATALOG, not
 * of the checkout: with the recurring path off, which is how production ships,
 * the very same purchase falls to the one-time branch, is charged once, and its
 * benefit never expires. The warning was then simply false, and there was no
 * way for the client to know — the flag is read only in `apps/api`.
 *
 * So the server answers instead, and it answers with the SAME function the
 * checkout dispatches on ({@link shouldUseRecurringAddonCheckout}), not with
 * the flag. All three of that gate's conditions therefore hold: the flag, the
 * derived `billingType`, and a POSITIVE read of the real
 * `billing_addons.billing_interval`. The third matters here as much as it does
 * there — `resolveBillingType` returns `'recurring'` by exclusion, so a `NULL`,
 * an empty string or an operator's typo all present as recurring, and copy
 * derived from that would go on lying with the flag ON.
 *
 * ## What it costs
 *
 * Nothing today. `shouldUseRecurringAddonCheckout` returns on its first line
 * when the flag is off, so the whole catalog is annotated with zero queries —
 * which is every environment as of this writing. With the flag on it is one
 * primary-key read per add-on that is BOTH recurring-typed and carries an id;
 * the catalog is eight rows.
 *
 * The answers are resolved concurrently rather than in sequence: they are
 * independent single-row reads and the list route awaits them all anyway.
 *
 * @module services/addon-recurring-charging
 */

import type { AddonDefinition } from '@repo/billing';
import { env } from '../utils/env.js';
import { shouldUseRecurringAddonCheckout } from './addon.checkout.recurring-resolve.js';

/** An add-on definition plus the server's verdict on how it will be charged. */
export type AddonWithRecurringCharging = AddonDefinition & {
    /** See `PurchasableAddonResponseSchema.recurringChargingEnabled`. */
    readonly recurringChargingEnabled: boolean;
};

/**
 * Annotate one add-on with whether buying it today opens a recurring charge.
 *
 * @param addon - The catalog entry, as mapped from `billing_addons`.
 * @returns The same definition plus `recurringChargingEnabled`.
 */
export async function annotateRecurringCharging(
    addon: AddonDefinition
): Promise<AddonWithRecurringCharging> {
    const recurringChargingEnabled = await shouldUseRecurringAddonCheckout({
        // Resolved here rather than threaded from the route, for the same
        // reason `createAddonCheckout` resolves it at its own dispatch point:
        // the gate takes a boolean, and the one place that turns the env value
        // into one should be next to the call that consumes it.
        recurringAddonsEnabled: env.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED === true,
        addon
    });

    return { ...addon, recurringChargingEnabled };
}

/**
 * Annotate a whole catalog listing.
 *
 * @param addons - The catalog, already filtered and sorted by the service.
 * @returns The same rows, in the same order, each carrying the verdict.
 */
export async function annotateRecurringChargingAll(
    addons: readonly AddonDefinition[]
): Promise<AddonWithRecurringCharging[]> {
    return await Promise.all(addons.map((addon) => annotateRecurringCharging(addon)));
}
