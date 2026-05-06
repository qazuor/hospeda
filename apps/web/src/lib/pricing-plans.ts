/**
 * @file pricing-plans.ts
 * @description Shared helpers for the subscriber pricing pages
 * (/suscriptores/planes/, /suscriptores/turistas/).
 *
 * The pricing pages and the <PricingCardsGrid> component all need to map a
 * supported app locale to a BCP47 tag for Intl currency formatting. Keeping
 * the mapping here avoids divergence between consumers.
 */

import type { SupportedLocale } from './i18n';

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
