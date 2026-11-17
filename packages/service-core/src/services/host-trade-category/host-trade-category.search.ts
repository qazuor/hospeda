import { escapeLikePattern } from '@repo/db';
import { type SQL, sql } from 'drizzle-orm';

/** Locales the catalog stores translated text for. */
const CATALOG_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Columns a catalog table exposes to the admin text search. Typed as
 * `SQL.Aliased`-free `SQLWrapper`-compatible values: Drizzle columns are
 * accepted directly by the `sql` template.
 */
export interface CatalogSearchColumns {
    /** The `slug` column. */
    readonly slug: object;
    /** The `name_i18n` jsonb column. */
    readonly nameI18n: object;
    /** The `keywords_i18n` jsonb column (categories only). */
    readonly keywordsI18n?: object;
}

/**
 * Builds the admin text-search condition for the provider-trade catalog.
 *
 * Matches the slug, every locale's name and (for categories) every locale's
 * keyword list, accent-insensitively. Per-locale extraction is deliberate: a
 * plain `name_i18n::text` match would also hit the JSON KEYS, so searching
 * `en` would return every row. The term goes through {@link escapeLikePattern},
 * so `%`, `_` and `\` match literally, exactly as `safeIlike` does for plain
 * columns.
 *
 * @param input - The search term and the columns to search.
 * @returns The OR condition, or `undefined` when the term is blank.
 *
 * @example
 * ```ts
 * buildCatalogSearchCondition({ term: 'plom', columns: hostTradeCategories });
 * ```
 */
export function buildCatalogSearchCondition(input: {
    readonly term: string | undefined;
    readonly columns: CatalogSearchColumns;
}): SQL | undefined {
    const trimmed = input.term?.trim();
    if (!trimmed) return undefined;

    const pattern = `%${escapeLikePattern(trimmed)}%`;
    const { slug, nameI18n, keywordsI18n } = input.columns;
    const like = (expr: SQL): SQL => sql`unaccent(${expr}) ILIKE unaccent(${pattern}::text)`;

    const conditions: SQL[] = [like(sql`${slug}::text`)];
    for (const locale of CATALOG_LOCALES) {
        conditions.push(like(sql`(${nameI18n} ->> ${locale})`));
        if (keywordsI18n) {
            conditions.push(like(sql`(${keywordsI18n} -> ${locale})::text`));
        }
    }
    return sql`(${sql.join(conditions, sql` OR `)})`;
}
