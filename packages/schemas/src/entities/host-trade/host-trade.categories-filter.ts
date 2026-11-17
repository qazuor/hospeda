import { z } from 'zod';

/** Maximum number of category slugs accepted by the `categories` list filter. */
export const HOST_TRADE_CATEGORIES_FILTER_MAX = 30;

/**
 * `categories` list filter shared by the public query and the admin search
 * (HOS-919): a comma-separated slug list on the wire, a `string[]` after
 * parsing. An empty string parses to `[]`; an absent key stays `undefined`.
 * Slugs are not validated against the catalog here: an unknown slug simply
 * matches no provider.
 *
 * @example
 * ```ts
 * HostTradeCategoriesFilterSchema.parse('plomeria,gas'); // ['plomeria', 'gas']
 * ```
 */
export const HostTradeCategoriesFilterSchema = z
    .string()
    .transform((value) =>
        value
            .split(',')
            .map((slug) => slug.trim())
            .filter(Boolean)
    )
    .pipe(
        z.array(z.string().min(1).max(100)).max(HOST_TRADE_CATEGORIES_FILTER_MAX, {
            message: 'zodError.hostTrade.categories.max'
        })
    )
    .optional()
    .describe('Filter by catalog category slugs (comma-separated list, any-of)');
