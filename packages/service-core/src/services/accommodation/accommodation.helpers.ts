import { AccommodationModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an accommodation based on its type and name.
 * It combines the type and name, creates a slugified version, and ensures
 * its uniqueness in the database by checking against existing accommodations.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param type The type of the accommodation (e.g., "hotel", "apartment").
 * @param name The name of the accommodation.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateSlug(type: string, name: string): Promise<string> {
    const baseString = `${type} ${name}`;
    const model = new AccommodationModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
