/**
 * @file match-catalog-query.ts
 * @description Pure search over the provider trade category catalog (HOS-919).
 *
 * A category matches when EVERY query token is a prefix of some word in its
 * haystack. The haystack is the name and keywords in the current locale plus
 * the same in Spanish (Argentine users type Spanish on any locale). Text is
 * normalized with NFD, diacritics stripped and lowercased, so «AIRE» and
 * «aíre» both find «Climatización» through its «aire acondicionado» keyword.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';

/** Locales the catalog carries names and keywords for. */
export type CatalogLocale = 'es' | 'en' | 'pt';

/** Input of {@link matchCatalogQuery}. */
export interface MatchCatalogQueryInput {
    /** The public catalog (groups with their categories, already ordered). */
    readonly catalog: PublicHostTradeCatalog;
    /** Raw text typed by the user. Blank returns the catalog unchanged. */
    readonly query: string;
    /** Current UI locale. Spanish is always searched in addition. */
    readonly locale: CatalogLocale;
}

/** Result of {@link matchCatalogQuery}: only groups with at least one match. */
export interface MatchCatalogQueryResult {
    readonly groups: PublicHostTradeCatalog['groups'];
}

type CatalogCategory = PublicHostTradeCatalog['groups'][number]['categories'][number];

const DIACRITICS = /\p{M}/gu;
const WHITESPACE = /\s+/;

/**
 * Normalizes text for comparison: NFD, strips combining marks, lowercases,
 * trims and collapses whitespace.
 */
const normalize = (text: string): string =>
    text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Splits normalized text into words, dropping empties. */
const toWords = (text: string): readonly string[] =>
    normalize(text)
        .split(WHITESPACE)
        .filter((word) => word.length > 0);

/** True when every token is a prefix of at least one word. */
const everyTokenPrefixes = (tokens: readonly string[], words: readonly string[]): boolean =>
    tokens.every((token) => words.some((word) => word.startsWith(token)));

/** Distinct locales to search: the current one plus Spanish. */
const searchedLocales = (locale: CatalogLocale): readonly CatalogLocale[] =>
    locale === 'es' ? ['es'] : [locale, 'es'];

/** Rank of a matching category: 0 = name match, 1 = keyword match, null = none. */
const rankCategory = (
    category: CatalogCategory,
    tokens: readonly string[],
    locales: readonly CatalogLocale[]
): 0 | 1 | null => {
    const nameWords = locales.flatMap((locale) => toWords(category.nameI18n[locale] ?? ''));
    if (everyTokenPrefixes(tokens, nameWords)) return 0;

    const keywordWords = locales.flatMap((locale) =>
        (category.keywordsI18n[locale] ?? []).flatMap((keyword) => toWords(keyword))
    );
    if (everyTokenPrefixes(tokens, [...nameWords, ...keywordWords])) return 1;
    return null;
};

/**
 * Filters and ranks the catalog for a typed query.
 *
 * Ranking inside a group: name-prefix matches first, then keyword matches,
 * then catalog order (stable). Groups without matches are removed and group
 * order is preserved. The input is never mutated.
 *
 * @param input - Catalog, raw query and current locale
 * @returns The matching groups
 *
 * @example
 * ```ts
 * matchCatalogQuery({ catalog, query: 'pozo', locale: 'es' });
 * // { groups: [{ slug: 'hogar', categories: [destapaciones-desagotes] }] }
 * ```
 */
export function matchCatalogQuery(input: MatchCatalogQueryInput): MatchCatalogQueryResult {
    const { catalog, query, locale } = input;
    const tokens = toWords(query);
    if (tokens.length === 0) return { groups: catalog.groups };

    const locales = searchedLocales(locale);

    const groups = catalog.groups.flatMap((group) => {
        const ranked = group.categories
            .map((category, index) => ({
                category,
                index,
                rank: rankCategory(category, tokens, locales)
            }))
            .filter(
                (entry): entry is { category: CatalogCategory; index: number; rank: 0 | 1 } =>
                    entry.rank !== null
            )
            .sort((a, b) => a.rank - b.rank || a.index - b.index);

        return ranked.length === 0
            ? []
            : [{ ...group, categories: ranked.map((entry) => entry.category) }];
    });

    return { groups };
}
