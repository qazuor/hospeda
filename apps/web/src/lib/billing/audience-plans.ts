/**
 * @file billing/audience-plans.ts
 * @description The five-audience model behind `/suscriptores/planes/`, the plan
 * INDEX introduced by HOS-942 (H1 of the HOS-941 epic).
 *
 * The index shows one card per audience Hospeda sells to — host, tourist,
 * venue, experience, partner — each with a "from $X" figure where that
 * audience publishes one, and, where it has one, its free-trial length. This
 * module owns three things the `.astro` page deliberately does not:
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
 * `trialDays` comes from the public vertical catalog on every request, exactly
 * like the price. Hardcoding it is the HOS-525 bug: the marketing copy promised
 * hosts 30 days while the checkout granted 14. The two audiences that carry a
 * trial today have had different lengths in this same database, so there is no
 * single generic sentence that is true for both — the number has to be resolved
 * per audience, from the catalogue, or not stated at all.
 *
 * ## Why five cards and not four
 *
 * Venue and experience are SEPARATE audiences, never a joint
 * card. `ProductDomainEnum` holds the separate per-vertical domains and the old
 * shared umbrella value is RETIRED (HOS-692); a surface that grouped the two verticals would reintroduce
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
 *
 * The PRICE has a second non-degraded reason too, added by HOS-1212: an audience
 * that publishes no amount anywhere (`isPriceOnRequestAudience`). Partner is
 * that case as well, and unlike the trial its catalogue loads perfectly — the
 * figure is withheld by owner decision, not missing. See
 * `./price-on-request-audiences.ts` and {@link resolveAudienceStartingPrices}.
 */

import type { PricingAudience } from '../billing-i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '../pricing-plans';
import { AUDIENCE_PLAN_VERTICALS } from './audience-plan-verticals';
import type { FetchPlansResult, PublicPlanData } from './fetch-plans';
import { fetchPublicPlans } from './fetch-plans';
import { computeMinimumTrialDays } from './generic-trial-days';
import { isPriceOnRequestAudience } from './price-on-request-audiences';

/**
 * The audiences the plan index offers, in display order.
 *
 * `partner` is not one of them any more: its pricing and sales pages
 * (`/planes/aliados/*`) were removed with the old billing, and the Partner
 * offering has no subject until V7 (HOS-1637, AC:B13a:21). Nothing may link to
 * those URLs.
 */
export type AudienceCardId = 'host' | 'tourist' | 'venue' | 'experience';

/**
 * Display order of the audience cards.
 *
 * Host first and tourist second because those two are the conversion funnel the
 * rest of the site already points at; the three newer verticals follow.
 */
export const AUDIENCE_CARD_ORDER: readonly AudienceCardId[] = [
    'host',
    'tourist',
    'venue',
    'experience'
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
    venue: 'planes/comer-y-salir',
    experience: 'planes/experiencias'
} as const;

/**
 * The plan-vocabulary audience for each index card id.
 *
 * The ONE translation between this module's `AudienceCardId` (spelled `host`,
 * the index's vocabulary) and `PricingAudience` (spelled `owner`, the plan
 * plan presentation vocabulary — see `lib/billing-i18n.ts`). Every
 * other spelling of the same mapping would be a second place for the two to
 * drift; the five pricing pages read this one.
 */
export const PRICING_AUDIENCE_BY_CARD_ID: Readonly<Record<AudienceCardId, PricingAudience>> = {
    host: 'owner',
    tourist: 'tourist',
    venue: 'venue',
    experience: 'experience'
} as const;

/**
 * Inverse of {@link PRICING_AUDIENCE_BY_CARD_ID}. `partner` has no card (see
 * {@link AudienceCardId}).
 */
export const CARD_ID_BY_PRICING_AUDIENCE: Readonly<
    Record<Exclude<PricingAudience, 'partner'>, AudienceCardId>
> = {
    owner: 'host',
    tourist: 'tourist',
    venue: 'venue',
    experience: 'experience'
} as const;

/**
 * Fetch and select the plans of ONE audience, for that audience's pricing page.
 *
 * One request, not the four {@link fetchAudienceOffers} issues: a pricing page
 * renders a single audience and has no use for the other four catalogues.
 *
 * Selection goes through {@link selectAudiencePlans} so each audience reads
 * only the plans from its own vertical catalog. The catalog already contains
 * only current sellable plans, so this layer does not recreate catalog rules.
 *
 * The result is sorted cheapest-first (`sortOrder` ascending), which
 * `PricingCardsGrid` REQUIRES: it diffs each card against the one before it.
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
    const vertical = AUDIENCE_PLAN_VERTICALS[audience];
    const result = await fetchPublicPlans({ vertical });

    return (result.ok ? result.plans : [])
        .filter((plan) => plan.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The entry price an audience card advertises.
 *
 * `null` (absent, modelled outside this union) means "print no price line", and
 * since HOS-1212 it carries TWO meanings that callers must not try to separate:
 * the catalogue could not be read, and the audience publishes no amount at all
 * (aliados). Do not key a "we could not load prices right now" notice off it —
 * that message would sit on the aliados card permanently, describing a failure
 * that is not happening.
 *
 * `free` means the cheapest sellable plan for that audience really is free, and
 * is rendered as the free label rather than as "from $0".
 */
export type AudienceStartingPrice =
    | { readonly kind: 'free' }
    | { readonly kind: 'from'; readonly monthlyPriceArs: number };

/**
 * Starting price per audience; `null` where no price line is rendered — see
 * {@link AudienceStartingPrice} for the two unrelated reasons that produces.
 */
export type AudienceStartingPrices = Readonly<Record<AudienceCardId, AudienceStartingPrice | null>>;

/**
 * The cheapest active plan in a list, as an {@link AudienceStartingPrice}.
 *
 * A price of zero resolves to `free` rather than to "from $0" — the tourist
 * catalogue really does contain a free tier, and "from $0" reads as a rounding
 * artefact. The rule is uniform across audiences on purpose: it reports what the
 * catalogue says instead of special-casing which audience is allowed a free
 * tier.
 *
 * ## It reports the catalogue, so its answer is not publishable on its own
 *
 * Handed partner's plans it returns ARS 15.000 — true, and the exact figure no
 * public surface may print (HOS-1212). The suppression lives one level up, in
 * {@link resolveAudienceStartingPrices}, because that is where an AUDIENCE is
 * known; this function only ever sees a list of plans. Anything rendering a
 * price to a visitor must come through that function or consult
 * `isPriceOnRequestAudience` itself. Calling this one directly and printing the
 * result is how a fourth spelling of the same decision gets written.
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

/** The four vertical catalog responses needed by the plan index. */
export interface AudiencePlanResults {
    readonly accommodation: FetchPlansResult;
    readonly tourist: FetchPlansResult;
    readonly venue: FetchPlansResult;
    readonly experience: FetchPlansResult;
}

/** Unwrap a fetch result to its plan list, or an empty list when it failed. */
function plansOf(result: FetchPlansResult): readonly PublicPlanData[] {
    return result.ok ? result.plans : [];
}

/** Resolve each audience directly from its own vertical catalog. */
export function selectAudiencePlans(
    results: AudiencePlanResults
): Readonly<Record<AudienceCardId, readonly PublicPlanData[]>> {
    return {
        host: plansOf(results.accommodation),
        tourist: plansOf(results.tourist),
        venue: plansOf(results.venue),
        experience: plansOf(results.experience)
    };
}

/**
 * Derive every audience's starting price from four already-resolved plan
 * payloads.
 *
 * Split from {@link fetchAudienceOffers} so the mapping — including every
 * degraded path — is exercisable without a network.
 *
 * ## A price-on-request audience resolves to `null` even when its plans loaded
 *
 * This is the HOS-1212 fix and it is not a degraded path: partner's catalogue
 * loads fine, `partner-silver` really does sit at ARS 15.000, and the card must
 * still print no figure — because both pages behind that card withhold it by
 * owner decision. The index rendering "Desde $ 15.000 /mes" while
 * `/planes/aliados/` and `/planes/aliados/precios/` said "Consultar" is exactly
 * what HOS-985's AC-43 forbids.
 *
 * The suppression is applied HERE and not in the page's `priceLabelFor`, so the
 * value the index maps over is already the truth. A page filtering a real price
 * out at render time would leave `startingPrices.partner` holding an amount that
 * the next consumer of this function would publish.
 *
 * It coincides with the "could not be resolved" `null` on purpose: both mean the
 * card shows no price line, and the card must not be able to tell them apart.
 *
 * @param results - The four resolved fetches, see {@link AudiencePlanResults}.
 * @returns Starting price per audience, `null` where it could not be resolved or
 *   where the audience publishes no amount at all.
 */
export function resolveAudienceStartingPrices(
    results: AudiencePlanResults
): AudienceStartingPrices {
    const byAudience = selectAudiencePlans(results);

    return Object.fromEntries(
        AUDIENCE_CARD_ORDER.map((id) => [
            id,
            isPriceOnRequestAudience({ audience: PRICING_AUDIENCE_BY_CARD_ID[id] })
                ? null
                : resolveStartingPrice({ plans: byAudience[id] })
        ])
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
 * An audience whose starting price is `free` resolves to `null` too: its card
 * advertises the free tier, and a trial badge there contradicts it (HOS-1766).
 *
 * @param results - The four resolved fetches, see {@link AudiencePlanResults}.
 * @returns Trial days per audience, `null` where no trial may be advertised.
 */
export function resolveAudienceTrialDays(results: AudiencePlanResults): AudienceTrialDays {
    const byAudience = selectAudiencePlans(results);

    return Object.fromEntries(
        AUDIENCE_CARD_ORDER.map((id) => [
            id,
            // A card that leads with "Gratis" must not also say "30 días de
            // prueba gratis": the trial belongs to a paid tier the card is not
            // selling, and the two lines contradict each other (HOS-1766).
            // Data-driven off the same starting price the card prints, never a
            // card name, so it follows the catalogue.
            resolveStartingPrice({ plans: byAudience[id] })?.kind === 'free'
                ? null
                : computeMinimumTrialDays({ plans: byAudience[id] })
        ])
    ) as AudienceTrialDays;
}

/**
 * Fetch every audience's starting price AND trial length from the public plan catalog.
 *
 * Four requests, issued concurrently — the same four whether the caller wants
 * the price, the trial or both. Price and trial are two readings of one
 * catalogue, so they are resolved from a SINGLE round of fetches; asking twice
 * would double the request count and open a window where the two lines on one
 * card describe different snapshots of the catalogue.
 *
 * `fetchPublicPlans` never rejects, so a failing vertical degrades to `null` for
 * that audience alone — on both readings — and leaves the other four intact.
 *
 * SSR-only: called from `/suscriptores/planes/index.astro`'s frontmatter. It
 * imports `@repo/billing` at runtime, which is why nothing reachable from a
 * client island may import this module (see the HOS-360 barrel guard).
 *
 * @returns Price and trial per audience, `null` where either is unresolvable.
 */
export async function fetchAudienceOffers(): Promise<AudienceOffers> {
    const [accommodation, tourist, venue, experience] = await Promise.all(
        Object.values(AUDIENCE_PLAN_VERTICALS).map((vertical) => fetchPublicPlans({ vertical }))
    );

    const results: AudiencePlanResults = { accommodation, tourist, venue, experience };

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
