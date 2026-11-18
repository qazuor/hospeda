/**
 * HOS-2331 (review M-1) — `get_listing_stats` when the entitlement read itself
 * fails: a rejection other than ENTITLEMENT_REQUIRED (a service error or a plain
 * error) refuses the call and no metric is read. Every metric read is armed, so
 * a gate that turned the failure into "granted" would make the call succeed.
 *
 * Same boundaries as `get-listing-stats.test.ts`: `getById` and the views are
 * spied, the user gate and the latest-reviews reader are mocked.
 *
 * @module test/mcp/tools/listing/get-listing-stats.gate-failure
 */

import { PublicationStatusEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, entityViewService, ServiceError, VenueService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { latestReviews, enforceGate, effectiveKeys } = vi.hoisted(() => ({
    latestReviews: vi.fn(),
    enforceGate: vi.fn(),
    effectiveKeys: vi.fn()
}));

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: enforceGate,
    readEffectiveKeys: effectiveKeys
}));
vi.mock('../../../../src/mcp/tools/listing/listing-stats-readers', () => ({
    readLatestListingReviews: latestReviews
}));

import { getListingStatsTool } from '../../../../src/mcp/tools/listing/get-listing-stats';
import { runTool } from '../../../../src/mcp/tools/run-tool';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const actor = {
    id: OWNER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

describe('get_listing_stats — entitlement read failure (M-1)', () => {
    beforeEach(() => {
        latestReviews.mockResolvedValue([]);
        effectiveKeys.mockResolvedValue({ view_advanced_stats: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        latestReviews.mockReset();
        enforceGate.mockReset();
        effectiveKeys.mockReset();
    });

    it.each([
        [
            'an INTERNAL_ERROR service error',
            new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'down')
        ],
        ['a plain error', new Error('effective set down')]
    ])('refuses and reads no metric when the gate rejects with %s', async (_label, failure) => {
        // Arrange
        const getById = vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
            data: {
                id: LISTING_ID,
                ownerId: OWNER_ID,
                name: 'La Parrilla',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                reviewsCount: 0,
                averageRating: 0
            }
        } as never);
        const views = vi
            .spyOn(entityViewService, 'getDailySeriesComparisonForOwnListing')
            .mockResolvedValue({ data: { previous: [], current: [] } });
        enforceGate.mockRejectedValue(failure);

        // Act
        const outcome = await runTool({
            definition: getListingStatsTool,
            actor,
            input: { vertical: VerticalEnum.VENUE, listingId: LISTING_ID, period: '7d' },
            context: { channel: 'mcp' }
        });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(getById).not.toHaveBeenCalled();
        expect(views).not.toHaveBeenCalled();
        expect(latestReviews).not.toHaveBeenCalled();
    });
});
