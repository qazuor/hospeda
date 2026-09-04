/**
 * @file billing/audience-plans.ts
 * @description The five-audience model behind `/suscriptores/planes/`, the plan
 * INDEX introduced by HOS-942 (H1 of the HOS-941 epic).
 *
 * The index shows one card per audience Hospeda sells to — host, tourist,
 * gastronomy, experience, partner — each with a "from $X" figure and, where the
 * audience has one, its free-trial length. This module owns three things the
 * `.astro` page deliberately does not:
 *
 * 1. **The destination of each card.** They live here rather than inline in the
 *    template so the routes can be asserted in a unit test instead of by
 *    grepping the page source, which cannot tell a declared string from a
 *    rendered href.
 * 2. **Which plans make up each audience's offer** ({@link selectAudiencePlans}),
 *    so the price line and the trial line can never be computed over two
 *    different sets of plans.
 * 3. **Turning plan payloads into a starting price and a trial length.** Pure,
 *    so the degraded paths (API down, empty catalogue, everything inactive,
 *    nothing offering a trial) are testable without a network.
 *
 * ## Why the trial number is read, never written
 *
 * `trialDays` comes from `GET /api/v1/public/plans` on every request, exactly
 * like the price. Hardcoding it is the HOS-525 bug: the marketing copy promised
 * hosts 30 days while the checkout granted 14. The two audiences that carry a
 * trial today have had different lengths in this same database, so there is no
 * single generic sentence that is true for both — the number has to be resolved
 * per audience, from the catalogue, or not stated at all.
 *
 * ## Why five cards and not four
 *
 * Gastronomy and experience are SEPARATE audiences, never a joint "commerce"
 * one. `ProductDomainEnum` holds four domains and `'commerce'` is a RETIRED
 * value (HOS-692); a surface that grouped the two verticals would reintroduce
 * the vocabulary the product-domain split exists to remove.
 *
 * ## Why the price and the trial can each be absent
 *
 * `fetchPublicPlans` never throws — it returns `{ ok: false, error }` — so a
 * dead API surfaces here as `null` for that audience and NOTHING else. The card
 * still renders, with its copy and its CTA; only the affected line is omitted.
 * An audience card whose price failed to load is still the only navigation a
 * visitor has to that vertical, so hiding the card (or worse, substituting a
 * hardcoded price that the operator may have since changed in admin) would be a
 * strictly worse failure than showing no number.
 *
 * The trial has a second, non-degraded reason to be absent: an audience whose
 * plans simply do not offer one. Partner is that case — all three tiers sit at
 * `trialDays: 0` — and its card carries no trial line at all. `null` covers both
 * situations because they must render identically.
 */

import { PARTNER_TIER_PLAN_SLUG } from '@repo/billing';
import type { ProductDomainValue } from '@repo/schemas';
import type { PricingAudience } from '../billing-i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '../pricing-plans';
import type { FetchPlansResult, PublicPlanData } from './fetch-plans';
import { fetchPublicPlans, filterPlansByCategory } from './fetch-plans';
import { computeMinimumTrialDays } from './generic-trial-days';

/** The five audiences the plan index offers, in display order. */
export type AudienceCardId = 'host' | 'tourist' | 'gastronomy' | 'experience' | 'partner';

/**
 * Display order of the audience cards.
 *
 * Host first and tourist second because those two are the conversion funnel the
 * rest of the site already points at; the three newer verticals follow.
 */
export const AUDIENCE_CARD_ORDER: readonly AudienceCardId[] = [
    'host',
    'tourist',
    'gastronomy',
    'experience',
    'partner'
] as const;

/**
 * Where each card sends the visitor, as a locale-agnostic path for `buildUrl`.
 *
 * Host and tourist read from `PRICING_PAGE_PATH_BY_AUDIENCE` rather than
 * repeating the two URLs HOS-942 moved — the pricing pages, the comparison
 * tables and this index must not be able to disagree about where they are. The
 * other three point at the vertical's SALES page (level 2 of HOS-941 D-7).
 *
 * HOS-1032 changed those three from `publicar-restaurante` /
 * `publicar-experiencia` / `sumate/partner`, which this same change turned into
 * 301s. A link to a URL that redirects is not broken, but it is a hop the index
 * has no reason to spend, and it is the shape AC-51 exists to keep out.
 *
 * The asymmetry — two audiences to their PRICING page, three to their SALES page
 * — is inherited, not introduced: it is what H1 shipped, and deciding where the
 * index should dispatch to belongs to H8 (HOS-1033), which rebuilds this surface
 * as the merged `/planes/` index. Changing it here would be re-deciding H8's
 * question in a file H8 is about to rewrite.
 */
export const AUDIENCE_CARD_PATHS: Readonly<Record<AudienceCardId, string>> = {
    host: PRICING_PAGE_PATH_BY_AUDIENCE.owner,
    tourist: PRICING_PAGE_PATH_BY_AUDIENCE.tourist,
    gastronomy: 'planes/gastronomia',
    experience: 'planes/experiencias',
    partner: 'planes/aliados'
} as const;

/**
 * The plan-vocabulary audience for each index card id.
 *
 * The ONE translation between this module's `AudienceCardId` (spelled `host`,
 * the index's vocabulary) and `PricingAudience` (spelled `owner`, the plan
 * `category`/`product_domain` vocabulary — see `lib/billing-i18n.ts`). Every
 * other spelling of the same mapping would be a second place for the two to
 * drift; the five pricing pages read this one.
 */
export const PRICING_AUDIENCE_BY_CARD_ID: Readonly<Record<AudienceCardId, PricingAudience>> = {
    host: 'owner',
    tourist: 'tourist',
    gastronomy: 'gastronomy',
    experience: 'experience',
    partner: 'partner'
} as const;

/** Inverse of {@link PRICING_AUDIENCE_BY_CARD_ID}. */
export const CARD_ID_BY_PRICING_AUDIENCE: Readonly<Record<PricingAudience, AudienceCardId>> = {
    owner: 'host',
    tourist: 'tourist',
    gastronomy: 'gastronomy',
    experience: 'experience',
    partner: 'partner'
} as const;

/**
 * The `?domain=` each audience's catalogue is fetched with, or `undefined` for
 * the two accommodation audiences, which share the default domain and are
 * separated by `category` instead.
 *
 * `'commerce'` is a RETIRED `ProductDomainEnum` value (HOS-941 R-3) and appears
 * nowhere here: gastronomy and experience are separate domains and no surface
 * may group them.
 */
const PLAN_DOMAIN_BY_CARD_ID: Readonly<Record<AudienceCardId, ProductDomainValue | undefined>> = {
    host: undefined,
    tourist: undefined,
    gastronomy: 'gastronomy',
    experience: 'experience',
    partner: 'partner'
} as const;

/**
 * Fetch and select the plans of ONE audience, for that audience's pricing page.
 *
 * One request, not the four {@link fetchAudienceOffers} issues: a pricing page
 * renders a single audience and has no use for the other four catalogues.
 *
 * The SELECTION, though, goes through {@link selectAudiencePlans} rather than
 * being re-derived — which is the whole point of this function existing instead
 * of each page calling `fetchPublicPlans` and filtering. Two of that function's
 * rules are load-bearing and neither is obvious at a call site: `complex` plans
 * are never selected for the host audience, and partner is narrowed to the
 * sellable tiers, dropping the still-active pre-tier `partner-listing`. A page
 * that filtered by hand would advertise a legacy plan nobody can subscribe to.
 *
 * The result is sorted cheapest-first (`sortOrder` ascending), which
 * `PricingCardsGrid` REQUIRES: it diffs each card against the one before it.
 * `filterPlansByCategory` already sorts the two accommodation audiences; the
 * other three are sorted here, since they come straight off a domain fetch.
 *
 * SSR-only — it reaches `@repo/billing` transitively, so no client island may
 * import it (see `test/static-guards/billing-barrel-client-isolation.test.ts`).
 *
 * @param params.audience - Which audience's catalogue to fetch.
 * @returns That audience's active plans, cheapest-first. EMPTY when the fetch
 *   failed or the audience currently has no sellable plan — the two are
 *   deliberately indistinguishable, because both must render the same empty
 *   state rather than an invented price.
 */
export async function fetchAudiencePlans({
    audience
}: {
    readonly audience: AudienceCardId;
}): Promise<readonly PublicPlanData[]> {
    const domain = PLAN_DOMAIN_BY_CARD_ID[audience];
    const result = await fetchPublicPlans(domain ? { domain } : {});

    // `selectAudiencePlans` needs all four slots; the three this audience does
    // not use are stubbed with the same empty-list shape a failed fetch takes,
    // so nothing is selected out of them.
    const empty: FetchPlansResult = { ok: true, plans: [] };
    const selected = selectAudiencePlans({
        accommodation: domain === undefined ? result : empty,
        gastronomy: domain === 'gastronomy' ? result : empty,
        experience: domain === 'experience' ? result : empty,
        partner: domain === 'partner' ? result : empty
    })[audience];

    return selected
        .filter((plan) => plan.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The entry price an audience card advertises.
 *
 * `null` (absent, modelled outside this union) means "could not be determined";
 * `free` means the cheapest sellable plan for that audience really is free, and
 * is rendered as the free label rather than as "from $0".
 */
export type AudienceStartingPrice =
    | { readonly kind: 'free' }
    | { readonly kind: 'from'; readonly monthlyPriceArs: number };

/** Starting price per audience; `null` for an audience whose plans did not load. */
export type AudienceStartingPrices = Readonly<Record<AudienceCardId, AudienceStartingPrice | null>>;

/**
 * The partner plan slugs a visitor can actually buy today.
 *
 * Read off `PARTNER_TIER_PLAN_SLUG`, the one place in the platform that maps a
 * partner TIER to a plan, rather than hardcoded here. It matters: the partner
 * domain also contains `partner-listing`, a pre-tier plan kept ACTIVE on purpose
 * because live partner rows still point at it. Taking a naive minimum over the
 * domain would advertise that legacy plan's price for an offer nobody can
 * subscribe to.
 */
const SELLABLE_PARTNER_PLAN_SLUGS: ReadonlySet<string> = new Set(
    Object.values(PARTNER_TIER_PLAN_SLUG).filter((slug): slug is string => slug !== null)
);

/**
 * The cheapest active plan in a list, as an {@link AudienceStartingPrice}.
 *
 * A price of zero resolves to `free` rather than to "from $0" — the tourist
 * catalogue really does contain a free tier, and "from $0" reads as a rounding
 * artefact. The rule is uniform across audiences on purpose: it reports what the
 * catalogue says instead of special-casing which audience is allowed a free
 * tier.
 *
 * @param params.plans - Candidate plans (any mix of active and inactive).
 * @returns The starting price, or `null` when no active plan is present.
 */
export function resolveStartingPrice({
    plans
}: {
    readonly plans: readonly PublicPlanData[];
}): AudienceStartingPrice | null {
    const active = plans.filter((plan) => plan.isActive);
    if (active.length === 0) return null;

    let lowest = Number.POSITIVE_INFINITY;
    for (const plan of active) {
        if (typeof plan.monthlyPriceArs !== 'number' || !Number.isFinite(plan.monthlyPriceArs)) {
            continue;
        }
        if (plan.monthlyPriceArs < 0) continue;
        if (plan.monthlyPriceArs < lowest) lowest = plan.monthlyPriceArs;
    }

    if (!Number.isFinite(lowest)) return null;
    return lowest === 0 ? { kind: 'free' } : { kind: 'from', monthlyPriceArs: lowest };
}

/**
 * The free-trial length an audience card advertises, in days.
 *
 * `null` means the card shows NO trial line at all, and it covers two different
 * situations that must render identically: the audience's catalogue failed to
 * load, and the audience genuinely has no trial on offer (every partner tier,
 * today). Zero is deliberately unrepresentable — "0 días de prueba" is a worse
 * statement than silence, and a number inherited from another audience would be
 * the H-98/HOS-525 bug all over again.
 */
export type AudienceTrialDays = Readonly<Record<AudienceCardId, number | null>>;

/** Everything one round of plan fetches tells the index, per audience. */
export interface AudienceOffers {
    readonly startingPrices: AudienceStartingPrices;
    readonly trialDays: AudienceTrialDays;
}

/** The four `GET /public/plans` responses the index needs, already resolved. */
export interface AudiencePlanResults {
    /**
     * `GET /public/plans` with no `?domain=`; carries the owner AND tourist
     * catalogues, separated by `category`.
     */
    readonly accommodation: FetchPlansResult;
    /** `?domain=gastronomy`. */
    readonly gastronomy: FetchPlansResult;
    /** `?domain=experience`. */
    readonly experience: FetchPlansResult;
    /** `?domain=partner`. */
    readonly partner: FetchPlansResult;
}

/** Unwrap a fetch result to its plan list, or an empty list when it failed. */
function plansOf(result: FetchPlansResult): readonly PublicPlanData[] {
    return result.ok ? result.plans : [];
}

/**
 * Which plans make up each audience's offer.
 *
 * The ONE place the audience → plans mapping is expressed. Price and trial are
 * two readings of the same offer, so they must never be able to disagree about
 * which plans an audience is made of — a partner trial computed over
 * `partner-listing` while the price deliberately excludes it would advertise a
 * promise from a plan nobody can buy.
 *
 * Two selection rules are load-bearing and both live here:
 *
 * - `complex` is never selected. Neither accommodation branch asks for that
 *   category, which is what keeps the complex tier off this surface entirely.
 * - Partner is narrowed to {@link SELLABLE_PARTNER_PLAN_SLUGS}, dropping the
 *   still-active pre-tier `partner-listing`.
 *
 * Inactive plans are passed THROUGH rather than filtered here: both consumers
 * drop them (`resolveStartingPrice` and `computeMinimumTrialDays` each check
 * `isActive`), and leaving the check with them keeps each one honest on its own.
 *
 * @param results - The four resolved fetches, see {@link AudiencePlanResults}.
 * @returns The candidate plan list for each of the five audiences.
 */
export function selectAudiencePlans(
    results: AudiencePlanResults
): Readonly<Record<AudienceCardId, readonly PublicPlanData[]>> {
    const accommodationPlans = plansOf(results.accommodation);

    return {
        host: filterPlansByCategory(accommodationPlans, 'owner'),
        tourist: filterPlansByCategory(accommodationPlans, 'tourist'),
        gastronomy: plansOf(results.gastronomy),
        experience: plansOf(results.experience),
        partner: plansOf(results.partner).filter((plan) =>
            SELLABLE_PARTNER_PLAN_SLUGS.has(plan.slug)
        )
    };
}

/**
 * Derive every audience's starting price from four already-resolved plan
 * payloads.
 *
 * Split from {@link fetchAudienceOffers} so the mapping — including every
 * degraded path — is exercisable without a network.
 *
 * @param results - The four resolved fetches, see {@link AudiencePlanResults}.
 * @returns Starting price per audience, `null` where it could not be resolved.
 */
export function resolveAudienceStartingPrices(
    results: AudiencePlanResults
): AudienceStartingPrices {
    const byAudience = selectAudiencePlans(results);

    return Object.fromEntries(
        AUDIENCE_CARD_ORDER.map((id) => [id, resolveStartingPrice({ plans: byAudience[id] })])
    ) as AudienceStartingPrices;
}

/**
 * Derive every audience's advertised trial length from four already-resolved
 * plan payloads.
 *
 * Every audience goes through {@link computeMinimumTrialDays} — the same
 * function the owner-only surfaces have used since H-98 — rather than a second
 * implementation of "the shortest trial anyone could end up with". The number is
 * therefore always read from `billing_plans.metadata.trialDays` as served by the
 * API, never from a constant and never from another audience: host and tourist
 * have had genuinely different trial lengths in this database, and a single
 * generic line would be false for one of them (HOS-525).
 *
 * @param results - The four resolved fetches, see {@link AudiencePlanResults}.
 * @returns Trial days per audience, `null` where no trial may be advertised.
 */
export function resolveAudienceTrialDays(results: AudiencePlanResults): AudienceTrialDays {
    const byAudience = selectAudiencePlans(results);

    return Object.fromEntries(
        AUDIENCE_CARD_ORDER.map((id) => [id, computeMinimumTrialDays({ plans: byAudience[id] })])
    ) as AudienceTrialDays;
}

/**
 * Fetch every audience's starting price AND trial length from the public plans
 * endpoint.
 *
 * Four requests, issued concurrently — the same four whether the caller wants
 * the price, the trial or both. Price and trial are two readings of one
 * catalogue, so they are resolved from a SINGLE round of fetches; asking twice
 * would double the request count and open a window where the two lines on one
 * card describe different snapshots of the catalogue.
 *
 * `fetchPublicPlans` never rejects, so a failing domain degrades to `null` for
 * that audience alone — on both readings — and leaves the other four intact.
 *
 * SSR-only: called from `/suscriptores/planes/index.astro`'s frontmatter. It
 * imports `@repo/billing` at runtime, which is why nothing reachable from a
 * client island may import this module (see the HOS-360 barrel guard).
 *
 * @returns Price and trial per audience, `null` where either is unresolvable.
 */
export async function fetchAudienceOffers(): Promise<AudienceOffers> {
    const [accommodation, gastronomy, experience, partner] = await Promise.all([
        fetchPublicPlans(),
        fetchPublicPlans({ domain: 'gastronomy' }),
        fetchPublicPlans({ domain: 'experience' }),
        fetchPublicPlans({ domain: 'partner' })
    ]);

    const results: AudiencePlanResults = { accommodation, gastronomy, experience, partner };

    return {
        startingPrices: resolveAudienceStartingPrices(results),
        trialDays: resolveAudienceTrialDays(results)
    };
}

/**
 * Format ARS cents as a locale-aware currency string with no decimals.
 *
 * Mirrors `formatPriceArs` in `PricingCardsGrid.astro` — duplicated rather than
 * imported because that helper is a closure over the component's own
 * `intlLocale` prop and is not exported. Kept in sync by
 * `test/lib/billing/audience-plans.test.ts`.
 *
 * @param params.cents - Price in ARS cents.
 * @param params.intlLocale - BCP-47 tag from `getIntlLocale`.
 * @returns The formatted amount, e.g. `"$18.000"`.
 */
export function formatStartingPriceArs({
    cents,
    intlLocale
}: {
    readonly cents: number;
    readonly intlLocale: string;
}): string {
    const pesos = cents / 100;
    try {
        return new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(pesos);
    } catch {
        return `$${pesos.toLocaleString('es-AR')}`;
    }
}
