/**
 * @fileoverview Helper functions for Post operations.
 * Contains utility functions for slug generation, content validation, and post-related business logic.
 */

import { PostModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

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
