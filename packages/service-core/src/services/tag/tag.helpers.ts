import { TagModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a tag based on its name.
 * Ensures uniqueness in the database by checking against existing tags.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The name of the tag.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateTagSlug(name: string): Promise<string> {
    const baseString = name;
    const model = new TagModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
