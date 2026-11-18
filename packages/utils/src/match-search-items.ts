/**
 * @file match-search-items.ts
 * @description Pure, browser-safe keyword search over a flat list of items that carry
 * multilingual names and keywords (HOS-2340, extracted from the HOS-919 web matcher).
 *
 * An item matches when EVERY query token is a prefix of some word in its haystack
 * (name and keywords in the requested locales). Text is normalized with NFD,
 * diacritics stripped and lowercased, so «AIRE» and «aíre» both match «Climatización»
 * through an «aire acondicionado» keyword. Items whose NAME matches rank before items
 * that only match through a keyword; ties keep the input order.
 */

/** Locales the searchable terms can be provided in. */
export type SearchLocale = 'es' | 'en' | 'pt';

/** Multilingual terms of one searchable item. */
export interface SearchableTerms {
    /** Display name per locale. */
    readonly nameI18n: Partial<Record<SearchLocale, string | null | undefined>>;
    /** Related words per locale. Optional. */
    readonly keywordsI18n?: Partial<Record<SearchLocale, readonly string[] | undefined>>;
}

/** Input of {@link matchSearchItems}. */
export interface MatchSearchItemsInput<T> {
    /** Items to filter, already in their preferred order. */
    readonly items: readonly T[];
    /** Raw text typed by the user. Blank returns the items unchanged. */
    readonly query: string;
    /** Locales to search (the caller decides, e.g. the UI locale plus Spanish). */
    readonly locales: readonly SearchLocale[];
    /** Extracts the searchable terms of an item. */
    readonly getTerms: (item: T) => SearchableTerms;
}

const DIACRITICS = /\p{M}/gu;
const WHITESPACE = /\s+/;

/**
 * Normalizes text for comparison: NFD, strips combining marks, lowercases,
 * trims and collapses whitespace.
 *
 * @param text - Raw text
 * @returns The normalized text
 */
export const normalizeSearchText = (text: string): string =>
    text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();

const toWords = (text: string): readonly string[] =>
    normalizeSearchText(text)
        .split(WHITESPACE)
        .filter((word) => word.length > 0);

const everyTokenPrefixes = (tokens: readonly string[], words: readonly string[]): boolean =>
    tokens.every((token) => words.some((word) => word.startsWith(token)));

/** Rank of a matching item: 0 = name match, 1 = keyword match, null = none. */
const rankTerms = (
    terms: SearchableTerms,
    tokens: readonly string[],
    locales: readonly SearchLocale[]
): 0 | 1 | null => {
    const nameWords = locales.flatMap((locale) => toWords(terms.nameI18n[locale] ?? ''));
    if (everyTokenPrefixes(tokens, nameWords)) return 0;

    const keywordWords = locales.flatMap((locale) =>
        (terms.keywordsI18n?.[locale] ?? []).flatMap((keyword) => toWords(keyword))
    );
    if (everyTokenPrefixes(tokens, [...nameWords, ...keywordWords])) return 1;
    return null;
};

/**
 * Filters and ranks items for a typed query.
 *
 * @param input - Items, raw query, locales to search and the terms accessor
 * @returns The matching items: name matches first, then keyword matches, each in
 * input order. A blank query returns the items unchanged. The input is never mutated.
 *
 * @example
 * ```ts
 * matchSearchItems({
 *   items: categories,
 *   query: 'pozo',
 *   locales: ['es'],
 *   getTerms: (c) => ({ nameI18n: c.nameI18n, keywordsI18n: c.keywordsI18n })
 * });
 * ```
 */
export function matchSearchItems<T>(input: MatchSearchItemsInput<T>): T[] {
    const { items, query, locales, getTerms } = input;
    const tokens = toWords(query);
    if (tokens.length === 0) return [...items];

    return items
        .map((item, index) => ({ item, index, rank: rankTerms(getTerms(item), tokens, locales) }))
        .filter((entry): entry is { item: T; index: number; rank: 0 | 1 } => entry.rank !== null)
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((entry) => entry.item);
}
