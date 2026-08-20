/**
 * Commerce per-vertical entitlement middleware (HOS-688 §6.8).
 *
 * ---
 * WHY A SECOND LOADER INSTEAD OF A FLAG ON `entitlementMiddleware`
 *
 * `entitlementMiddleware()` is mounted GLOBALLY (`utils/create-app.ts`) and
 * resolves the ACCOMMODATION domain: `loadEntitlements` filters subscriptions
 * through `isAccommodationSubscription`, so on a commerce route `userLimits`
 * carries the accommodation plan's keys — which never include
 * `max_gastronomies`. SPEC-239 built that isolation deliberately, and §6.8 says
 * to **parameterise the predicate by domain rather than remove it**: a commerce
 * route loads the commerce subscription's limits into the same context keys, an
 * accommodation route keeps loading accommodation's, and the two sets are never
 * merged. Running this middleware per-route AFTER the global one is exactly
 * that — it REPLACES both context keys for the remainder of the request rather
 * than adding to them, so the isolation is preserved by construction and the
 * domain becomes explicit at the call site.
 *
 * ## THE ONE INVARIANT THIS FILE EXISTS TO HOLD
 *
 * **`userLimits` always carries the vertical's key, on every code path, with no
 * exceptions.** Not "usually", not "when billing is up".
 *
 * The cap is the entire commercial substance of §6.8, and five independent
 * layers resolve "I don't know" as *unlimited* without raising anything:
 * `getRemainingLimit` returns `-1` for an absent key ("treat as unlimited");
 * several `entitlementMiddleware` paths set an EMPTY limits Map, which is
 * unlimited for every key at once; the enforcement middleware calls `next()` on
 * a count failure; and the precheck fails open by design. The symptom of a
 * mis-wired cap is therefore not an error — it is silently giving the product
 * away, and you find out by counting rows months later.
 *
 * So every branch below ends at a NUMBER. When billing is unreachable, when the
 * customer has no subscription, when the plan is missing the key — the answer is
 * the vertical's base cap read from the database, never an absent key and never
 * `-1`. The only thing an outage can cost an owner here is the extra listing
 * they bought as an add-on, and even that is preferable to handing out an
 * uncapped catalogue.
 *
 * ## What it deliberately does NOT copy from the accommodation stack
 *
 * Accommodation's create route stacks `requireEntitlement(PUBLISH_ACCOMMODATIONS)`
 * and *then* `enforceAccommodationLimit()`, in that order and for a stated
 * reason (SPEC-145 T-004). §6.8 states that **neither commerce vertical grants
 * any entitlement today** — visibility is driven by the subscription status via
 * `commerce_listing_subscriptions` + the reconciler, not by the entitlement
 * engine — so there is nothing to put in the first half of that pattern. The
 * commerce create route runs the limit check with no entitlement gate ahead of
 * it, and that is a stated decision rather than an omission.
 *
 * @module middlewares/commerce-entitlement
 */

import {
    type CommerceVertical,
    type EntitlementKey,
    getUnlimitedEntitlements,
    isEntitlementGrantingStatus,
    isLimitKey,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type LimitKey
} from '@repo/billing';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { subscriptionMatchesDomain } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import {
    CommercePlanNotConfiguredError,
    resolveCommercePlanSlug
} from '../services/commerce-plan-resolver';
import { PlanService } from '../services/plan.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { isStaffBypassRole } from '../utils/staff-roles';
import { getQZPayBilling } from './billing';

/**
 * Last-resort cap used when the vertical's plan cannot be read from the
 * database at all (not seeded, DB down).
 *
 * One listing, matching every tier in the shipped catalogue. It exists so the
 * "I don't know" branch still produces a NUMBER — see the invariant in the
 * module docblock. It is NOT the source of truth for the cap: the database is,
 * and {@link loadVerticalBaseLimit} reads it on every cache miss.
 */
const FALLBACK_VERTICAL_CAP = 1;

/** TTL of the per-vertical base-cap memo. Matches the entitlement cache TTL. */
const BASE_LIMIT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Shared PlanService — no mutable state, safe across requests. */
const planService = new PlanService();

/** Memoised base cap per vertical, with its population timestamp. */
const baseLimitCache = new Map<CommerceVertical, { value: number; cachedAt: number }>();

/**
 * The product domain of a commerce vertical.
 *
 * A direct identity — `ProductDomainEnum.GASTRONOMY === 'gastronomy'` — rather
 * than a lookup, because the two vocabularies spell the verticals with the same
 * strings on purpose (see `ProductDomainEnum`'s doc).
 *
 * @param vertical - The commerce vertical.
 * @returns Its `billing_subscriptions.product_domain` value.
 */
function domainOf(vertical: CommerceVertical): ProductDomainValue {
    return vertical === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE;
}

/**
 * Reads the vertical's base listing cap off its plan in `billing_plans`.
 *
 * The plan slug comes from {@link resolveCommercePlanSlug} — the single place a
 * vertical is turned into a plan slug (AC-35). The VALUE comes from the
 * database rather than from `plans.config.ts`, because the cap is a
 * `'commercial'` field: an operator raising it through the admin UI must take
 * effect without a deploy.
 *
 * Memoised for {@link BASE_LIMIT_CACHE_TTL_MS} so this stays off the hot path,
 * mirroring `buildHostDraftDefaultsResult`'s owner-basico memo. A miss is NOT
 * memoised, so a plan seeded after boot is picked up without a restart.
 *
 * @param vertical - The commerce vertical whose cap is wanted.
 * @returns The cap, falling back to {@link FALLBACK_VERTICAL_CAP} when the plan
 *   cannot be read or does not declare the key.
 */
async function loadVerticalBaseLimit(vertical: CommerceVertical): Promise<number> {
    const now = Date.now();
    const cached = baseLimitCache.get(vertical);
    if (cached && now - cached.cachedAt < BASE_LIMIT_CACHE_TTL_MS) {
        return cached.value;
    }

    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    let planSlug: string;
    try {
        planSlug = resolveCommercePlanSlug({ entityType: vertical });
    } catch (error) {
        // Unreachable in a booted container: the configuration is validated at
        // startup (AC-35), so an unset/unknown mapping stops the container
        // rather than reaching a request. Kept as a floor, not as a code path.
        if (!(error instanceof CommercePlanNotConfiguredError)) {
            throw error;
        }
        apiLogger.error(
            { vertical },
            'commerce plan mapping unresolvable at request time — falling back to the base cap'
        );
        return FALLBACK_VERTICAL_CAP;
    }

    try {
        const result = await planService.getBySlug(planSlug);
        if (!result.success) {
            apiLogger.warn(
                { vertical, planSlug, errorCode: result.error.code },
                'commerce vertical plan not found in DB — falling back to the base cap'
            );
            return FALLBACK_VERTICAL_CAP;
        }

        const value = result.data.limits[limitKey];
        if (typeof value !== 'number') {
            apiLogger.warn(
                { vertical, planSlug, limitKey },
                'commerce vertical plan does not declare its own cap — falling back to the base cap'
            );
            return FALLBACK_VERTICAL_CAP;
        }

        baseLimitCache.set(vertical, { value, cachedAt: now });
        return value;
    } catch (error) {
        apiLogger.warn(
            { vertical, planSlug, error: error instanceof Error ? error.message : String(error) },
            'commerce vertical plan lookup threw — falling back to the base cap'
        );
        return FALLBACK_VERTICAL_CAP;
    }
}

/** Clears the memoised base caps. Exported for tests. */
export function _resetCommerceBaseLimitCache(): void {
    baseLimitCache.clear();
}

/**
 * Resolves the cap the caller is actually subject to for one vertical.
 *
 * Order of precedence, highest first:
 *   1. a customer-level limit override — this is how a purchased
 *      `extra-gastronomies-1` / `extra-experiences-1` add-on raises the cap
 *      (AC-15), and it is keyed by limit key so it can only ever move the
 *      vertical it names;
 *   2. the owner's live subscription for THIS vertical, read through the
 *      canonical `subscriptionMatchesDomain` predicate;
 *   3. the vertical's base cap from the plan catalogue.
 *
 * Step 3 is what makes AC-31 true: an owner with **no accommodation
 * subscription** — the normal case for a commerce-only owner, and the case the
 * accommodation loader fails open on — is still capped, because "no
 * subscription" resolves to a number instead of to an absent key.
 *
 * Exported because the checkout route needs the SAME number the create route
 * was gated on: it decides whether a second listing joins the owner's existing
 * subscription or is refused. Two independent readings of "the cap" would let
 * the two disagree, and the disagreement would look like a working checkout.
 *
 * @param input.customerId - The caller's billing customer id, when they have one.
 * @param input.vertical - The commerce vertical being gated.
 * @returns The cap to publish into `userLimits`.
 */
export async function resolveCommerceVerticalCap(input: {
    customerId: string | null | undefined;
    vertical: CommerceVertical;
}): Promise<number> {
    const { customerId, vertical } = input;
    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];
    const baseCap = await loadVerticalBaseLimit(vertical);

    if (!customerId) {
        return baseCap;
    }

    const billing = getQZPayBilling();
    if (!billing) {
        return baseCap;
    }

    let cap = baseCap;

    try {
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const activeSubscription = (subscriptions ?? []).find(
            (sub: { status: string }) =>
                isEntitlementGrantingStatus(sub.status) &&
                subscriptionMatchesDomain(sub, domainOf(vertical))
        );

        if (activeSubscription) {
            const plan = await billing.plans.get(activeSubscription.planId);
            const planCap = plan?.limits?.[limitKey];
            if (typeof planCap === 'number') {
                cap = planCap;
            } else {
                apiLogger.warn(
                    {
                        vertical,
                        subscriptionId: activeSubscription.id,
                        planId: activeSubscription.planId
                    },
                    'commerce subscription plan does not declare the vertical cap — keeping the base cap'
                );
            }
        }
    } catch (error) {
        apiLogger.warn(
            { vertical, customerId, error: error instanceof Error ? error.message : String(error) },
            'failed to resolve the commerce subscription — keeping the base cap'
        );
    }

    try {
        const customerLimits = await billing.limits.getByCustomerId(customerId);
        for (const cl of customerLimits) {
            if (isLimitKey(cl.limitKey) && cl.limitKey === limitKey) {
                cap = cl.maxValue;
            }
        }
    } catch (error) {
        // A customer-level read failure costs the owner the add-on they bought,
        // which is the safe direction to fail: it never grants more than the
        // plan does.
        apiLogger.warn(
            { vertical, customerId, error: error instanceof Error ? error.message : String(error) },
            'failed to read customer-level commerce limits — add-on increases not applied'
        );
    }

    return cap;
}

/**
 * Loads the caller's limits for ONE commerce vertical into the request context.
 *
 * Mount it per-route, after the global `entitlementMiddleware()` and before the
 * matching `enforceGastronomyLimit()` / `enforceExperienceLimit()`. It replaces
 * `userEntitlements` and `userLimits` wholesale rather than merging into them —
 * see the module docblock on why the two domains are never mixed.
 *
 * @param vertical - The commerce vertical this route belongs to.
 * @returns A Hono middleware.
 *
 * @example
 * ```ts
 * options: {
 *   middlewares: [
 *     commerceVerticalEntitlementMiddleware('gastronomy'),
 *     enforceGastronomyLimit()
 *   ]
 * }
 * ```
 */
export function commerceVerticalEntitlementMiddleware(
    vertical: CommerceVertical
): MiddlewareHandler<AppBindings> {
    const limitKey: LimitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    return async (c, next) => {
        // Platform staff bypass (SPEC-171), identical in spirit to
        // `entitlementMiddleware`'s: staff operate without a billing customer
        // and must not be capped by one.
        const actor = c.get('actor');
        if (isStaffBypassRole(actor?.roles)) {
            const unlimited = getUnlimitedEntitlements();
            c.set('userEntitlements', new Set<EntitlementKey>(unlimited.entitlements));
            c.set(
                'userLimits',
                new Map<LimitKey, number>(unlimited.limits.map((l) => [l.key, l.value]))
            );
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        const cap = await resolveCommerceVerticalCap({
            customerId: c.get('billingCustomerId'),
            vertical
        });

        // Commerce plans grant no entitlements (§6.8), so the commerce-domain
        // entitlement set is empty by definition. Setting it — rather than
        // leaving the accommodation set in place — is what keeps the two
        // domains from being read as one on this request.
        c.set('userEntitlements', new Set<EntitlementKey>());
        c.set('userLimits', new Map<LimitKey, number>([[limitKey, cap]]));
        c.set('billingLoadFailed', false);

        await next();
    };
}
