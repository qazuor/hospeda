/**
 * Shared SQL predicates over `billing_subscriptions` that more than one package
 * has to agree on (HOS-1326).
 *
 * ---
 * WHY "HAS A PREAPPROVAL" IS NOT `IS NOT NULL`
 *
 * `billing_subscriptions.mp_subscription_id` can hold the EMPTY STRING, and it
 * gets there without anyone deciding it should:
 *
 * 1. MercadoPago answers 2xx for a preapproval and omits `id` — the HOS-151
 *    Bug C scenario;
 * 2. `@qazuor/qzpay-mercadopago` (2.11.2) maps that to `id: preapproval.id ?? ''`,
 *    so "absent" becomes `''` rather than `undefined`;
 * 3. `@qazuor/qzpay-drizzle` (4.0.0) writes any non-`undefined` provider id
 *    straight through, so `''` lands in the column verbatim;
 * 4. the same package's row→domain mapper hides it again behind a truthiness
 *    check, so `providerSubscriptionIds` comes back `{}`.
 *
 * Step 4 is what makes step 3 easy to miss: every JS-side read agrees the row has
 * no preapproval while the COLUMN says `''`. A predicate that asks `IS NULL`
 * matches zero rows for exactly the checkout that needs closing — which is how
 * HOS-1326's first fix left a subscription non-terminal forever, a strictly worse
 * outcome than the mislabelled-but-terminal row it replaced.
 *
 * ---
 * WHY BOTH DIRECTIONS LIVE HERE, IN `@repo/db`
 *
 * Three callers in two packages ask this question and must answer it identically
 * or they are describing different universes: the `abandoned-pending-subs` reaper
 * and the unlinkable-checkout cleanup (`apps/api`) ask "is there NO preapproval?",
 * and data-migration `0106` (`packages/seed`) asks the exact opposite. Defining
 * the complement here rather than negating at one call site is what stops the
 * pair from drifting — a hand-rolled `IS NOT NULL` on the migration side would
 * re-introduce the same `''` blind spot in the one place where getting it wrong
 * rewrites live billing rows.
 *
 * `@repo/db` is the only package both consumers already depend on, and this is a
 * condition over a `@repo/db` table, so it is also where it belongs.
 *
 * @module utils/billing-subscription-conditions
 */

import { and, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { billingSubscriptions } from '../billing/index.ts';

/**
 * Matches a subscription row carrying NO usable MercadoPago preapproval id —
 * `NULL` **or** the empty string.
 *
 * Use it as the "nothing was ever linked" half of any WHERE that writes a
 * terminal status onto a never-confirmed checkout.
 *
 * @returns The `OR` condition, ready to drop into an `and(...)`.
 *
 * @example
 * ```ts
 * .where(and(
 *     eq(billingSubscriptions.id, subscriptionId),
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

/**
 * Matches a subscription row that DOES carry a usable MercadoPago preapproval id
 * — neither `NULL` nor the empty string.
 *
 * The exact complement of {@link hasNoLinkedPreapprovalCondition}, written as one
 * predicate rather than left to each caller to negate: the obvious hand-rolled
 * version (`IS NOT NULL` alone) is wrong in precisely the way this module exists
 * to document.
 *
 * @returns The `AND` condition, ready to drop into another `and(...)`.
 */
export function hasLinkedPreapprovalCondition() {
    return and(
        isNotNull(billingSubscriptions.mpSubscriptionId),
        ne(billingSubscriptions.mpSubscriptionId, '')
    );
}
