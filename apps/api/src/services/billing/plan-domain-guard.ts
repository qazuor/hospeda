/**
 * The boundary that stops a plan from one vertical steering another's
 * remediation (HOS-1122).
 *
 * ---
 * WHAT WENT WRONG WITHOUT IT
 *
 * `applyDowngradeRestrictions` and `applyUpgradeRestorations` restrict and
 * restore an owner's ACCOMMODATIONS, PROMOTIONS and accommodation PHOTOS against
 * the caps of whatever plan they are handed. They take a bare slug and a bare
 * plan id respectively, and until HOS-1119 nothing in the codebase could hand
 * either of them a plan from another domain — commerce had no plan-change route
 * at all, so the omission cost nothing.
 *
 * HOS-1119 built that route, and gated ONE of the four call sites that can now
 * reach the restore direction (the MercadoPago webhook, via
 * `isAccommodationDomainSubscription`). The other three stayed open. The one
 * that matters most is `applyTrialingPlanUpgrade`, which the commerce route
 * calls directly for a trialing owner: a gastronomy básico → pro upgrade
 * reached `applyUpgradeRestorations` with a gastronomy plan id, whose slug is
 * absent from `ALL_PLANS`, whose caps therefore resolved to
 * `{-1, -1, -1}` — *unlimited* — and every plan-restricted accommodation and
 * promotion that owner had was un-restricted. Silently: unlimited is the
 * successful answer, so there is no error, no Sentry event and no log line to
 * find it by.
 *
 * ---
 * WHY A THROW AND NOT A SKIP
 *
 * Returning an empty summary would make a cross-domain call indistinguishable
 * from "this owner had nothing to restrict", which is the overwhelmingly common
 * real outcome. A typed throw is a fact the caller has to answer for: the
 * commerce paths dispatch on the domain BEFORE calling, so reaching this guard
 * means a call site was wired wrong, and `applyDowngradeRestrictionsOrWarn` /
 * `applyUpgradeRestorationsOrWarn` turn it into a logged error (and thus a
 * Sentry event) rather than a rollback.
 *
 * @module services/billing/plan-domain-guard
 */

import { productDomainForPlanSlug } from '@repo/billing';
import { ProductDomainEnum, type ProductDomainValue, ServiceErrorCode } from '@repo/schemas';
import {
    hydrateSubscriptionProductDomains,
    ServiceError,
    subscriptionMatchesDomain
} from '@repo/service-core';
import { apiLogger } from '../../utils/logger';

/**
 * Thrown when a remediation service is handed a plan that does not belong to
 * the domain it operates on.
 *
 * Carries the offending slug and the domain it resolved to (`null` when the
 * slug is in no catalogue at all) so the log line names the actual mismatch
 * instead of just reporting a failure.
 */
export class PlanDomainMismatchError extends Error {
    /** The slug that was rejected. */
    readonly planSlug: string;
    /** The domain the slug resolved to, or `null` when it resolved to none. */
    readonly resolvedDomain: ProductDomainValue | null;
    /** The domain the caller required. */
    readonly expectedDomain: ProductDomainValue;

    constructor(input: {
        planSlug: string;
        resolvedDomain: ProductDomainValue | null;
        expectedDomain: ProductDomainValue;
        context: string;
    }) {
        super(
            `${input.context}: plan '${input.planSlug}' belongs to product domain '${
                input.resolvedDomain ?? 'unknown'
            }', not '${input.expectedDomain}' — refusing to apply ${
                input.expectedDomain
            } plan limits to it`
        );
        this.name = 'PlanDomainMismatchError';
        this.planSlug = input.planSlug;
        this.resolvedDomain = input.resolvedDomain;
        this.expectedDomain = input.expectedDomain;
    }
}

/**
 * Asserts that `planSlug` names an ACCOMMODATION-domain plan.
 *
 * Fails closed on an unknown slug — see {@link isAccommodationPlanSlug} in
 * `@repo/billing` for why an unrecognised plan slug is not treated the way an
 * unrecognised subscription `product_domain` is.
 *
 * @param planSlug - The catalogue slug (`billing_plans.name`) to check.
 * @param context - Caller label folded into the error message.
 * @throws {PlanDomainMismatchError} When the slug is not a known accommodation plan.
 *
 * @example
 * ```ts
 * assertAccommodationPlanSlug('owner-basico', 'plan-downgrade-remediation'); // ok
 * assertAccommodationPlanSlug('gastronomy-pro', 'plan-downgrade-remediation'); // throws
 * ```
 */
export function assertAccommodationPlanSlug(planSlug: string, context: string): void {
    const resolved = productDomainForPlanSlug(planSlug);
    if (resolved === ProductDomainEnum.ACCOMMODATION) {
        return;
    }
    throw new PlanDomainMismatchError({
        planSlug,
        resolvedDomain: resolved ?? null,
        expectedDomain: ProductDomainEnum.ACCOMMODATION,
        context
    });
}

/**
 * Whether a just-changed subscription belongs to the ACCOMMODATION domain
 * (HOS-1119).
 *
 * ## Why the upgrade path suddenly needs to ask
 *
 * `applyUpgradeRestorationsOrWarn` restores the host's plan-restricted
 * ACCOMMODATIONS and PROMOTIONS against the caps of the plan it is handed. Until
 * commerce had a plan-change route, nothing could hand it a commerce plan id.
 * Now something can — and a commerce tier declares NEITHER of those caps
 * (`commerceVerticalTier` gives each tier only its own vertical's listing
 * limit), so the restoration would be reasoning about an owner's accommodations
 * from a gastronomy plan. The restore direction is the permissive one and every
 * layer beneath resolves an unknown limit key as *unlimited*, so the symptom is
 * not an error: it is rows quietly un-restricted, with no log to find it by.
 *
 * ## It fails OPEN toward accommodation, twice over, and deliberately
 *
 * `subscriptionMatchesDomain` already reads a missing or `null` `productDomain`
 * as accommodation (SPEC-239 — the column post-dates most rows). This function
 * extends the same posture to a FAILED READ: qzpay never populates
 * `productDomain` on a returned subscription, so the value has to be hydrated
 * from the database, and a transient failure there degrades to the un-hydrated
 * subscription rather than to a refusal.
 *
 * That lands on exactly the behaviour this call site had before HOS-1119.
 * Throwing instead would skip the restoration for a genuine host upgrade over a
 * database blip — trading a hazard that only exists for commerce for a
 * regression that hits everyone.
 *
 * @param subscription - The subscription as `changePlan` returned it.
 * @returns `true` when the accommodation-only follow-up steps should run.
 *
 * Exported for its own unit test: it is the whole of HOS-1119's webhook-side
 * change, and the `confirmPlanUpgrade` suite reaches it only through a shared
 * `@repo/db` mock whose sequential `select` chain cannot serve the hydration
 * query — so through that door the branch would be exercised only by way of its
 * own catch, which is a green test proving nothing.
 *
 * Lives here since HOS-1122. It was defined in
 * `routes/webhooks/mercadopago/payment-logic.ts`, which was fine while the
 * webhook was the only caller; `trialing-plan-upgrade.service.ts` is the second,
 * and a service importing from a route module is the wrong direction for a
 * dependency to run.
 */
export async function isAccommodationDomainSubscription(subscription: {
    id: string;
    customerId?: string;
    productDomain?: string | null;
}): Promise<boolean> {
    let resolved: { productDomain?: string | null } = subscription;
    try {
        const [hydrated] = await hydrateSubscriptionProductDomains([subscription]);
        if (hydrated !== undefined) {
            resolved = hydrated;
        }
    } catch (error) {
        apiLogger.warn(
            {
                subscriptionId: subscription.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'Product-domain hydration failed — treating the subscription as accommodation'
        );
    }
    return subscriptionMatchesDomain(resolved, 'accommodation');
}

/**
 * Picks the ACCOMMODATION-domain subscription out of a customer's subscriptions
 * (HOS-1213).
 *
 * ## Why picking the first one was wrong
 *
 * `POST /protected/billing/subscriptions/change-plan` took the first
 * `active | trialing` subscription `getByCustomerId` returned, in whatever order
 * the storage adapter produced. That was correct only while a customer could
 * hold ONE subscription. Since the per-vertical split (HOS-688) one billing
 * customer legitimately holds up to three at once — accommodation, gastronomy,
 * experience — and this route governs the accommodation one alone: commerce
 * tiers change through `POST /protected/commerce/{vertical}/change-plan`
 * (HOS-1119), which dispatches on the vertical it is called for.
 *
 * So the unqualified `find` could mutate a subscription the caller never named,
 * and did so silently: every guard downstream reasons about the subscription it
 * was handed, so a plan change applied to the wrong vertical looks exactly like
 * one applied to the right one.
 *
 * ## It fails OPEN toward accommodation, for the same reason its neighbour does
 *
 * Selection runs over hydrated rows, and `subscriptionMatchesDomain` reads a
 * missing or `null` `productDomain` as accommodation because the column
 * post-dates most rows (SPEC-239). A failed hydration degrades to the
 * un-hydrated input rather than to a refusal, which lands on exactly the
 * behaviour this call site had before — a host with one subscription keeps
 * changing plans through a database blip. What it no longer does is reach for a
 * commerce subscription when the accommodation one is absent: those rows carry
 * a real domain string, so they are excluded on their own value, not on a
 * default.
 *
 * ## It selects accommodation OR tourist, and keeps the narrower name (HOS-1233)
 *
 * The name is now narrower than the behaviour, deliberately. Tourist plans were
 * filed as `accommodation` until this spec, so they were always in scope here;
 * reclassifying them changed which predicate reaches them, not which route
 * changes them. What the name still says correctly is the thing worth saying:
 * this is NOT the commerce selector, and a gastronomy or experience
 * subscription must never come back from it.
 *
 * Renaming was weighed and refused: the symbol is exported, and a guard or a
 * doc anchored on it dies silently on a rename while the PR that does the
 * renaming never sees it fail. If a second consumer ever needs the same pair,
 * that is the moment to name the concept — not this one (HOS-1081 deleted
 * `isCommerceSubscription()` for having exactly one hypothetical caller).
 *
 * @param subscriptions - Candidate subscriptions, already narrowed to the
 *   statuses the caller considers changeable.
 * @returns The customer's accommodation-domain subscription, or their
 *   tourist-domain one when they hold no accommodation subscription, or
 *   `undefined` when they hold neither — which the caller must answer the same
 *   way it answers "no subscription at all", because for this route that is
 *   what it means.
 */
export async function selectAccommodationSubscription<
    T extends { id: string; productDomain?: string | null }
>(subscriptions: readonly T[]): Promise<T | undefined> {
    if (subscriptions.length === 0) {
        return undefined;
    }

    let resolved: readonly (T & { productDomain?: string | null })[] = subscriptions;
    try {
        resolved = await hydrateSubscriptionProductDomains(subscriptions);
    } catch (error) {
        apiLogger.warn(
            {
                subscriptionIds: subscriptions.map((sub) => sub.id),
                error: error instanceof Error ? error.message : String(error)
            },
            'Product-domain hydration failed — selecting the accommodation subscription un-hydrated'
        );
    }

    // HOS-1233: accommodation OR tourist. Both are the customer's own consumer
    // plan and both change through THIS route — `ALL_PLANS` holds the owner
    // tiers and the tourist tiers together, and there is no second plan-change
    // route for tourists the way commerce has one per vertical.
    //
    // Until this spec a `tourist-vip` row satisfied the accommodation match by
    // accident, because tourist plans were filed as `accommodation` (F-4b).
    // Reclassified, this returns `undefined` and `plan-change.ts` answers HTTP
    // 404 `No active subscription found`: a paying tourist VIP cannot change
    // their plan, and the 404 is indistinguishable from the one a customer with
    // no subscription at all gets (F-4g #2).
    //
    // Accommodation is tried FIRST, not matched indiscriminately. A host
    // auto-promoted by host-onboarding can hold both, and this route governs
    // the owner plan — an unordered match would let the storage adapter's
    // ordering decide which subscription gets mutated, which is the HOS-1213
    // bug this function was written to close, wearing a new domain.
    return (
        resolved.find((sub) => subscriptionMatchesDomain(sub, ProductDomainEnum.ACCOMMODATION)) ??
        resolved.find((sub) => subscriptionMatchesDomain(sub, ProductDomainEnum.TOURIST))
    );
}

/**
 * Asserts that a plan-change request does not name a plan from ANOTHER product
 * domain (HOS-1213).
 *
 * ## What this does and does not defend
 *
 * It is NOT what closes HOS-1213, and reading it as such would leave the real
 * hole open. That bug offered `tourist-free` and `tourist-vip` against a
 * gastronomy subscription — and both of those are ACCOMMODATION-domain plans, so
 * no assertion about the target could have refused them. What closes it is
 * {@link selectAccommodationSubscription}: the route no longer reaches a
 * commerce subscription at all, so a gastronomy owner asking for a tourist plan
 * now gets "no active subscription found" instead of a scheduled downgrade of
 * the subscription they pay for.
 *
 * This assertion covers the opposite direction, which was equally unguarded: an
 * accommodation subscription being moved onto `gastronomy-pro` or a partner
 * tier. Nothing compared the two domains, so any active plan in the catalogue
 * was accepted, and the downgrade remediation would then reason about a host's
 * accommodations from a commerce plan whose caps declare nothing about them —
 * the same shape of failure HOS-1122 documents at the top of this module.
 *
 * ## Fails OPEN on an unknown slug, and that is not the fail-closed posture
 * `isAccommodationPlanSlug` was written for
 *
 * That helper answers `false` for any slug outside the static catalogues, which
 * is right where it is used: the remediation services resolve an unrecognised
 * plan's caps as *unlimited*, so a slug they cannot place must be refused. Here
 * the cost of refusing runs the other way. HOS-1062 made the catalogue open —
 * one plan row per negotiated agreement, created in admin and present in no
 * `ALL_PLANS` — so treating "not in the static catalogue" as "not accommodation"
 * would reject every plan change onto a negotiated plan, which is a live
 * feature, in order to guard against a plan whose domain we cannot even name.
 *
 * So the refusal is narrow and positive: only a slug that resolves to a domain,
 * and to a domain other than accommodation, is rejected.
 *
 * @param planSlug - The target plan's catalogue slug (`billing_plans.name`).
 * @throws {ServiceError} `VALIDATION_ERROR` when the slug resolves to a
 *   non-accommodation domain. Not a 404: the plan exists, it just is not one an
 *   accommodation subscription can move to.
 */
export function assertAccommodationPlanChangeTarget(planSlug: string): void {
    const resolved = productDomainForPlanSlug(planSlug);
    if (resolved === undefined || resolved === ProductDomainEnum.ACCOMMODATION) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        `Plan '${planSlug}' belongs to product domain '${resolved}' and cannot be applied to an accommodation subscription.`,
        undefined,
        'PLAN_DOMAIN_MISMATCH'
    );
}
