/**
 * `loadListingMedia` and its batch twin `loadListingMediaMany` (HOS-2331): one
 * media query whatever the number of listings, every requested id present, and
 * the single loader answering exactly what it did before it delegated.
 *
 * The media models come from the global `@repo/db` mock (`test/setup.ts`).
 *
 * @module test/services/listing-media
 */

import { experienceMediaModel, venueMediaModel } from '@repo/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadListingMedia, loadListingMediaMany } from '../../src/services/listing-media';

const featured = (venueId: string) => ({
    id: `m-${venueId}`,
    venueId,
    url: `https://example.com/${venueId}.jpg`,
    isFeatured: true,
    state: 'visible',
    moderationState: 'APPROVED',
    sortOrder: 0
});

describe('listing media loaders', () => {
    afterEach(() => {
        vi.mocked(venueMediaModel.findByVenues).mockReset();
        vi.mocked(experienceMediaModel.findByExperiences).mockReset();
    });

    it('loads many venues with one query and answers every id', async () => {
        // Arrange
        vi.mocked(venueMediaModel.findByVenues).mockResolvedValue(
            new Map([['v1', [featured('v1')]]]) as never
        );

        // Act
        const media = await loadListingMediaMany({ entityType: 'venue', entityIds: ['v1', 'v2'] });

        // Assert
        expect(venueMediaModel.findByVenues).toHaveBeenCalledTimes(1);
        expect(venueMediaModel.findByVenues).toHaveBeenCalledWith({
            venueIds: ['v1', 'v2'],
            tx: undefined
        });
        expect(media.get('v1')?.featuredImage?.url).toBe('https://example.com/v1.jpg');
        expect(media.get('v2')).toEqual({});
    });

    it('makes no query for no ids', async () => {
        // Act
        const media = await loadListingMediaMany({ entityType: 'experience', entityIds: [] });

        // Assert
        expect(media.size).toBe(0);
        expect(experienceMediaModel.findByExperiences).not.toHaveBeenCalled();
    });

    it('keeps the single loader reading one listing of the right table', async () => {
        // Arrange
        vi.mocked(experienceMediaModel.findByExperiences).mockResolvedValue(new Map());

        // Act
        const media = await loadListingMedia({ entityType: 'experience', entityId: 'e1' });

        // Assert
        expect(experienceMediaModel.findByExperiences).toHaveBeenCalledWith({
            experienceIds: ['e1'],
            tx: undefined
        });
        expect(venueMediaModel.findByVenues).not.toHaveBeenCalled();
        expect(media).toEqual({});
    });
});
