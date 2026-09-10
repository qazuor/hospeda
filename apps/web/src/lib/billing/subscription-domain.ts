/**
 * @file subscription-domain.ts
 * @description Pure helpers for the four-way `/mi-cuenta/suscripcion/`
 * dashboard (HOS-689 item 3, widened to `tourist` by HOS-1321).
 *
 * `mi-cuenta/suscripcion/index.astro` used to accept only
 * `'accommodation' | 'commerce'` for its `?domain=` query param (HOS-259).
 * That is not enough now that commerce billing is per-vertical (HOS-688):
 * an owner can hold up to three independent subscriptions —
 * accommodation, gastronomy, experience — and the page has to resolve
 * whichever one is relevant, not silently default to accommodation for an
 * owner who holds none.
 *
 * ## Why `tourist` is here (HOS-1321, owner decision 2026-09-10)
 *
 * HOS-1233 reclassified the tourist tiers into their own `product_domain`.
 * From that moment a paying `tourist-vip` holder had NO surface on which to
 * see, change or cancel what they pay for: this list was hardcoded to the
 * three other domains, so the page resolved `'accommodation'`, asked the API
 * for an accommodation subscription and rendered "Sin suscripción activa" to
 * somebody being charged every month. The owner's ruling is that tourist is a
 * fourth tab like the other three — same shape, same switcher, its own plan
 * catalogue — and NOT a cross-domain plan-change flow, which exists nowhere in
 * the repo.
 */

/**
 * Every domain the subscription dashboard can be scoped to.
 *
 * **The order is load-bearing**, because {@link resolveActiveSubscriptionDomain}
 * lands an unqualified visitor on `heldDomains[0]`. `'tourist'` is LAST for the
 * same reason HOS-1233 made the API's tourist resolution an ORDERED fallback
 * rather than an "either" match: an account can hold an accommodation AND a
 * tourist subscription at once (host-onboarding auto-promotes a traveller to
 * `HOST` without touching their tourist subscription), and a host who lands on
 * their tourist tab instead of the accommodation one they manage is HOS-259's
 * bug wearing a new domain. Ordered, the tourist entry can only ever turn an
 * empty state into a real one.
 */
export const SUBSCRIPTION_DASHBOARD_DOMAINS = [
    'accommodation',
    'gastronomy',
    'experience',
    'tourist'
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
 *   in, in the priority order of {@link SUBSCRIPTION_DASHBOARD_DOMAINS} — the
 *   page derives them by asking the API once per domain and keeping the ones
 *   that answered with a subscription.
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

/**
 * Where a dashboard domain's "Cambiar plan" catalogue comes from.
 *
 * - `accommodation` — the plans served by `GET /public/plans` with NO
 *   `?domain=`, narrowed by `category`. `category: null` means "decide by the
 *   caller's roles", which is the accommodation dashboard's own long-standing
 *   rule (a host sees owner plans, a traveller sees tourist plans — BETA-173).
 *   A non-null `category` overrides that: the tourist dashboard offers tourist
 *   plans to everybody who lands on it, roles included.
 * - `commerce` — that vertical's own tiers, fetched with `?domain=<vertical>`
 *   and changed through `CommercePlanChange`, never through `PlanChangeFlow`.
 */
export type DashboardPlanSource =
    | { readonly kind: 'accommodation'; readonly category: 'owner' | 'tourist' | null }
    | { readonly kind: 'commerce'; readonly domain: 'gastronomy' | 'experience' };

/**
 * Which catalogue and which plan-change flow one dashboard domain uses.
 *
 * Written as an inclusion list rather than as `domain !== 'accommodation'`,
 * which is exactly the shape HOS-1321 had to remove: with `tourist` added to
 * {@link SUBSCRIPTION_DASHBOARD_DOMAINS}, that negation silently classified the
 * tourist dashboard as a COMMERCE vertical — it would have fetched
 * `?domain=tourist` (a catalogue that does not exist: the tourist tiers are
 * accommodation-domain plans separated by `category`), rendered
 * `CommercePlanChange` over an empty list, and posted a tourist plan change to
 * `POST /protected/commerce/tourist/change-plan`. A fifth domain added later
 * fails to compile here instead of inheriting a flow nobody chose for it.
 *
 * Tourist is pinned to `category: 'tourist'` rather than following the
 * accommodation dashboard's role-based split, per the owner's 2026-09-10
 * ruling: the "Cambiar plan" of a `tourist-vip` holder offers tourist plans
 * ONLY. It never crosses into the owner catalogue — a host+tourist dual holder
 * reaching this tab must not be offered a downgrade of the accommodation
 * subscription they manage on the OTHER tab. Moving between audiences is done
 * from the plans page, not from here.
 *
 * @param params.domain - The resolved dashboard domain.
 * @returns The catalogue + flow that domain uses.
 */
export function resolveDashboardPlanSource({
    domain
}: {
    readonly domain: SubscriptionDashboardDomain;
}): DashboardPlanSource {
    const BY_DOMAIN: Readonly<Record<SubscriptionDashboardDomain, DashboardPlanSource>> = {
        accommodation: { kind: 'accommodation', category: null },
        tourist: { kind: 'accommodation', category: 'tourist' },
        gastronomy: { kind: 'commerce', domain: 'gastronomy' },
        experience: { kind: 'commerce', domain: 'experience' }
    };
    return BY_DOMAIN[domain];
}
