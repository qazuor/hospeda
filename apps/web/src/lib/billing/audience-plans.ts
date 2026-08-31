/**
 * @file billing/audience-plans.ts
 * @description The five-audience model behind `/suscriptores/planes/`, the plan
 * INDEX introduced by HOS-942 (H1 of the HOS-941 epic).
 *
 * The index shows one card per audience Hospeda sells to — host, tourist,
 * gastronomy, experience, partner — each with a "from $X" figure. This module
 * owns two things the `.astro` page deliberately does not:
 *
 * 1. **The destination of each card.** They live here rather than inline in the
 *    template so the routes can be asserted in a unit test instead of by
 *    grepping the page source, which cannot tell a declared string from a
 *    rendered href.
 * 2. **Turning plan payloads into a starting price.** Pure, so the degraded
 *    paths (API down, empty catalogue, everything inactive) are testable
 *    without a network.
 *
 * ## Why five cards and not four
 *
 * Gastronomy and experience are SEPARATE audiences, never a joint "commerce"
 * one. `ProductDomainEnum` holds four domains and `'commerce'` is a RETIRED
 * value (HOS-692); a surface that grouped the two verticals would reintroduce
 * the vocabulary the product-domain split exists to remove.
 *
 * ## Why the price can be absent
 *
 * `fetchPublicPlans` never throws — it returns `{ ok: false, error }` — so a
 * dead API surfaces here as `null` for that audience and NOTHING else. The card
 * still renders, with its copy and its CTA; only the price line is omitted. An
 * audience card whose price failed to load is still the only navigation a
 * visitor has to that vertical, so hiding the card (or worse, substituting a
 * hardcoded price that the operator may have since changed in admin) would be a
 * strictly worse failure than showing no number.
 */

import { PARTNER_TIER_PLAN_SLUG } from '@repo/billing';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '../pricing-plans';
import type { FetchPlansResult, PublicPlanData } from './fetch-plans';
import { fetchPublicPlans, filterPlansByCategory } from './fetch-plans';

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
 * other three point at the vertical's existing marketing landing: those pages
 * already carry the vertical's price and CTA, so the index links to them rather
 * than duplicating a pricing page per vertical.
 */
export const AUDIENCE_CARD_PATHS: Readonly<Record<AudienceCardId, string>> = {
    host: PRICING_PAGE_PATH_BY_AUDIENCE.owner,
    tourist: PRICING_PAGE_PATH_BY_AUDIENCE.tourist,
    gastronomy: 'publicar-restaurante',
    experience: 'publicar-experiencia',
    partner: 'sumate/partner'
} as const;

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

/** Unwrap a fetch result to its plan list, or an empty list when it failed. */
function plansOf(result: FetchPlansResult): readonly PublicPlanData[] {
    return result.ok ? result.plans : [];
}

/**
 * Derive every audience's starting price from four already-resolved plan
 * payloads.
 *
 * Split from {@link fetchAudienceStartingPrices} so the mapping — including
 * every degraded path — is exercisable without a network.
 *
 * @param params.accommodation - `GET /public/plans` with no `?domain=`; carries
 *   the owner AND tourist catalogues, separated here by `category`. Note that
 *   `complex` plans are never selected: neither branch asks for that category,
 *   which is what keeps the complex tier off this surface.
 * @param params.gastronomy - `?domain=gastronomy`.
 * @param params.experience - `?domain=experience`.
 * @param params.partner - `?domain=partner`, narrowed to the sellable tiers.
 * @returns Starting price per audience, `null` where it could not be resolved.
 */
export function resolveAudienceStartingPrices({
    accommodation,
    gastronomy,
    experience,
    partner
}: {
    readonly accommodation: FetchPlansResult;
    readonly gastronomy: FetchPlansResult;
    readonly experience: FetchPlansResult;
    readonly partner: FetchPlansResult;
}): AudienceStartingPrices {
    const accommodationPlans = plansOf(accommodation);

    return {
        host: resolveStartingPrice({
            plans: filterPlansByCategory(accommodationPlans, 'owner')
        }),
        tourist: resolveStartingPrice({
            plans: filterPlansByCategory(accommodationPlans, 'tourist')
        }),
        gastronomy: resolveStartingPrice({ plans: plansOf(gastronomy) }),
        experience: resolveStartingPrice({ plans: plansOf(experience) }),
        partner: resolveStartingPrice({
            plans: plansOf(partner).filter((plan) => SELLABLE_PARTNER_PLAN_SLUGS.has(plan.slug))
        })
    };
}

/**
 * Fetch every audience's starting price from the public plans endpoint.
 *
 * Four requests, issued concurrently. `fetchPublicPlans` never rejects, so a
 * failing domain degrades to `null` for that audience alone and leaves the other
 * four intact.
 *
 * SSR-only: called from `/suscriptores/planes/index.astro`'s frontmatter. It
 * imports `@repo/billing` at runtime, which is why nothing reachable from a
 * client island may import this module (see the HOS-360 barrel guard).
 *
 * @returns Starting price per audience, `null` where it could not be resolved.
 */
export async function fetchAudienceStartingPrices(): Promise<AudienceStartingPrices> {
    const [accommodation, gastronomy, experience, partner] = await Promise.all([
        fetchPublicPlans(),
        fetchPublicPlans({ domain: 'gastronomy' }),
        fetchPublicPlans({ domain: 'experience' }),
        fetchPublicPlans({ domain: 'partner' })
    ]);

    return resolveAudienceStartingPrices({ accommodation, gastronomy, experience, partner });
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
