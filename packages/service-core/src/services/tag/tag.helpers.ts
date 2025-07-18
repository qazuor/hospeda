/**
 * @fileoverview Helper functions for Tag operations.
 * Contains utility functions for slug generation and tag-related business logic.
 */

import { TagModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a tag based on its name.
 * Uses the tag name to create a URL-friendly slug, ensuring uniqueness
 * by checking against existing tags in the database. If a collision occurs,
 * a numeric suffix is automatically appended.
 *
 * @param name - The display name of the tag (e.g., "Travel Photography")
 * @returns A promise that resolves to a unique slug string (e.g., "travel-photography" or "travel-photography-2")
 *
 * @example
 * ```typescript
 * const slug = await generateTagSlug("Travel Photography");
 * // Returns: "travel-photography" (if unique) or "travel-photography-2" (if collision)
 * ```
 *
 * @throws {Error} When database operations fail
 */
export async function generateTagSlug(name: string): Promise<string> {
    const baseString = name;
    const model = new TagModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
