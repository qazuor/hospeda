/**
 * Subscription-status predicates — and WHICH QUESTION EACH ONE ANSWERS.
 *
 * Three exported predicates in this directory contain the word "live" or
 * "granting" and all three take a subscription status. They are **not**
 * interchangeable, and the names alone do not tell them apart — picking by name
 * is how HOS-1310 was filed. Pick by the question in the left column.
 *
 * | Question being asked | Predicate | Accepts |
 * | -- | -- | -- |
 * | Does this subscription grant its plan's capabilities **right now**, ignoring dates? | {@link isEntitlementGrantingStatus} | `active`, `trialing`, `comp`, `courtesy` |
 * | Is this still an **unfinished relationship with the payment provider** — must not be duplicated, owner has not walked away? | {@link isLiveSubscriptionStatus} | the four above **+ `past_due`** |
 * | Does this grant access **given the clock** — cron-lag grace, soft-cancel grace? | {@link isSubscriptionLive} | `comp` always; `active`/`trialing`/`courtesy` within 6 h of their end; `cancelled` until `currentPeriodEnd`; nothing else |
 *
 * Two of the differences are DESIGN and must not be "unified":
 *
 * - **`past_due` is in the second and in neither other.** A past-due preapproval
 *   is mid-dunning at MercadoPago, so it is a live thing (do not open a second
 *   checkout over it) that grants nothing (dunning exists for a reason). The
 *   7-day grace on it belongs to `pastDueGraceMiddleware`, not to any predicate
 *   here — see {@link LIVE_SUBSCRIPTION_STATUSES}.
 * - **`cancelled` is in the third and in neither other.** Only a date can tell a
 *   row the owner already paid through from one that has run out, so only the
 *   date-aware predicate can answer it. No set of strings can.
 *
 * One difference is an OPEN QUESTION, tracked as **HOS-1310** and deliberately
 * not decided here: the first and third answer *the same question* — "does this
 * grant access?" — and disagree whenever a date has elapsed. An `active` row
 * 7 h past `currentPeriodEnd` grants entitlements through the first and is
 * refused by the third. Today that split runs along a vertical boundary
 * (commerce visibility reconciles through the first, the accommodation publish
 * gate through the third), which is what makes it an epic-level asymmetry rather
 * than a local inconsistency. Closing it is a product decision about whether
 * cron lag may extend access, not a refactor.
 *
 * All three normalize their input through
 * {@link normalizeStoredSubscriptionStatus} first, because the column they read
 * holds two vocabularies. A fourth predicate added to this directory must do the
 * same, and must BIND the result rather than merely calling it:
 * `packages/billing/test/liveness-predicate-call-site.guard.test.ts` fails CI
 * otherwise — on the source AND on the answers the predicate gives for every
 * qzpay alias. (That path was wrong here until HOS-1310's review caught it: it
 * named a file that has never existed, so anyone grepping it would have
 * concluded there was no guard at all.)
 *
 * @module predicates
 */

export {
    ENTITLEMENT_GRANTING_STATUSES,
    isEntitlementGrantingStatus
} from './is-entitlement-granting-status.js';
export {
    isLiveSubscriptionStatus,
    LIVE_SUBSCRIPTION_STATUSES
} from './is-live-subscription-status.js';
export type { IsSubscriptionLiveInput } from './is-subscription-live.js';
export { isSubscriptionLive } from './is-subscription-live.js';
export {
    normalizeStoredSubscriptionStatus,
    PENDING_PROVIDER_STORED_STATUSES,
    QZPAY_STORED_STATUS_ALIASES
} from './subscription-status-normalize.js';
