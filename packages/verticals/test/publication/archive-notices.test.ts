import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildListingArchivedPayload,
    LISTING_ARCHIVED_TEMPLATE
} from '../../src/publication/archive-notices';

describe('TEST:V6:36 the on-archive notice payload', () => {
    it('TEST:V6:36 carries data only, with the announced deletion as an ISO instant', () => {
        const deletionAnnouncedAt = new Date('2027-01-08T02:00:00.000Z');
        const payload = buildListingArchivedPayload({
            vertical: VerticalEnum.VENUE,
            listingId: 'listing-1',
            transition: 'PB5',
            deletionAnnouncedAt,
            listingAddonCount: 2
        });
        expect(LISTING_ARCHIVED_TEMPLATE).toBe('verticals.listing-archived');
        expect(payload).toEqual({
            vertical: VerticalEnum.VENUE,
            listingId: 'listing-1',
            transition: 'PB5',
            deletionAnnouncedAt: '2027-01-08T02:00:00.000Z',
            listingAddonCount: 2
        });
        expect(Object.keys(payload).sort()).toEqual([
            'deletionAnnouncedAt',
            'listingAddonCount',
            'listingId',
            'transition',
            'vertical'
        ]);
    });
});
