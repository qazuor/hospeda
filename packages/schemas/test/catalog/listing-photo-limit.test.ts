import { describe, expect, it } from 'vitest';
import {
    LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL,
    partitionGalleryByCap,
    UNLIMITED_LIMIT_VALUE
} from '../../src/catalog/index.js';

describe('listing photo limit keys', () => {
    it('maps exactly the three listing verticals to their photo limit keys', () => {
        const expected = {
            accommodation: 'max_photos_per_accommodation',
            venue: 'max_photos_per_venue',
            experience: 'max_photos_per_experience'
        };

        expect(LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL).toStrictEqual(expected);
    });
});

describe('partitionGalleryByCap', () => {
    const items = Object.freeze(['garden', 'balcony', 'lobby']);

    it('keeps the input order on both sides of a finite cap', () => {
        const result = partitionGalleryByCap({ items, cap: 1 });

        expect(result).toStrictEqual({ shown: ['garden'], hidden: ['balcony', 'lobby'] });
    });

    it('hides every photo at cap zero', () => {
        const result = partitionGalleryByCap({ items, cap: 0 });

        expect(result).toStrictEqual({ shown: [], hidden: ['garden', 'balcony', 'lobby'] });
    });

    it.each([
        { name: 'an exact fit', cap: 3 },
        { name: 'a null cap', cap: null },
        { name: 'the unlimited sentinel', cap: UNLIMITED_LIMIT_VALUE },
        { name: 'a cap above the sentinel', cap: UNLIMITED_LIMIT_VALUE + 1 }
    ])('shows every photo with $name', ({ cap }) => {
        const result = partitionGalleryByCap({ items, cap });

        expect(result).toStrictEqual({ shown: ['garden', 'balcony', 'lobby'], hidden: [] });
    });
});
