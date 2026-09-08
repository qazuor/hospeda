/**
 * @file billing/price-on-request-audiences.ts
 * @description Which audiences publish NO amount anywhere on the public web
 * (HOS-1212).
 *
 * Aliados is the one, and the owner's reason is on the record: the Municipality
 * of Concepción del Uruguay and the corner shop are not charged the same, even
 * taking the same level and receiving the same deliverables. Publishing a figure
 * would not be simplifying — it would be publishing a price half the book is
 * never quoted. The approved commercial presentation says it in its own words
 * ("los valores vigentes te los pasamos en la charla").
 *
 * ## Why this is a module and not three comparisons
 *
 * That decision was implemented three times, in three vocabularies, and the
 * third one was never written:
 *
 * 1. `/planes/aliados/precios/` passed the literal `priceMode="consult"`.
 * 2. `buildBillingFaq` branched on `audience === 'partner'` to replace "can I
 *    try it before paying" with "why is there no price".
 * 3. The plan INDEX at `/suscriptores/planes/` did nothing at all, and happily
 *    rendered "Desde $ 15.000 /mes" on the aliados card — read correctly from
 *    `billing_plans`, where `partner-silver` really does sit at ARS 15.000.
 *
 * So the index promised a number and both pages behind it withheld one. A
 * visitor who clicked BECAUSE of the figure landed on a screen telling them to
 * ask. That is HOS-985's AC-43 ("ninguna tarjeta del índice promete algo que su
 * destino no entregue") failing in the most literal way available, and it could
 * not be seen from any one of the three sites — which is the argument for the
 * predicate living here instead of being re-expressed at each of them.
 *
 * ## What it does NOT do
 *
 * It hides the AMOUNT, never the offer. Aliados still fetches its plans, still
 * renders a silver and a gold card, and still sends the visitor to the lead
 * form — the catalogue is what those cards are built from. Emptying the plan
 * list instead of suppressing the price would take the whole page down with the
 * figure.
 *
 * Nor does it reach the checkout: partner subscriptions are admin-mediated
 * (an admin assigns the plan and sends a MercadoPago link out of band), so
 * nothing here is a payment gate. This module governs published COPY.
 */

import type { PricingAudience } from '../billing-i18n';

/**
 * Audiences whose price is quoted in a conversation, never on the site.
 *
 * A set rather than a boolean helper's `=== 'partner'`, so a second audience
 * joining this rule is one entry and no new branch anywhere.
 */
export const PRICE_ON_REQUEST_AUDIENCES: ReadonlySet<PricingAudience> = new Set<PricingAudience>([
    'partner'
]);

/**
 * Whether an audience's amounts are withheld from every public surface.
 *
 * @param params.audience - The audience in plan vocabulary (`owner`, `tourist`,
 *   `gastronomy`, `experience`, `partner`). Index-card ids are translated by
 *   `PRICING_AUDIENCE_BY_CARD_ID` before reaching here.
 * @returns `true` when no surface may render one of its amounts.
 */
export function isPriceOnRequestAudience({
    audience
}: {
    readonly audience: PricingAudience;
}): boolean {
    return PRICE_ON_REQUEST_AUDIENCES.has(audience);
}

/**
 * How a pricing card renders where the amount would go.
 *
 * `'consult'` replaces the figure — and, with it, the annual toggle and the
 * discount anchor, which have nothing to switch between without one.
 */
export type PricingPriceMode = 'amount' | 'consult';

/**
 * The `priceMode` a `/planes/<audiencia>/precios/` page must pass to its grid.
 *
 * Derived rather than written at the page, so the page that shows "Consultar"
 * and the index that links to it cannot disagree about whether that audience
 * has a published price.
 *
 * @param params.audience - The page's audience.
 * @returns `'consult'` for a price-on-request audience, `'amount'` otherwise.
 */
export function resolvePriceMode({
    audience
}: {
    readonly audience: PricingAudience;
}): PricingPriceMode {
    return isPriceOnRequestAudience({ audience }) ? 'consult' : 'amount';
}
