/**
 * The SQL predicate for "this subscription row has NO MercadoPago preapproval
 * behind it" (HOS-1326 follow-up).
 *
 * ---
 * WHY THIS IS NOT `isNull(mpSubscriptionId)`
 *
 * Because the column does not hold `NULL` on the path that matters. It holds the
 * EMPTY STRING, and it gets there without anyone deciding it should:
 *
 * 1. MercadoPago answers 2xx for a preapproval and omits `id` — the HOS-151
 *    Bug C scenario, which is the only scenario that reaches the callers of this
 *    predicate;
 * 2. `@qazuor/qzpay-mercadopago`'s preapproval mapper writes `id: preapproval.id ?? ''`,
 *    so "absent" becomes `''` rather than `undefined`;
 * 3. `@qazuor/qzpay-drizzle`'s update mapper writes any non-`undefined` provider
 *    id straight through, so `''` lands in `mp_subscription_id` verbatim;
 * 4. the same package's row→domain mapper hides it again behind a truthiness
 *    check, so `providerSubscriptionIds` comes back `{}` and the caller's
 *    "did we get an id?" guard fires correctly.
 *
 * Step 4 is what makes step 3 easy to miss: every JS-side read agrees the row has
 * no preapproval, while the COLUMN says `''`. A WHERE that asks `IS NULL` matches
 * zero rows, the terminal write silently no-ops, and the row is left `incomplete`
 * forever — a strictly worse outcome than the mislabelled-but-terminal `canceled`
 * it replaced, because nothing ever revisits it.
 *
 * Matching both spellings here rather than normalising `''` → `NULL` at the write
 * is deliberate: the write happens inside qzpay, so normalising means either
 * patching a dependency or adding a second write on the hot checkout path.
 *
 * `extras/031-billing-subscriptions-mp-id-unique.index.sql` bounds the blast
 * radius — its `UNIQUE (mp_subscription_id) WHERE NOT NULL` lets only ONE row per
 * environment sit on `''` — which is why this was a stuck row rather than a
 * spreading one. It is not a reason to leave it stuck.
 *
 * @module services/billing/unlinked-preapproval-condition
 */

import { billingSubscriptions, eq, isNull, or } from '@repo/db';

/**
 * Drizzle condition matching a `billing_subscriptions` row that carries no
 * usable MercadoPago preapproval id — `NULL` **or** the empty string.
 *
 * Use it as the "nothing was ever linked" half of any WHERE that writes a
 * terminal status onto a never-confirmed checkout. Both HOS-1326 writers do:
 * the `abandoned-pending-subs` reaper's mp-null branch and the
 * unlinkable-preapproval cleanup in `paid-subscription-create`.
 *
 * @returns The `OR` condition, ready to drop into an `and(...)`.
 *
 * @example
 * ```ts
 * .where(and(
 *     eq(billingSubscriptions.id, subscriptionId),
 *     inArray(billingSubscriptions.status, [...PENDING_PROVIDER_STORED_STATUSES]),
 *     hasNoLinkedPreapprovalCondition(),
 *     isNull(billingSubscriptions.deletedAt)
 * ))
 * ```
 */
export function hasNoLinkedPreapprovalCondition() {
    return or(
        isNull(billingSubscriptions.mpSubscriptionId),
        eq(billingSubscriptions.mpSubscriptionId, '')
    );
}
