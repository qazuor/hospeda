/**
 * Helper utilities for AmenityService.
 */

import type { AmenityModel } from '@repo/db';
import type { I18nText } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an amenity based on its i18n name.
 * Uses the Spanish (`es`) locale as the canonical slug source since it is
 * the platform's primary locale.
 * Ensures uniqueness in the database by checking against existing amenities.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param name The i18n name object of the amenity.
 * @param model The AmenityModel (or mock) to check for slug uniqueness.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateAmenitySlug(
    name: I18nText,
    model: Pick<AmenityModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name.es, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
