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

import type { ProductDomainValue } from '@repo/schemas';

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
 * Where a dashboard domain's "Cambiar plan" catalogue comes from, and which
 * plan-change flow the tab renders.
 *
 * Flat rather than a discriminated union so each decision can be asserted, and
 * got wrong, on its own: which `?domain=` the catalogue is fetched with is NOT
 * the same question as which flow changes the plan, and HOS-1321 shipped a
 * first draft that conflated them.
 */
export interface DashboardPlanSource {
    /**
     * Which plan-change component this tab renders. `'accommodation'` is
     * `PlanChangeFlow` + `POST /billing/subscriptions/change-plan`;
     * `'commerce'` is `CommercePlanChange` + that vertical's own route.
     */
    readonly flow: 'accommodation' | 'commerce';
    /**
     * The `?domain=` the catalogue is fetched with. `undefined` means "send no
     * domain", which `GET /public/plans` answers with its `accommodation`
     * default — correct for the accommodation tab and for nothing else.
     */
    readonly planDomain: ProductDomainValue | undefined;
    /**
     * `billing_plans.metadata.category` to narrow the fetched catalogue to.
     * `null` means "decide by the caller's roles", the accommodation tab's own
     * long-standing rule (a host sees owner plans, a traveller sees tourist
     * plans — BETA-173). A non-null value overrides the roles entirely.
     */
    readonly category: 'owner' | 'tourist' | null;
}

/**
 * Which catalogue and which plan-change flow one dashboard domain uses.
 *
 * ## Tourist fetches `?domain=tourist`, and that is the whole fix
 *
 * HOS-1233 gave the tourist tiers their own `product_domain`:
 * `TOURIST_FREE_PLAN` / `TOURIST_VIP_PLAN` declare
 * `productDomain: ProductDomainEnum.TOURIST` (`plans.config.ts`), the seed
 * writes it (`billingPlans.seed.ts`) and data-migration
 * `0103-hos-1233-reclassify-tourist-product-domain` moved the live rows. From
 * that moment `GET /public/plans` with NO `?domain=` **excludes** them —
 * `listPlans.ts` builds its exclusion set with
 * `ne(billingPlans.productDomain, 'accommodation')` — so
 * `filterPlansByCategory(<accommodation catalogue>, 'tourist')` returns `[]`,
 * the tab renders no "Cambiar plan" button at all, and the owner's ruling that
 * a `tourist-vip` holder is offered tourist plans is simply not implemented.
 *
 * This function's first draft got that backwards, in a comment claiming a
 * `?domain=tourist` catalogue "does not exist". That was true until the day
 * before, and `resolveRequestedDomain` accepts `tourist` today — a stale REASON
 * under a conclusion nobody re-reads, which is the same defect this spec found
 * in its own issue. When a change moves a value into a new domain, every reader
 * of that value has to be swept, not only the one that motivated the ticket.
 *
 * ## The mapping is exhaustive on purpose
 *
 * A `Record` over every dashboard domain, not `domain !== 'accommodation'`.
 * That negation is what classified the tourist tab as a COMMERCE vertical — it
 * would render `CommercePlanChange` and post to
 * `POST /protected/commerce/tourist/change-plan`. A fifth domain fails to
 * compile here instead of inheriting a flow nobody chose for it.
 *
 * Tourist is pinned to `category: 'tourist'` rather than following the
 * accommodation tab's role-based split, per the owner's 2026-09-10 ruling: the
 * "Cambiar plan" of a `tourist-vip` holder offers tourist plans ONLY. It never
 * crosses into the owner catalogue — a host+tourist dual holder reaching this
 * tab must not be offered a change to the accommodation subscription they
 * manage on the OTHER tab.
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
        accommodation: { flow: 'accommodation', planDomain: undefined, category: null },
        tourist: { flow: 'accommodation', planDomain: 'tourist', category: 'tourist' },
        gastronomy: { flow: 'commerce', planDomain: 'gastronomy', category: 'owner' },
        experience: { flow: 'commerce', planDomain: 'experience', category: 'owner' }
    };
    return BY_DOMAIN[domain];
}

/**
 * What the page could establish about the caller's ACCOMMODATION subscription.
 *
 * Three states, not a boolean, because the read can fail: it is one of four
 * parallel SSR fetches and the API client gives up after 10s. A failed read is
 * NOT "they have none" — see {@link planChangeWouldResolveAnotherSubscription},
 * which is why the distinction has to survive to the predicate instead of being
 * flattened at the fetch.
 *
 * `'absent'` means "no subscription that `POST /billing/subscriptions/change-plan`
 * would resolve", which is narrower than "no subscription at all": that route
 * filters to `active | trialing` before selecting, so a `paused`, `past_due`,
 * `comp` or `courtesy` accommodation subscription is invisible to it and cannot
 * be the row it mutates.
 */
export type AccommodationSubscriptionReading = 'held' | 'absent' | 'unknown';

/**
 * The response statuses `POST /billing/subscriptions/change-plan` will actually
 * resolve — `plan-change.ts` filters to `active | trialing` before selecting,
 * and this endpoint reports `trialing` as `'trial'`.
 *
 * Exported so the page cannot restate them: a status that route ignores must
 * read as `'absent'`, or the tourist tab withholds a plan change that was never
 * in danger.
 */
export const CHANGE_PLAN_RESOLVABLE_STATUSES: readonly string[] = ['active', 'trial'] as const;

/**
 * Whether this tab's "Cambiar plan" would mutate a DIFFERENT subscription than
 * the one it is showing (HOS-1321).
 *
 * `POST /billing/subscriptions/change-plan` does not take a domain. It resolves
 * the subscription to mutate with `selectAccommodationSubscription`, which is
 * an ORDERED pair: accommodation first, tourist only as a fallback. That is
 * correct for the route's own purpose and it is exactly what makes the tourist
 * tab's plan change unsafe for one account shape — a holder of BOTH an
 * accommodation and a tourist subscription. Their tourist tab would offer
 * `tourist-free`/`tourist-vip`, the route would resolve their OWNER
 * subscription, and `assertAccommodationPlanChangeTarget` would wave a tourist
 * slug through (`plan-domains.config.ts` files the tourist tiers as
 * accommodation, knowingly — HOS-1279). The result is a paid host plan silently
 * downgraded onto a tourist tier: a write, on the wrong row, with no error.
 *
 * That account can hold both without doing anything unusual — host-onboarding
 * auto-promotes a traveller to `HOST` without touching their tourist
 * subscription, which is why the repo seeds `host-provider@local.test`.
 *
 * ## It fails CLOSED on an unresolved read
 *
 * `'unknown'` withholds, exactly like `'held'`. This predicate is the only
 * thing between a dual holder and a mis-targeted write, and its input is a
 * network read that can 500 or time out. Treating a failed accommodation read
 * as "they have none" would re-open the bug through the failure mode of its own
 * input: one blip and the dual holder lands on the tourist tab with a live plan
 * change aimed at their owner row. The cost of failing closed is a `tourist-vip`
 * holder who sees "Ver planes disponibles" instead of a modal, on a request
 * where a fetch already failed.
 *
 * ## What it does NOT withhold
 *
 * The tab still shows the subscription, still cancels and pauses it — those act
 * on the subscription id this tab already read, so they cannot reach the wrong
 * row. And a tourist-only holder keeps their plan change, because the route's
 * fallback resolves the very row the tab is showing.
 *
 * The narrow fix would be a domain-scoped plan-change route; that is backend
 * work, and until it exists this is the boundary that keeps the write honest.
 *
 * @param params.domain - The resolved dashboard domain.
 * @param params.accommodationSubscription - What the page established about the
 *   caller's accommodation subscription; `'unknown'` when the read failed.
 * @returns `true` when this tab must NOT offer a plan change.
 */
export function planChangeWouldResolveAnotherSubscription({
    domain,
    accommodationSubscription
}: {
    readonly domain: SubscriptionDashboardDomain;
    readonly accommodationSubscription: AccommodationSubscriptionReading;
}): boolean {
    if (domain !== 'tourist') {
        return false;
    }
    // Anything but a definite "no accommodation subscription to resolve"
    // withholds — `'unknown'` included. See the fail-closed note above.
    return accommodationSubscription !== 'absent';
}
