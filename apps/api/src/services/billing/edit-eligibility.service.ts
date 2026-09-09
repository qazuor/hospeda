/**
 * "May this owner still EDIT their listing's content?" — resolved per product
 * domain (HOS-1275).
 *
 * ## Why this exists at all
 *
 * Until HOS-1275, editing a listing's content was gated on
 * `EDIT_ACCOMMODATION_INFO` / `EDIT_GASTRONOMY_INFO` / `EDIT_EXPERIENCE_INFO`,
 * and **all three are FLOOR keys**: they are granted before any subscription is
 * looked at. Accommodation reaches its floor through
 * `buildHostDraftDefaultsResult()` (`middlewares/entitlement.ts`), which loads
 * `owner-basico` — and `owner-basico` grants `EDIT_ACCOMMODATION_INFO`
 * (`plans.config.ts`). Commerce reaches its floor through
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`
 * (`packages/billing/src/config/commerce-entitlements.config.ts`), which
 * `resolveCommerceVerticalGrants` seeds *before* reading any subscription and
 * only ever adds to. So `requireEntitlement(EDIT_*)` refused nobody, in any
 * vertical. The pay control lived in the CAP (how many listings you may
 * publish), never in the key.
 *
 * The owner's decision on 2026-09-09 was that editing content must require a
 * live subscription, in all three verticals. This module is that predicate.
 *
 * ## THE GATE IS "YOU HAD IT AND LOST IT", NEVER "YOU HAVE IT"
 *
 * **Do not "simplify" this to `if (!subscription) deny`.** That single line is a
 * production incident, and it is the most likely edit anyone will make to this
 * file.
 *
 * Since HOS-1012 the trial is Hospeda's own and is granted **at the first
 * publish**, not at signup. A brand-new HOST therefore has **zero rows** in
 * `billing_subscriptions`: they are auto-promoted, they create a draft
 * (`routes/accommodation/protected/createDraft.ts`, gated on
 * `PUBLISH_ACCOMMODATIONS` which the same `owner-basico` floor grants), they
 * fill it in over days, and the trial only starts when they publish. Commerce
 * has the identical shape — see `resolveCommerceTrialVerdict`'s
 * `'trial_available'` verdict in `services/commerce-trial-start.service.ts`.
 *
 * Denying "no subscription" therefore cuts **every host and every commerce
 * owner between signup and their first publish** — the entry door of the
 * platform's largest vertical. That is why {@link EditEligibility} has three
 * values and not two: an owner with no history in this domain is `'pre_trial'`
 * and PASSES; only an owner who HAS rows here and none of them live is
 * `'lapsed'` and is refused.
 *
 * ## Which liveness predicate this uses, and why (HOS-1275 D-4)
 *
 * The repo has **two** liveness predicates and they are not interchangeable:
 *
 * - {@link isEntitlementGrantingStatus} — status-only (`active` | `trialing` |
 *   `comp` | `courtesy`). Used by the commerce visibility reconciler
 *   (`packages/service-core/src/services/commerce/commerce-visibility.ts`),
 *   i.e. by the thing that decides whether a COMMERCE listing is public.
 * - `isSubscriptionLive` — the same statuses PLUS date arithmetic (6 h cron-lag
 *   grace, soft-cancel until `currentPeriodEnd`). Used by the ACCOMMODATION
 *   publish gate (`services/accommodation-publish-deps.ts`'s
 *   `checkEligibility`).
 *
 * **This module deliberately builds on the status-only one**, widened to
 * {@link isLiveSubscriptionStatus} (which adds `past_due`). Three reasons:
 *
 * 1. Editing is not publishing. The date-aware predicate exists to stop a
 *    lapsed listing from staying PUBLIC; cutting someone's ability to FIX their
 *    listing during a 6-hour webhook lag punishes them for our cron timing.
 *    Failing open on cron lag is the safe direction here and the unsafe one
 *    there.
 * 2. `isSubscriptionLive` returns `false` for `past_due`, which would cut a
 *    delinquent owner inside their 7-day dunning grace — see the next section.
 * 3. Soft-cancel needs nothing extra either way: a subscription cancelled but
 *    paid through keeps `status = 'active'` until `finalize-cancelled-subs`
 *    flips it, so the status-only read already covers it.
 *
 * That the two predicates disagree is a real open divergence, NOT resolved by
 * this issue: reconciling them touches the accommodation publish gate, which is
 * out of scope here. It is named rather than silently forked so the next reader
 * picks one of the two that exist instead of writing a third.
 *
 * ## `past_due` and `pending_provider` PASS — deliberately, and neither is obvious
 *
 * - **`past_due`** is in {@link LIVE_SUBSCRIPTION_STATUSES} but NOT in
 *   `ENTITLEMENT_GRANTING_STATUSES`, so it looks at first glance like it should
 *   be refused here. It must not be: `pastDueGraceMiddleware`
 *   (`middlewares/past-due-grace.middleware.ts`, mounted on
 *   `/api/v1/protected/*` and scoped per domain since HOS-1277) already owns
 *   that decision and answers **402 `GRACE_PERIOD_EXPIRED`** once the 7-day
 *   window elapses. Re-deciding it here would be the same judgment made twice,
 *   in two places, free to disagree.
 * - **`pending_provider`** is an in-flight checkout: the owner is paying *right
 *   now*. It grants no entitlements, so it too reads like a refusal — but
 *   cutting someone mid-payment produces the worst possible support case
 *   ("I paid and it won't let me"). It is listed explicitly in
 *   {@link EDIT_ELIGIBLE_EXTRA_STATUSES} rather than folded into the shared
 *   billing constant, because "occupies a slot / is mid-checkout" is this
 *   gate's concern, not a general liveness fact — `start-subscription.ts` reads
 *   the shared set precisely to REFUSE a second checkout while one is pending,
 *   so widening the shared set would break it.
 *
 * ## Hydration is mandatory (HOS-934 / HOS-1176)
 *
 * `billing.subscriptions.getByCustomerId()` never populates `productDomain`.
 * Compared un-hydrated, `subscriptionMatchesDomain` reads `undefined`, fails
 * OPEN for accommodation and CLOSED for every other domain.
 *
 * **In THIS function that fails open, not closed, which is the more dangerous
 * of the two** — measured, not reasoned: dropping the hydration call turns 27
 * of this module's tests red. Every gastronomy/experience row stops matching,
 * so `domainSubscriptions` empties, so the verdict is `'pre_trial'` — the
 * branch that PASSES. The gate would silently refuse nobody in two of the
 * three verticals, with no thrown error and no log line, which reads exactly
 * like a gate that is working. (Elsewhere in the codebase the same omission
 * fails CLOSED and turns listings dark, which at least announces itself.)
 * `scripts/check-subscription-domain-hydration.sh` fails CI on a file that
 * compares without hydrating.
 *
 * @module services/billing/edit-eligibility.service
 */

import { isLiveSubscriptionStatus } from '@repo/billing';
import type { ProductDomainValue } from '@repo/schemas';
import { hydrateSubscriptionProductDomains, subscriptionMatchesDomain } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * Statuses that are eligible to EDIT but are not in the shared
 * {@link LIVE_SUBSCRIPTION_STATUSES} set.
 *
 * Exactly one entry, and it is deliberately local rather than pushed into
 * `@repo/billing`: `pending_provider` means "a checkout is in flight", which is
 * a reason to LET SOMEONE EDIT and simultaneously a reason to REFUSE them a
 * second checkout (`routes/commerce/protected/start-subscription.ts` reads the
 * shared set for exactly that refusal). The two consumers want opposite
 * answers, so the union lives at the consumer that needs it.
 */
const EDIT_ELIGIBLE_EXTRA_STATUSES: ReadonlySet<string> = new Set(['pending_provider']);

/**
 * The three states an owner can be in with respect to editing one vertical.
 *
 * Three, not a boolean, for the reason spelled out at length in the module
 * docblock: `'pre_trial'` and `'live'` both mean "let them edit", but
 * collapsing them loses the only distinction that matters — whether refusing
 * would be correct enforcement or a lockout of every new signup.
 */
export type EditEligibility =
    /** A subscription in this domain is live (or mid-checkout). Editing allowed. */
    | 'live'
    /**
     * This owner has NO subscription history in this domain at all. They are
     * before their first publish, which is when the trial is granted. Editing
     * allowed — see the module docblock.
     */
    | 'pre_trial'
    /**
     * This owner HAS subscription rows in this domain and none of them is live.
     * They subscribed and lapsed. Editing refused.
     */
    | 'lapsed';

/**
 * Resolves whether an owner may still edit content in one product domain.
 *
 * Fails OPEN (`'live'`) on every condition it cannot evaluate — billing
 * disabled, no billing customer, a provider read that throws. A billing outage
 * must never lock owners out of their own content; the gate is enforcement, not
 * a fail-safe, and `requireEntitlement`'s own 503 branch already covers the
 * "billing load failed" case for the entitlement half of the chain.
 *
 * @param input.customerId - The owner's billing customer id, when they have one.
 * @param input.domain - The product domain the edited listing belongs to.
 * @returns The eligibility verdict. See {@link EditEligibility}.
 *
 * @example
 * ```ts
 * const verdict = await resolveEditEligibility({
 *   customerId: c.get('billingCustomerId'),
 *   domain: ProductDomainEnum.GASTRONOMY
 * });
 * if (verdict === 'lapsed') {
 *   // 402 NO_ACTIVE_SUBSCRIPTION
 * }
 * ```
 */
export async function resolveEditEligibility(input: {
    customerId: string | null | undefined;
    domain: ProductDomainValue;
}): Promise<EditEligibility> {
    const { customerId, domain } = input;

    if (!customerId) {
        // No billing customer row. The row is created eagerly at signup
        // (`lib/auth.ts`) and again in `host-onboarding/start`, so its absence
        // is an infrastructure edge rather than a lapsed subscriber — and it is
        // indistinguishable from "billing is off". Fail open.
        return 'live';
    }

    const billing = getQZPayBilling();
    if (!billing) {
        return 'live';
    }

    try {
        const rawSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        // HOS-934 / HOS-1176: hydrate BEFORE any domain comparison. Without
        // this every subscription reaches `subscriptionMatchesDomain` with
        // `productDomain: undefined`, which fails closed for gastronomy and
        // experience — silently resolving `'lapsed'` for every commerce owner.
        const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions ?? []);
        const domainSubscriptions = subscriptions.filter((sub) =>
            subscriptionMatchesDomain(sub, domain)
        );

        if (domainSubscriptions.length === 0) {
            // No history in this domain — the draft phase. See the module
            // docblock: this is the branch that must never become a denial.
            return 'pre_trial';
        }

        const hasLive = domainSubscriptions.some((sub: { status: string }) => {
            const status = sub.status as string;
            return isLiveSubscriptionStatus(status) || EDIT_ELIGIBLE_EXTRA_STATUSES.has(status);
        });

        return hasLive ? 'live' : 'lapsed';
    } catch (error) {
        apiLogger.warn(
            {
                customerId,
                domain,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-1275: could not resolve edit eligibility — allowing the edit'
        );
        return 'live';
    }
}
