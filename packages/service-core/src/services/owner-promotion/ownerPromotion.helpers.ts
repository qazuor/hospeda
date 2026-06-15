/**
 * Helper utilities for OwnerPromotionService.
 */

import type { OwnerPromotionModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an owner promotion based on its title.
 *
 * Owner promotions use a plain `title` (not an i18n object), so the slug is
 * derived directly from it. Uniqueness is enforced against the database: if a
 * generated slug already exists, `createUniqueSlug` appends a unique suffix.
 *
 * @param title - The promotion title to derive the slug from.
 * @param model - The OwnerPromotionModel (or mock) used to check slug uniqueness.
 * @returns A promise resolving to a unique slug string.
 */
export async function generateOwnerPromotionSlug(
    title: string,
    model: Pick<OwnerPromotionModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(title, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
