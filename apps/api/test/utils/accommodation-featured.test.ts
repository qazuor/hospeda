/**
 * HOS-929 regression — `resolvePublicIsFeatured` derives the public-facing
 * `isFeatured` value from `featuredByEntitlement`, the billing-derived column.
 * It is the only featuring source since HOS-1419 dropped the admin-curated
 * `is_featured` column.
 *
 * Before HOS-929, public routes echoed a raw column only, so an accommodation
 * whose owner bought the "visibility boost" addon (or held a plan that grants
 * FEATURED_LISTING) never showed the featured badge anywhere.
 */
import { describe, expect, it } from 'vitest';
import {
    resolvePublicIsFeatured,
    withPublicIsFeatured,
    withPublicIsFeaturedList
} from '../../src/utils/accommodation-featured';

describe('resolvePublicIsFeatured', () => {
    it('is featured when the entitlement flag is true (HOS-929 bug case)', () => {
        expect(resolvePublicIsFeatured({ featuredByEntitlement: true })).toBe(true);
    });

    it('is NOT featured when the entitlement flag is false', () => {
        expect(resolvePublicIsFeatured({ featuredByEntitlement: false })).toBe(false);
    });

    it('treats a missing featuredByEntitlement as false (older/partial rows)', () => {
        expect(resolvePublicIsFeatured({})).toBe(false);
    });

    it('treats a null featuredByEntitlement as false', () => {
        expect(resolvePublicIsFeatured({ featuredByEntitlement: null })).toBe(false);
    });
});

describe('withPublicIsFeatured', () => {
    it('sets isFeatured from featuredByEntitlement and keeps the other fields', () => {
        // Arrange
        const entity = { id: 'a', featuredByEntitlement: true };

        // Act
        const result = withPublicIsFeatured(entity);

        // Assert
        expect(result).toEqual({ id: 'a', featuredByEntitlement: true, isFeatured: true });
    });

    it('resolves every item of a list', () => {
        // Arrange
        const items = [
            { id: 'a', featuredByEntitlement: true },
            { id: 'b', featuredByEntitlement: false }
        ];

        // Act
        const result = withPublicIsFeaturedList(items);

        // Assert
        expect(result.map((item) => item.isFeatured)).toEqual([true, false]);
    });
});
