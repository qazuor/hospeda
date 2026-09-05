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
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { hydrateSubscriptionProductDomains, subscriptionMatchesDomain } from '@repo/service-core';
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
