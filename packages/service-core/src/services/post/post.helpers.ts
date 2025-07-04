import { PostModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a post based on category and name. If isNews is true, includes date.
 * @param category - The post category
 * @param name - The post name/title
 * @param isNews - Whether the post is a news post
 * @param date - Optional date (required if isNews)
 * @returns Promise resolving to a unique slug string
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
