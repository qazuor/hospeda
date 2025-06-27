import { DestinationModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a destination based on its name.
 * Creates a slugified version and ensures its uniqueness in the database by checking against existing destinations.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The name of the destination.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateDestinationSlug(name: string): Promise<string> {
    const baseString = name;
    const model = new DestinationModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
