/**
 * @file match-catalog-query.ts
 * @description Thin adapter over the shared flat-item matcher (`matchSearchItems` in
 * `@repo/utils`, HOS-2340) for the nested public provider trade catalog (HOS-919).
 *
 * A category matches when EVERY query token is a prefix of some word in its
 * haystack. The haystack is the name and keywords in the current locale plus
 * the same in Spanish (Argentine users type Spanish on any locale). Text is
 * normalized with NFD, diacritics stripped and lowercased, so «AIRE» and
 * «aíre» both find «Climatización» through its «aire acondicionado» keyword.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import { matchSearchItems } from '@repo/utils';

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

/** Distinct locales to search: the current one plus Spanish. */
const searchedLocales = (locale: CatalogLocale): readonly CatalogLocale[] =>
    locale === 'es' ? ['es'] : [locale, 'es'];

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
    if (query.trim().length === 0) return { groups: catalog.groups };

    const locales = searchedLocales(locale);

    const groups = catalog.groups.flatMap((group) => {
        const categories = matchSearchItems({
            items: group.categories,
            query,
            locales,
            getTerms: (category) => ({
                nameI18n: category.nameI18n,
                keywordsI18n: category.keywordsI18n
            })
        });
        return categories.length === 0 ? [] : [{ ...group, categories }];
    });

    return { groups };
}
