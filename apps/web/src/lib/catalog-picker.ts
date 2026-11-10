/**
 * @file catalog-picker.ts
 * @description Pure view logic of the shared amenity/feature catalog picker
 * (HOS-2061): the featured-first section, the per-category "show all"
 * accordions and the client-side search over the LOCALIZED labels.
 *
 * Kept out of the component so the three owner editors (accommodation, venue,
 * experience) share one behavior and so search and grouping are unit-tested
 * without rendering anything.
 *
 * @module lib/catalog-picker
 */

import type { AmenityData } from '@/lib/api/types';
import type { CategoryGroup } from '@/lib/catalog-categories';

/** Groups a flat item list into ordered category groups. */
export type CatalogGrouper = (
    items: readonly AmenityData[]
) => readonly CategoryGroup<AmenityData>[];

/** Resolves the localized display label of one catalog item. */
export type CatalogLabeler = (item: AmenityData) => string;

/** What the picker renders for one catalog (amenities or features). */
export interface CatalogPickerView {
    /** Featured items, highest `displayWeight` first. Empty while searching. */
    readonly featured: readonly AmenityData[];
    /**
     * Category groups. Without a query they hold the NON-featured items (the
     * featured ones are already on screen above them); with a query they hold
     * every match, featured or not.
     */
    readonly groups: readonly CategoryGroup<AmenityData>[];
    /** Whether a non-blank query is active. */
    readonly isSearching: boolean;
    /** Number of items matching the query (all items when not searching). */
    readonly matchCount: number;
}

/** Default catalog weight, the same default the `amenities`/`features` columns use. */
const DEFAULT_DISPLAY_WEIGHT = 50;

/**
 * Normalizes text for accent- and case-insensitive matching: "Calefacción"
 * and "calefaccion" compare equal.
 *
 * @param params.text - Raw text
 * @returns Lower-cased text without diacritics and surrounding whitespace
 */
export function normalizeCatalogSearchText({ text }: { readonly text: string }): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

/** Minimum token length for inflection stemming; shorter words stay exact. */
const MIN_STEM_TOKEN_LENGTH = 4;

/**
 * Strips Spanish plural and gender endings from an already-normalized word: a
 * trailing `s`, then a trailing `o`, `a` or `e`. Words shorter than
 * {@link MIN_STEM_TOKEN_LENGTH} are returned unchanged ("wifi", "spa", "bar").
 *
 * @param params.word - Normalized word
 * @returns The stem used to compare inflected variants
 */
function stemSpanishWord({ word }: { readonly word: string }): string {
    if (word.length < MIN_STEM_TOKEN_LENGTH) return word;
    return word.replace(/s$/, '').replace(/[oae]$/, '');
}

/**
 * Whether an item matches a query. Matches against the localized label (what
 * the owner reads) and, as a fallback, the slug with separators read as
 * spaces. Every whitespace-separated query term must appear, either as a
 * substring or as an inflection-tolerant prefix of a label word ("vegano"
 * finds "veganas").
 *
 * @param params.item - Catalog item
 * @param params.query - Raw query typed by the owner
 * @param params.getLabel - Localized label resolver
 * @returns `true` when every term of the query is found
 */
export function matchesCatalogQuery({
    item,
    query,
    getLabel
}: {
    readonly item: AmenityData;
    readonly query: string;
    readonly getLabel: CatalogLabeler;
}): boolean {
    const terms = normalizeCatalogSearchText({ text: query }).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const haystack = normalizeCatalogSearchText({
        text: `${getLabel(item)} ${item.slug.replace(/[-_]+/g, ' ')}`
    });
    const words = haystack.split(/\s+/).filter(Boolean);
    const stems = words.map((word) => stemSpanishWord({ word }));
    return terms.every((term) => {
        if (haystack.includes(term)) return true;
        if (term.length < MIN_STEM_TOKEN_LENGTH) return false;
        const termStem = stemSpanishWord({ word: term });
        return stems.some((stem) => stem.startsWith(termStem));
    });
}

/**
 * Featured items, ordered by `displayWeight` (highest first) and then by label
 * so equal weights render in a stable order.
 *
 * @param params.items - Catalog items
 * @param params.getLabel - Localized label resolver (tie-breaker)
 * @returns The featured subset, ordered
 */
export function selectFeaturedCatalogItems({
    items,
    getLabel
}: {
    readonly items: readonly AmenityData[];
    readonly getLabel: CatalogLabeler;
}): readonly AmenityData[] {
    return items
        .filter((item) => item.isFeatured === true)
        .sort((a, b) => {
            const weight =
                (b.displayWeight ?? DEFAULT_DISPLAY_WEIGHT) -
                (a.displayWeight ?? DEFAULT_DISPLAY_WEIGHT);
            return weight === 0 ? getLabel(a).localeCompare(getLabel(b)) : weight;
        });
}

/**
 * Builds what the picker renders for one catalog.
 *
 * @param params.items - Catalog items (already scoped to the vertical)
 * @param params.query - Current search query (blank = not searching)
 * @param params.getLabel - Localized label resolver
 * @param params.group - Category grouper (amenity or feature taxonomy)
 * @returns The featured section and the category groups to render
 */
export function buildCatalogPickerView({
    items,
    query,
    getLabel,
    group
}: {
    readonly items: readonly AmenityData[];
    readonly query: string;
    readonly getLabel: CatalogLabeler;
    readonly group: CatalogGrouper;
}): CatalogPickerView {
    const isSearching = normalizeCatalogSearchText({ text: query }).length > 0;

    if (isSearching) {
        const matches = items.filter((item) => matchesCatalogQuery({ item, query, getLabel }));
        return { featured: [], groups: group(matches), isSearching, matchCount: matches.length };
    }

    const featured = selectFeaturedCatalogItems({ items, getLabel });
    const featuredIds = new Set(featured.map((item) => item.id));
    const rest = items.filter((item) => !featuredIds.has(item.id));
    return { featured, groups: group(rest), isSearching, matchCount: items.length };
}
