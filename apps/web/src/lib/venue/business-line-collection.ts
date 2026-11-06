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
    listPublicBusinessLines,
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
 * Lists every public venue business-line collection, in catalog order.
 *
 * The catalog is read through `listPublicBusinessLines`, never imported here:
 * G-FAC-03 keeps the catalog value behind a closed allowlist, and the sitemap
 * needs exactly the same set the page resolves against.
 *
 * @returns Every public venue collection with its internal value and canonical
 *   slug.
 */
export function listVenueBusinessLineCollections(): readonly VenueBusinessLineCollection[] {
    return listPublicBusinessLines({ vertical: 'venue' }).map(({ value }) => ({
        businessLine: value,
        urlSlug: businessLineToUrlSlug({ value }).urlSlug
    }));
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
 * @returns The path with its trailing slash, e.g. `/<lang>/comer-y-salir/rubro/<slug>/`.
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

/**
 * Builds the locale-agnostic sitemap path of a business-line collection.
 *
 * The sitemap emits one entry per locale by prefixing this path itself, so the
 * returned value has no locale. It always carries a leading and trailing slash.
 *
 * @param input - The path to build.
 * @param input.businessLine - Internal catalog value of the collection.
 * @returns The path, e.g. `/comer-y-salir/rubro/<slug>/`.
 */
export function buildVenueBusinessLineCollectionSitemapPath({
    businessLine
}: {
    readonly businessLine: PublicBusinessLine;
}): string {
    const { urlSlug } = businessLineToUrlSlug({ value: businessLine });
    return `/comer-y-salir/rubro/${urlSlug}/`;
}

/**
 * Decides whether a collection page has nothing to index.
 *
 * A failed API request is NOT an empty collection: a transient 5xx must not
 * drop the page out of the index (`listPublicBusinessLines` / the sitemap has
 * the same rule). Only a successful request that reports zero results is empty.
 *
 * @param input - The fetch outcome.
 * @param input.fetchOk - Whether the collection fetch succeeded.
 * @param input.total - Total results reported by that fetch.
 * @returns `true` only when the fetch succeeded and the total is zero.
 */
export function isVenueCollectionEmpty({
    fetchOk,
    total
}: {
    readonly fetchOk: boolean;
    readonly total: number;
}): boolean {
    return fetchOk && total === 0;
}
