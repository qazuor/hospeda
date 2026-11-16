/**
 * HOS-2184 T-024 — `readLatestListingReviews`: the sorted, publicly visible,
 * non-deleted review read behind `get_listing_stats`. The review models are
 * replaced at the `@repo/db` boundary; what matters here is the filter and
 * the sort each vertical's model receives.
 *
 * @module test/mcp/tools/listing/listing-stats-readers
 */

import { LifecycleStatusEnum, ModerationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { accommodationFindAll, venueFindAll, experienceFindAll } = vi.hoisted(() => ({
    accommodationFindAll: vi.fn(),
    venueFindAll: vi.fn(),
    experienceFindAll: vi.fn()
}));

vi.mock('@repo/db', () => ({
    AccommodationReviewModel: class {
        findAll = accommodationFindAll;
    },
    VenueReviewModel: class {
        findAll = venueFindAll;
    },
    ExperienceReviewModel: class {
        findAll = experienceFindAll;
    }
}));

import { readLatestListingReviews } from '../../../../src/mcp/tools/listing/listing-stats-readers';

const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

const CASES = [
    [VerticalEnum.ACCOMMODATION, accommodationFindAll, 'accommodationId'],
    [VerticalEnum.VENUE, venueFindAll, 'venueId'],
    [VerticalEnum.EXPERIENCE, experienceFindAll, 'experienceId']
] as const;

describe('readLatestListingReviews', () => {
    afterEach(() => {
        for (const fn of [accommodationFindAll, venueFindAll, experienceFindAll]) {
            fn.mockReset();
        }
    });

    it.each(
        CASES
    )('asks the %s review model for the newest ACTIVE, APPROVED, non-deleted reviews', async (vertical, findAll, column) => {
        // Arrange
        findAll.mockResolvedValue({ items: [], total: 0 });

        // Act
        await readLatestListingReviews({ vertical, listingId: LISTING_ID, limit: 3 });

        // Assert
        expect(findAll).toHaveBeenCalledWith(
            {
                [column]: LISTING_ID,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED,
                deletedAt: null
            },
            { page: 1, pageSize: 3, sortBy: 'createdAt', sortOrder: 'desc' }
        );
    });

    it('queries only the model of the requested vertical', async () => {
        // Arrange
        venueFindAll.mockResolvedValue({ items: [], total: 0 });

        // Act
        await readLatestListingReviews({
            vertical: VerticalEnum.VENUE,
            listingId: LISTING_ID,
            limit: 3
        });

        // Assert
        expect(accommodationFindAll).not.toHaveBeenCalled();
        expect(experienceFindAll).not.toHaveBeenCalled();
    });

    it('projects rows to title, content, rating and date, never the reviewer', async () => {
        // Arrange
        experienceFindAll.mockResolvedValue({
            items: [
                {
                    id: 'r1',
                    userId: 'someone',
                    title: undefined,
                    content: 'Muy buena',
                    averageRating: '4.50',
                    createdAt: '2026-06-10T12:00:00.000Z'
                }
            ],
            total: 1
        });

        // Act
        const rows = await readLatestListingReviews({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: LISTING_ID,
            limit: 3
        });

        // Assert
        expect(rows).toEqual([
            {
                title: null,
                content: 'Muy buena',
                averageRating: 4.5,
                createdAt: new Date('2026-06-10T12:00:00.000Z')
            }
        ]);
    });
});
