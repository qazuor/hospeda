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
 * The single source of truth for the two URLs HOS-942 moved. It sits in this
 * module — which imports nothing beyond a type — rather than in
 * `billing/audience-plans.ts`, so the two `.astro` components that mount
 * `<PlanPurchaseButton>` can read it without pulling the `@repo/billing`
 * barrel into their graph.
 *
 * Keyed by `PricingAudience` (`'owner' | 'tourist'`, from `billing-i18n.ts`).
 * The key is spelled `owner` and the URL segment `anfitriones`: the former is
 * the plan CATEGORY, the latter is the Spanish route, and they are not the same
 * vocabulary.
 */
export const PRICING_PAGE_PATH_BY_AUDIENCE = {
    owner: 'suscriptores/planes/anfitriones',
    tourist: 'suscriptores/planes/turistas'
} as const satisfies Readonly<Record<'owner' | 'tourist', string>>;

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
