/**
 * @file subscription-domain.ts
 * @description Pure helpers for the three-way `/mi-cuenta/suscripcion/`
 * dashboard (HOS-689 item 3).
 *
 * `mi-cuenta/suscripcion/index.astro` used to accept only
 * `'accommodation' | 'commerce'` for its `?domain=` query param (HOS-259).
 * That is not enough now that commerce billing is per-vertical (HOS-688):
 * an owner can hold up to three independent subscriptions —
 * accommodation, gastronomy, experience — and the page has to resolve
 * whichever one is relevant, not silently default to accommodation for an
 * owner who holds none.
 */

/** Every domain the subscription dashboard can be scoped to. */
export const SUBSCRIPTION_DASHBOARD_DOMAINS = [
    'accommodation',
    'gastronomy',
    'experience'
] as const;

/** One of {@link SUBSCRIPTION_DASHBOARD_DOMAINS}. */
export type SubscriptionDashboardDomain = (typeof SUBSCRIPTION_DASHBOARD_DOMAINS)[number];

/**
 * Narrows an arbitrary string (typically `Astro.url.searchParams.get('domain')`)
 * to a {@link SubscriptionDashboardDomain}.
 *
 * @param value - The raw query param value, or `null` when absent.
 */
export function isSubscriptionDashboardDomain(
    value: string | null
): value is SubscriptionDashboardDomain {
    return value !== null && (SUBSCRIPTION_DASHBOARD_DOMAINS as readonly string[]).includes(value);
}

/**
 * Resolves which domain the dashboard should render on this request.
 *
 * An explicit, valid `?domain=` always wins — it is how another surface
 * (e.g. the commerce SUSPENDED-listing recover CTA, HOS-259/HOS-689) links
 * directly to the domain that actually needs attention, even one the owner
 * does not otherwise hold (a lapsed/cancelled subscription still needs a
 * page to land on). Absent that, the first domain the owner actually holds
 * a subscription in wins — so a commerce-only owner (no accommodation
 * subscription at all) lands on THEIR subscription instead of an
 * accommodation "no subscription" empty state. With no explicit domain and
 * no held subscription at all, `'accommodation'` is the default, matching
 * every pre-HOS-689 caller's behaviour.
 *
 * @param params.rawDomain - The raw `?domain=` query param value.
 * @param params.heldDomains - Domains the caller holds a usable subscription
 *   in, in priority order (see `resolveHeldSubscriptionDomains`).
 */
export function resolveActiveSubscriptionDomain({
    rawDomain,
    heldDomains
}: {
    readonly rawDomain: string | null;
    readonly heldDomains: readonly SubscriptionDashboardDomain[];
}): SubscriptionDashboardDomain {
    if (isSubscriptionDashboardDomain(rawDomain)) {
        return rawDomain;
    }
    return heldDomains[0] ?? 'accommodation';
}
