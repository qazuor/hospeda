/**
 * @fileoverview Helper functions for Post operations.
 * Contains utility functions for slug generation, content validation, and post-related business logic.
 */

import { PostModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Maps schema-level filter keys (UI-friendly names that mirror the public HTTP
 * contract) to the actual `posts` table column names + `buildWhereClause`
 * range suffixes. Keys NOT in this map pass through unchanged.
 *
 * Why: `PostFiltersSchema` / `HttpPostSearchSchema` expose `destinationId`,
 * `accommodationId`, `eventId`, `publishedAfter`, `publishedBefore`,
 * `createdAfter`, and `createdBefore` — but the `posts` table columns are
 * `relatedDestinationId`, `relatedAccommodationId`, `relatedEventId`,
 * `publishedAt`, and `createdAt`. Without this mapping, `buildWhereClause`
 * silently drops the filters (it warns and moves on) because it only matches
 * keys that exist as columns on the table.
 */
const POST_FILTER_KEY_MAP: Readonly<Record<string, string>> = {
    destinationId: 'relatedDestinationId',
    accommodationId: 'relatedAccommodationId',
    eventId: 'relatedEventId',
    publishedAfter: 'publishedAt_gte',
    publishedBefore: 'publishedAt_lte',
    createdAfter: 'createdAt_gte',
    createdBefore: 'createdAt_lte'
};

/**
 * Translate schema-level filter keys to the column-aware names expected by
 * `buildWhereClause`. Unknown keys are forwarded as-is so existing
 * direct-column filters (`isFeatured`, `category`, `authorId`, ...) keep
 * working.
 */
export function mapPostFilterKeysToColumns(
    filters: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        const mapped = POST_FILTER_KEY_MAP[key] ?? key;
        out[mapped] = value;
    }
    return out;
}

/**
 * Generates a unique slug for a post based on category and name.
 * Creates URL-friendly slugs with special handling for news posts that include dates.
 * Ensures uniqueness by checking against existing posts in the database.
 *
 * @param category - The post category (e.g., "blog", "news", "announcement")
 * @param name - The post name/title
 * @param isNews - Whether the post is a news post (affects slug format)
 * @param date - Optional date (required if isNews is true, used in slug generation)
 * @returns Promise resolving to a unique slug string
 *
 * @example
 * ```typescript
 * // Regular post
 * const slug = await generatePostSlug("blog", "My Great Article", false);
 * // Returns: "blog-my-great-article" or "blog-my-great-article-2"
 *
 * // News post with date
 * const newsSlug = await generatePostSlug("news", "Breaking News", true, new Date("2024-01-15"));
 * // Returns: "news-breaking-news-2024-01-15" or "news-breaking-news-2024-01-15-2"
 * ```
 *
 * @throws {Error} When database operations fail
 */
export async function generatePostSlug(
    category: string,
    name: string,
    isNews: boolean,
    date?: Date | string
): Promise<string> {
    let baseString = `${category} ${name}`;
    if (isNews && date) {
        const dateStr =
            typeof date === 'string' ? date.split('T')[0] : date.toISOString().split('T')[0];
        baseString = `${category} ${name} ${dateStr}`;
    }
    const model = new PostModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
