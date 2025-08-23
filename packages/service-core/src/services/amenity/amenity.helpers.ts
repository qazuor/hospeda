/**
 * Helper utilities for AmenityService.
 * Add utility functions as needed.
 */
// TODO [f9f3b9f6-8dd1-46f8-8427-efcecf1f56a7]: Implement helper functions for AmenityService

import type { AmenityModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an amenity based on its name.
 * Ensures uniqueness in the database by checking against existing amenities.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The name of the amenity.
 * @param model The AmenityModel (or mock) to check for slug uniqueness.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateAmenitySlug(
    name: string,
    model: Pick<AmenityModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
