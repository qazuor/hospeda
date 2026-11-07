import { PublicationStatusEnum as S } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assembleListingNoticeRows,
    type ListingBusinessLinesChangedEventRow
} from '../../../src/models/listing/listing-notices.model';

const ID = '11111111-1111-4111-8111-111111111111';
const T0 = new Date('2026-10-01T10:00:00.000Z');
const T1 = new Date('2026-10-05T10:00:00.000Z');

function change(args: {
    readonly at: Date;
    readonly actorType: string;
    readonly old?: unknown;
    readonly new?: unknown;
    readonly listingId?: string;
}): ListingBusinessLinesChangedEventRow {
    return {
        entityId: args.listingId ?? ID,
        actorType: args.actorType,
        occurredAt: args.at,
        changes: [
            {
                field: 'businessLines',
                ...(args.old === undefined ? {} : { old: args.old }),
                ...(args.new === undefined ? {} : { new: args.new })
            }
        ]
    };
}

function row(businessLinesChanges: readonly ListingBusinessLinesChangedEventRow[]) {
    return assembleListingNoticeRows({
        listings: [{ id: ID, publicationStatus: S.PUBLISHED, deletionAnnouncedAt: null }],
        events: [],
        fixRequests: [],
        businessLinesChanges
    })[0];
}

describe('TEST:7.3:8 last business-lines change (HOS-1875, DEC-FAC-056)', () => {
    it('is null without a listing.edited event', () => {
        // Act
        const noticeRow = row([]);

        // Assert
        expect(noticeRow?.lastBusinessLinesChange).toBeNull();
    });

    it('keeps the LAST admin change when several arrive in a row (collapse)', () => {
        // Arrange
        const changes = [
            change({ at: T0, actorType: 'admin', old: ['food'], new: ['food', 'nightlife'] }),
            change({
                at: T1,
                actorType: 'admin',
                old: ['food', 'nightlife'],
                new: ['nightlife']
            })
        ];

        // Act
        const noticeRow = row(changes);

        // Assert
        expect(noticeRow?.lastBusinessLinesChange).toEqual({
            at: T1,
            actorType: 'admin',
            before: ['food', 'nightlife'],
            after: ['nightlife']
        });
    });

    it('keeps the owner change that came after an admin change', () => {
        // Arrange
        const changes = [
            change({ at: T0, actorType: 'admin', old: ['food'], new: ['food', 'nightlife'] }),
            change({ at: T1, actorType: 'owner', old: ['food', 'nightlife'], new: ['food'] })
        ];

        // Act
        const noticeRow = row(changes);

        // Assert
        expect(noticeRow?.lastBusinessLinesChange).toMatchObject({
            at: T1,
            actorType: 'owner',
            before: ['food', 'nightlife'],
            after: ['food']
        });
    });

    it('answers an empty before when the change carries no old value', () => {
        // Arrange
        const changes = [change({ at: T0, actorType: 'admin', new: ['food', 'nightlife'] })];

        // Act
        const noticeRow = row(changes);

        // Assert
        expect(noticeRow?.lastBusinessLinesChange).toEqual({
            at: T0,
            actorType: 'admin',
            before: [],
            after: ['food', 'nightlife']
        });
    });
});
