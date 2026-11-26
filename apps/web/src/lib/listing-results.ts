import type { SupportedLocale } from './i18n';
import { createTranslations } from './i18n';

/** Result nouns used by public listing pages. */
export type ListingKind =
    | 'accommodations'
    | 'venues'
    | 'experiences'
    | 'events'
    | 'posts'
    | 'results';

/** Build the localized result caption; empty states supply their own message. */
export function buildListingSummary({
    locale,
    kind,
    count,
    facetLabel
}: {
    readonly locale: SupportedLocale;
    readonly kind: ListingKind;
    readonly count?: number;
    readonly facetLabel?: string;
}): string | undefined {
    if (count === undefined || count <= 0) return undefined;
    const { t, tPlural } = createTranslations(locale);
    const results = tPlural(`ui.listing.${kind}`, count);
    return facetLabel ? t('ui.listing.facet', undefined, { results, facet: facetLabel }) : results;
}
