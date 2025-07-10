import type { FeatureModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a feature based on its name.
 * Ensures uniqueness in the database by checking against existing features.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The name of the feature.
 * @param model The FeatureModel (or mock) to check for slug uniqueness.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateFeatureSlug(
    name: string,
    model: Pick<FeatureModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
