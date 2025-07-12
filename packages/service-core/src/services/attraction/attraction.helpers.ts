/**
 * Attraction helpers: slug generation, etc.
 */
import type { AttractionModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an attraction based on its name.
 * Ensures uniqueness in the database by checking against existing attractions.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The name of the attraction.
 * @param model The AttractionModel (or mock) to check for slug uniqueness.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateAttractionSlug(
    name: string,
    model: Pick<AttractionModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
