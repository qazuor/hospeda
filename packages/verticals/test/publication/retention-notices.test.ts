import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildListingRetentionBeforeArchivePayload,
    buildListingRetentionBeforeDeletionPayload,
    LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
    LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
    RETENTION_NOTICE_MILESTONES,
    retentionNoticeAt,
    retentionNoticeTargetDay
} from '../../src/publication/retention-notices';

describe('TEST:V9b:10 retention notice helpers', () => {
    it('uses the market calendar day for the target action', () => {
        expect(retentionNoticeTargetDay({ at: new Date('2027-01-12T02:00:00.000Z') })).toBe(
            '2027-01-11'
        );
        expect(retentionNoticeTargetDay({ at: new Date('2027-01-12T15:00:00.000Z') })).toBe(
            '2027-01-12'
        );
    });

    it('subtracts exact days and builds the ISO payload contracts', () => {
        const targetAt = new Date('2027-01-12T12:00:00.000Z');
        expect(retentionNoticeAt({ targetAt, daysBefore: 15 })).toEqual(
            new Date(targetAt.getTime() - 15 * 86_400_000)
        );
        expect(
            buildListingRetentionBeforeArchivePayload({
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: 'listing-1',
                transition: 'PB4',
                archiveAt: targetAt
            })
        ).toEqual({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: 'listing-1',
            transition: 'PB4',
            archiveAt: '2027-01-12T12:00:00.000Z'
        });
        expect(
            buildListingRetentionBeforeDeletionPayload({
                vertical: VerticalEnum.EXPERIENCE,
                listingId: 'listing-2',
                deletionAt: targetAt
            })
        ).toEqual({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: 'listing-2',
            deletionAt: '2027-01-12T12:00:00.000Z'
        });
        expect(LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE).toBe(
            'verticals.listing-retention-before-archive'
        );
        expect(LISTING_RETENTION_BEFORE_DELETION_TEMPLATE).toBe(
            'verticals.listing-retention-before-deletion'
        );
        expect(RETENTION_NOTICE_MILESTONES).toEqual({
            BEFORE_ARCHIVE: 'ret:-90d',
            BEFORE_DELETION: 'ret:-180d'
        });
    });
});
