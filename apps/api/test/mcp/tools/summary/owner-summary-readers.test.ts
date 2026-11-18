/**
 * HOS-2331 — the two owner-wide reads of `get_owner_summary` below the service
 * layer: the favorites of many accommodations in one count (the where of
 * `countBookmarksForEntity`, batched), and the open fix requests from the
 * portal's notices reader, purged listings excluded like the portal does.
 *
 * `@repo/db` is mocked locally; these tests pin what is ASKED of the models,
 * not how Drizzle builds the query (see apps/api CLAUDE.md, testing gotcha 1).
 *
 * @module test/mcp/tools/summary/owner-summary-readers
 */

import { EntityTypeEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { count, readNotices } = vi.hoisted(() => ({ count: vi.fn(), readNotices: vi.fn() }));

vi.mock('@repo/db', () => ({
    UserBookmarkModel: class {
        count = count;
    },
    listingNoticesModel: { readOwnerListingNotices: readNotices }
}));

import {
    countAccommodationFavorites,
    readOpenFixRequestListings
} from '../../../../src/mcp/tools/summary/owner-summary-readers';

const OWNER = '1f2e3d4c-5b6a-4789-8abc-def012345678';

const notice = (overrides: Record<string, unknown>) => ({
    id: 'l1',
    name: 'Casa',
    publicationStatus: PublicationStatusEnum.MODERATED,
    deletionAnnouncedAt: null,
    enteredCurrentStatus: null,
    lastLift: null,
    openFixRequest: null,
    ...overrides
});

const fix = (ownerReportedFixedAt: Date | null) => ({
    id: 'f1',
    reason: 'Fotos que no corresponden',
    suggestedDate: null,
    openedAt: new Date('2026-11-01T00:00:00.000Z'),
    openedById: 'staff',
    ownerReportedFixedAt
});

describe('owner summary readers', () => {
    afterEach(() => {
        count.mockReset();
        readNotices.mockReset();
    });

    it('counts the live favorites of every given accommodation in ONE query', async () => {
        // Arrange
        count.mockResolvedValue(11);

        // Act
        const total = await countAccommodationFavorites({ accommodationIds: ['a1', 'a2', 'a3'] });

        // Assert
        expect(total).toBe(11);
        expect(count).toHaveBeenCalledTimes(1);
        expect(count).toHaveBeenCalledWith({
            entityId: ['a1', 'a2', 'a3'],
            entityType: EntityTypeEnum.ACCOMMODATION,
            deletedAt: null
        });
    });

    it('makes no query for no accommodations', async () => {
        // Act
        const total = await countAccommodationFavorites({ accommodationIds: [] });

        // Assert
        expect(total).toBe(0);
        expect(count).not.toHaveBeenCalled();
    });

    it("reads the owner's notices and keeps the listings with an open fix request, purged excluded", async () => {
        // Arrange
        readNotices.mockResolvedValue([
            notice({ id: 'l1', name: 'Casa', openFixRequest: fix(null) }),
            notice({ id: 'l2', name: 'Cabaña', openFixRequest: fix(new Date()) }),
            notice({ id: 'l3', openFixRequest: null }),
            notice({
                id: 'l4',
                publicationStatus: PublicationStatusEnum.PURGED,
                openFixRequest: fix(null)
            })
        ]);

        // Act
        const listings = await readOpenFixRequestListings({
            vertical: VerticalEnum.VENUE,
            ownerId: OWNER
        });

        // Assert
        expect(readNotices).toHaveBeenCalledWith({ vertical: 'venue', ownerId: OWNER });
        expect(listings).toEqual([
            { id: 'l1', name: 'Casa', reportedFixed: false },
            { id: 'l2', name: 'Cabaña', reportedFixed: true }
        ]);
    });
});
