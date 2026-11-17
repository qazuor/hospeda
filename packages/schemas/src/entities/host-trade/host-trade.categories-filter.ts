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
 * The schema is IDEMPOTENT: an already-parsed `string[]` is accepted as well.
 * Services re-validate their search input with the same schema the route
 * already applied, so rejecting the parsed form would make every list call
 * through the API fail.
 *
 * @example
 * ```ts
 * HostTradeCategoriesFilterSchema.parse('plomeria,gas'); // ['plomeria', 'gas']
 * ```
 */
export const HostTradeCategoriesFilterSchema = z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
        (Array.isArray(value) ? value : value.split(',')).map((slug) => slug.trim()).filter(Boolean)
    )
    .pipe(
        z.array(z.string().min(1).max(100)).max(HOST_TRADE_CATEGORIES_FILTER_MAX, {
            message: 'zodError.hostTrade.categories.max'
        })
    )
    .optional()
    .describe('Filter by catalog category slugs (comma-separated list, any-of)');
