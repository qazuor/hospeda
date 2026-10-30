import { PublicationStatusEnum as S } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assembleListingNoticeRows,
    type ListingStatusChangedEventRow
} from '../../../src/models/listing/listing-notices.model';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const T0 = new Date('2026-10-01T10:00:00.000Z');
const T1 = new Date('2026-10-05T10:00:00.000Z');

function event(args: {
    readonly from: S | null;
    readonly to: S;
    readonly at: Date;
    readonly actorType?: string;
    readonly correlationId?: string;
    readonly reason?: string | null;
    readonly archiveOrigin?: S;
    readonly listingId?: string;
}): ListingStatusChangedEventRow {
    return {
        entityId: args.listingId ?? ID,
        actorType: args.actorType ?? 'admin',
        reason: args.reason ?? null,
        occurredAt: args.at,
        correlationId: args.correlationId ?? 'c-1',
        changes: [
            { field: 'publicationStatus', old: args.from, new: args.to },
            ...(args.archiveOrigin ? [{ field: 'archiveOrigin', new: args.archiveOrigin }] : [])
        ]
    };
}

describe('TEST:V8a:7 assembleListingNoticeRows (HOS-1492, H2)', () => {
    it('keeps the transition into the current status and the archive origin', () => {
        // Arrange
        const events = [
            event({ from: S.DRAFT, to: S.PUBLISHED, at: T0, actorType: 'owner' }),
            event({
                from: S.PUBLISHED,
                to: S.ARCHIVED,
                at: T1,
                actorType: 'job',
                archiveOrigin: S.PUBLISHED
            })
        ];

        // Act
        const [row] = assembleListingNoticeRows({
            listings: [{ id: ID, publicationStatus: S.ARCHIVED, deletionAnnouncedAt: T1 }],
            events,
            fixRequests: []
        });

        // Assert
        expect(row?.enteredCurrentStatus?.from).toBe(S.PUBLISHED);
        expect(row?.enteredCurrentStatus?.actorType).toBe('job');
        expect(row?.enteredCurrentStatus?.archiveOrigin).toBe(S.PUBLISHED);
        expect(row?.deletionAnnouncedAt).toEqual(T1);
        expect(row?.lastLift).toBeNull();
        expect(row?.openFixRequest).toBeNull();
    });

    it('follows the lift chain of one transaction by status, not by order (PB13 then PB3)', () => {
        // Arrange: the two events share their instant and arrive in reverse order.
        const events = [
            event({
                from: S.UNPUBLISHED_BY_BILLING,
                to: S.PUBLISHED,
                at: T1,
                actorType: 'job',
                correlationId: 'lift'
            }),
            event({
                from: S.MODERATED,
                to: S.UNPUBLISHED_BY_BILLING,
                at: T1,
                correlationId: 'lift'
            }),
            event({ from: S.PUBLISHED, to: S.MODERATED, at: T0, reason: 'Fotos' })
        ];

        // Act
        const [row] = assembleListingNoticeRows({
            listings: [{ id: ID, publicationStatus: S.PUBLISHED, deletionAnnouncedAt: null }],
            events,
            fixRequests: []
        });

        // Assert
        expect(row?.lastLift).toEqual({ at: T1, returnedTo: S.PUBLISHED });
    });

    it('does not count a purge of a moderated listing as a lift', () => {
        // Arrange
        const events = [
            event({ from: S.PUBLISHED, to: S.MODERATED, at: T0 }),
            event({ from: S.MODERATED, to: S.PURGED, at: T1, actorType: 'owner' })
        ];

        // Act
        const [row] = assembleListingNoticeRows({
            listings: [{ id: ID, publicationStatus: S.PURGED, deletionAnnouncedAt: null }],
            events,
            fixRequests: []
        });

        // Assert
        expect(row?.lastLift).toBeNull();
        expect(row?.enteredCurrentStatus?.from).toBe(S.MODERATED);
    });

    it('attaches the open fix request to its listing only', () => {
        // Arrange
        const fix = {
            listingId: OTHER,
            id: 'f-1',
            reason: 'Horario',
            suggestedDate: '2026-10-20',
            openedAt: T0,
            openedById: 'admin',
            ownerReportedFixedAt: null
        };

        // Act
        const rows = assembleListingNoticeRows({
            listings: [
                { id: ID, publicationStatus: S.DRAFT, deletionAnnouncedAt: null },
                { id: OTHER, publicationStatus: S.PUBLISHED, deletionAnnouncedAt: null }
            ],
            events: [],
            fixRequests: [fix]
        });

        // Assert
        expect(rows.map((row) => row.id)).toEqual([ID, OTHER]);
        expect(rows[0]?.openFixRequest).toBeNull();
        expect(rows[1]?.openFixRequest).toEqual({
            id: 'f-1',
            reason: 'Horario',
            suggestedDate: '2026-10-20',
            openedAt: T0,
            openedById: 'admin',
            ownerReportedFixedAt: null
        });
        expect(rows[1]?.enteredCurrentStatus).toBeNull();
    });

    it('ignores an event without a publicationStatus change', () => {
        // Arrange
        const events: ListingStatusChangedEventRow[] = [
            { ...event({ from: S.DRAFT, to: S.PUBLISHED, at: T0 }), changes: [{ field: 'x' }] }
        ];

        // Act
        const [row] = assembleListingNoticeRows({
            listings: [{ id: ID, publicationStatus: S.PUBLISHED, deletionAnnouncedAt: null }],
            events,
            fixRequests: []
        });

        // Assert
        expect(row?.enteredCurrentStatus).toBeNull();
    });
});
