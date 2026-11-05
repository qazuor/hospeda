/**
 * HOS-1787 leaf 5.7 — regression: the protected experience projection keeps
 * `businessLines`.
 *
 * The shared publish gate (`resolveListingCompleteness`) requires
 * `businessLines`. `ExperienceSchema` does not declare the column, so before
 * this test the protected read stripped it and the owner's hub reported a
 * missing field the experience editor could not set.
 */

import { describe, expect, it } from 'vitest';
import { resolveListingCompleteness } from '../../../src/common/listing-completeness.js';
import { ExperienceProtectedSchema } from '../../../src/entities/experience/experience.access.schema.js';
import { ExperiencePriceUnitEnum } from '../../../src/enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../src/enums/experience-type.enum.js';
import { ProductDomainEnum } from '../../../src/enums/product-domain.enum.js';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** A complete protected experience row as the DB returns it. */
const buildProtectedExperience = (): Record<string, unknown> => ({
    id: VALID_UUID,
    name: 'Kayak tour on the Uruguay river',
    slug: 'kayak-tour-uruguay-river',
    summary: 'A guided two-hour kayak tour along the riverside.',
    description:
        'Explore the Uruguay river coastline by kayak with a certified local guide, including all safety equipment and a light snack.',
    type: ExperienceTypeEnum.TOUR_GUIDE,
    priceFrom: 1500000,
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    destinationId: VALID_UUID,
    ownerId: VALID_UUID,
    publicationStatus: 'PUBLISHED',
    businessLines: ['standard'],
    contactInfo: { workEmail: 'guide@example.com' },
    averageRating: 4.5,
    reviewsCount: 12,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: null,
    updatedById: null
});

describe('ExperienceProtectedSchema — business lines (HOS-1787 5.7)', () => {
    it('keeps businessLines in the protected projection', () => {
        const result = ExperienceProtectedSchema.safeParse(buildProtectedExperience());

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.businessLines).toEqual(['standard']);
        }
    });

    it('does not report businessLines missing through resolveListingCompleteness', () => {
        const result = ExperienceProtectedSchema.safeParse(buildProtectedExperience());

        expect(result.success).toBe(true);
        if (!result.success) {
            return;
        }

        const completeness = resolveListingCompleteness({
            entityType: ProductDomainEnum.EXPERIENCE,
            listing: result.data
        });

        expect(completeness.missing).not.toContain('businessLines');
    });
});
