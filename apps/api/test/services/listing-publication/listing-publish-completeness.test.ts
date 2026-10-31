import type { Experience } from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { evaluateListingPublishCompleteness } from '../../../src/services/listing-publication/listing-publish-completeness';

const ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** An experience row as the database stores a "price on request" listing (HOS-1943). */
function makeOnRequestExperience(overrides: Record<string, unknown> = {}): Experience {
    return {
        id: ID,
        ownerId: ID,
        destinationId: ID,
        name: 'Kayak tour on the Uruguay river',
        summary: 'A guided two-hour kayak tour along the riverside.',
        description:
            'Explore the Uruguay river coastline by kayak with a certified local guide, including all safety equipment and a light snack.',
        type: 'TOUR_GUIDE',
        contactInfo: { workEmail: 'guide@example.com' },
        priceFrom: 0,
        priceUnit: null,
        isPriceOnRequest: true,
        ...overrides
    } as unknown as Experience;
}

const MEDIA = {
    featuredImage: {
        url: 'https://example.com/kayak.jpg',
        moderationState: 'APPROVED'
    }
} as never;

describe('evaluateListingPublishCompleteness — experience price on request (HOS-1943)', () => {
    it('does not require a price from a price-on-request experience', async () => {
        // Arrange
        const listing = makeOnRequestExperience();

        // Act
        const result = await evaluateListingPublishCompleteness({
            vertical: VerticalEnum.EXPERIENCE,
            listing,
            media: MEDIA
        });

        // Assert
        expect(result.missing).not.toContain('priceFrom');
        expect(result.complete).toBe(true);
    });

    it('still requires a price when the experience is not on request', async () => {
        // Arrange
        const listing = makeOnRequestExperience({ isPriceOnRequest: false, priceUnit: null });

        // Act
        const result = await evaluateListingPublishCompleteness({
            vertical: VerticalEnum.EXPERIENCE,
            listing,
            media: MEDIA
        });

        // Assert
        expect(result.missing).toContain('priceFrom');
    });
});
