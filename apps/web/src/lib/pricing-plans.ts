/**
 * @file pricing-plans.ts
 * @description Shared helpers for the subscriber pricing pages
 * (/suscriptores/planes/anfitriones/, /suscriptores/planes/turistas/).
 *
 * The pricing pages and the <PricingCardsGrid> component all need to map a
 * supported app locale to a BCP47 tag for Intl currency formatting. Keeping
 * the mapping here avoids divergence between consumers.
 */

import type { SupportedLocale } from './i18n';

/**
 * Where each pricing audience's catalogue lives, as a locale-agnostic path.
 *
 * The single source of truth for these URLs. It sits in this module — which
 * imports nothing beyond a type — rather than in `billing/audience-plans.ts`,
 * so the `.astro` components and `.client.tsx` islands that need a pricing URL
 * can read it without pulling the `@repo/billing` barrel into their graph.
 *
 * Keyed by `PricingAudience` (five values since HOS-1032, from
 * `billing-i18n.ts`). The key is spelled `owner` and the URL segment
 * `anfitriones`: the former is the plan CATEGORY, the latter is the Spanish
 * route, and they are not the same vocabulary.
 *
 * HOS-1032 moved all five under the `/planes/` namespace (HOS-941 D-8) and gave
 * the three verticals that never had one a pricing URL of their own. Editing
 * this map is what moves them: `AUDIENCE_CARD_PATHS` (the index's five cards),
 * `PlanPurchaseButton`'s post-signin return path, `account-roles.ts`, both
 * comparison tables and five account-side upsell islands all read it, so none
 * of them can point at a URL the pages no longer serve.
 *
 * The two accommodation entries CHANGED value here — they used to read
 * `suscriptores/planes/<audiencia>`, which now 301s to these. Anything that
 * still needs the old string is a redirect page, and those spell it literally.
 *
 * `test/lib/pricing-page-paths.test.ts` freezes these five values, checks each
 * resolves to a page file that exists, and fails if any is pointed back at a
 * retired URL. It is the ONE place the literals are asserted.
 */
export const PRICING_PAGE_PATH_BY_AUDIENCE = {
    owner: 'planes/anfitriones/precios',
    tourist: 'planes/turistas/precios',
    gastronomy: 'planes/gastronomia/precios',
    experience: 'planes/experiencias/precios',
    partner: 'planes/aliados/precios'
} as const satisfies Readonly<
    Record<'owner' | 'tourist' | 'gastronomy' | 'experience' | 'partner', string>
>;

/** Map app locale codes to BCP47 tags used by Intl.NumberFormat / DateTimeFormat. */
const BCP47_BY_LOCALE: Record<SupportedLocale, string> = {
    es: 'es-AR',
    en: 'en-AR',
    pt: 'pt-BR'
};

/**
 * Resolve the BCP47 locale tag for Intl currency/date formatting from an app
 * locale code. Falls back to es-AR (the default Argentina market locale).
 *
 * @param locale - Supported app locale (`es` | `en` | `pt`)
 * @returns BCP47 locale tag (e.g. `es-AR`)
 */
export function getIntlLocale(locale: SupportedLocale): string {
    return BCP47_BY_LOCALE[locale] ?? 'es-AR';
}
