/**
 * @file venue/business-line-collection.ts
 * @description Pure helpers for the venue business-line collections
 * (`/{locale}/comer-y-salir/rubro/<slug>/`, HOS-1787 leaf 6.8).
 *
 * The route segment is the Spanish slug; the API filter is the internal catalog
 * value in English. Both directions live in the `@repo/schemas` catalog map, so
 * this module never writes a slug of its own and never compares a business line
 * (G-FAC-03). The page, the sitemap and the menu consume these helpers so the
 * three agree on what a valid collection is.
 *
 * Every function is RO-RO and side-effect free.
 */

import {
    type BusinessLineUrlSlug,
    businessLineToUrlSlug,
    type PublicBusinessLine,
    urlSlugToBusinessLine
} from '@repo/schemas';
import { buildUrl } from '@/lib/urls';
import type { SupportedLocale } from '../i18n';

/** A resolved business-line collection: its internal value and canonical slug. */
export interface VenueBusinessLineCollection {
    /** Internal catalog value used as the API filter. */
    readonly businessLine: PublicBusinessLine;
    /** Canonical Spanish URL slug for the collection. */
    readonly urlSlug: BusinessLineUrlSlug;
}

/**
 * Resolves a route segment to its business-line collection.
 *
 * An absent, empty or unknown segment — including a differently-cased slug and
 * the internal English value — yields `null`, so the caller can answer 404.
 * The returned slug is re-derived from the catalog value rather than echoing
 * the parameter, which keeps the canonical URL exact.
 *
 * @param input - The route segment to resolve.
 * @param input.urlSlug - The raw `[rubro]` segment, unvalidated.
 * @returns The resolved collection, or `null` when the slug is not a public
 *   business line.
 */
export function resolveVenueBusinessLineCollection({
    urlSlug
}: {
    readonly urlSlug: string | undefined;
}): VenueBusinessLineCollection | null {
    if (urlSlug === undefined || urlSlug.length === 0) return null;

    const { value } = urlSlugToBusinessLine({ urlSlug });
    if (!value) return null;

    const { urlSlug: canonicalUrlSlug } = businessLineToUrlSlug({ value });
    return { businessLine: value, urlSlug: canonicalUrlSlug };
}

/**
 * Builds the locale-prefixed path of a business-line collection.
 *
 * The slug comes from the catalog, never from a literal in this module, so a
 * renamed slug propagates everywhere it is linked.
 *
 * @param input - The path to build.
 * @param input.locale - Active locale.
 * @param input.businessLine - Internal catalog value of the collection.
 * @returns The path with its trailing slash, e.g. `/en/comer-y-salir/rubro/noche/`.
 */
export function buildVenueBusinessLineCollectionPath({
    locale,
    businessLine
}: {
    readonly locale: SupportedLocale;
    readonly businessLine: PublicBusinessLine;
}): string {
    const { urlSlug } = businessLineToUrlSlug({ value: businessLine });
    return buildUrl({ locale, path: `comer-y-salir/rubro/${urlSlug}` });
}
