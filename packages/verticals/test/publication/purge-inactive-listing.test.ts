import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { purgeDueAt, purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { at, listingId, makeHarness, userId, vertical } from './support';

const day = 86_400_000;
const due = new Date(at.getTime() - 180 * day);
const args = (harness: ReturnType<typeof makeHarness>, now = at) => ({
    ...harness,
    afterCommit: harness.retentionAfterCommit,
    // Passing this call's clock keeps legacy expired-listing cases past the first-pass guard.
    previousPassStartedAt: now,
    clock: { now: () => now },
    vertical,
    listingId,
    ownerId: userId,
    correlationId: 'pb9-test'
});
const noWrites = (h: ReturnType<typeof makeHarness>) => {
    expect(h.statusWrites).toHaveLength(0);
    expect(h.statusEvents).toHaveLength(0);
    expect(h.calls).not.toContain('purgeListingContent');
    expect(h.calls).not.toContain('stamp');
    expect(h.retentionAfterCommit.emitListingPurged).not.toHaveBeenCalled();
    expect(h.retentionAfterCommit.deleteRemoteMedia).not.toHaveBeenCalled();
    expect(h.retentionAfterCommit.revokeCalendarConnection).not.toHaveBeenCalled();
};

describe('TEST:V9b:7 AC:V9b:7 purge deadlines', () => {
    it('uses the later clock and coverage loss, then the later announced date', () => {
        expect(
            purgeDueAt({
                clockStart: at,
                coverageLostAt: null,
                deletionAfterDays: 180,
                deletionAnnouncedAt: null
            })
        ).toEqual(new Date(at.getTime() + 180 * day));
        const later = new Date(at.getTime() + 10 * day);
        expect(
            purgeDueAt({
                clockStart: later,
                coverageLostAt: null,
                deletionAfterDays: 180,
                deletionAnnouncedAt: null
            })
        ).toEqual(new Date(later.getTime() + 180 * day));
        expect(
            purgeDueAt({
                clockStart: at,
                coverageLostAt: later,
                deletionAfterDays: 180,
                deletionAnnouncedAt: null
            })
        ).toEqual(new Date(later.getTime() + 180 * day));
        expect(
            purgeDueAt({
                clockStart: at,
                coverageLostAt: new Date(at.getTime() - day),
                deletionAfterDays: 180,
                deletionAnnouncedAt: null
            })
        ).toEqual(new Date(at.getTime() + 180 * day));
        expect(
            purgeDueAt({
                clockStart: at,
                coverageLostAt: null,
                deletionAfterDays: 180,
                deletionAnnouncedAt: new Date(at.getTime() + 200 * day)
            })
        ).toEqual(new Date(at.getTime() + 200 * day));
        expect(
            purgeDueAt({
                clockStart: at,
                coverageLostAt: null,
                deletionAfterDays: 180,
                deletionAnnouncedAt: new Date(at.getTime() + 100 * day)
            })
        ).toEqual(new Date(at.getTime() + 180 * day));
    });

    it('does not purge before the announced deadline and purges at the exact instant', async () => {
        const announced = new Date(at.getTime() + 1);
        const before = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            deletionAnnouncedAt: announced
        });
        await expect(purgeInactiveListing(args(before, at))).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        noWrites(before);
        const exact = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            deletionAnnouncedAt: at
        });
        await expect(purgeInactiveListing(args(exact, at))).resolves.toMatchObject({
            purged: true,
            dueAt: at
        });
    });

    it('uses the later pause and coverage loss clocks', async () => {
        const pauseEndedAt = new Date(due.getTime() + 10 * day);
        const paused = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            retention: { stopped: false, pauseEndedAt }
        });
        await expect(purgeInactiveListing(args(paused, at))).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        noWrites(paused);
        const coverageLostAt = new Date(due.getTime() + 10 * day);
        const uncovered = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            retention: { stopped: false, pauseEndedAt: null, coverageLostAt }
        });
        await expect(purgeInactiveListing(args(uncovered, at))).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        noWrites(uncovered);
    });
});

describe('AC:V9b:1 PB9 transition boundaries', () => {
    it.each([
        Status.PUBLISHED,
        Status.DRAFT,
        Status.MODERATED,
        Status.PURGED
    ])('rejects %s without writes', async (status) => {
        const h = makeHarness({ status, covered: false, inactiveSince: due });
        await expect(purgeInactiveListing(args(h))).resolves.toEqual({
            purged: false,
            reason: 'NOT_ARCHIVED'
        });
        noWrites(h);
    });

    it('stops for pause, coverage, wrong owner, and a lost conditional transition', async () => {
        const stopped = makeHarness({
            status: Status.ARCHIVED,
            retention: { stopped: true, pauseEndedAt: null },
            covered: false,
            inactiveSince: due
        });
        await expect(purgeInactiveListing(args(stopped))).resolves.toEqual({
            purged: false,
            reason: 'RETENTION_STOPPED'
        });
        expect(stopped.billing.coverage).not.toHaveBeenCalled();
        noWrites(stopped);
        const covered = makeHarness({ status: Status.ARCHIVED, covered: true, inactiveSince: due });
        await expect(purgeInactiveListing(args(covered))).resolves.toEqual({
            purged: false,
            reason: 'COVERED'
        });
        expect(covered.stampWrites).toEqual([{ vertical, listingIds: [listingId], at }]);
        expect(covered.calls).not.toContain('set');
        expect(covered.calls).not.toContain('event');
        expect(covered.calls).not.toContain('purgeListingContent');
        const wrongOwner = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            ownerId: 'other-owner',
            inactiveSince: due
        });
        await expect(purgeInactiveListing(args(wrongOwner))).resolves.toEqual({
            purged: false,
            reason: 'STATE_CHANGED'
        });
        noWrites(wrongOwner);
        const raced = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            setReturnsFalse: true
        });
        await expect(purgeInactiveListing(args(raced))).resolves.toEqual({
            purged: false,
            reason: 'STATE_CHANGED'
        });
        expect(raced.statusWrites).toHaveLength(1);
        expect(raced.statusEvents).toHaveLength(0);
        expect(raced.calls).not.toContain('purgeListingContent');
    });

    it('orders the locked purge, writes the job event, and sends tourist notices only', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            recordBillingCalls: true,
            purgeContent: {
                markedMedia: [{ mediaId: 'media-1', publicId: 'remote' }],
                markedCalendar: [{ connectionId: 'cal-1', provider: 'google' }],
                closedAlerts: [{ alertId: 'alert-1', touristUserId: 'tourist-1' }],
                closedFixRequestId: 'fix-1'
            }
        });
        const result = await purgeInactiveListing(args(h));
        expect(result).toEqual({
            purged: true,
            dueAt: at,
            markedMedia: [{ mediaId: 'media-1', publicId: 'remote' }],
            markedCalendar: [{ connectionId: 'cal-1', provider: 'google' }],
            closedAlerts: 1,
            warnings: []
        });
        expect(h.calls).toEqual([
            'lock',
            'readRetention',
            'retentionStopped',
            'coverage',
            'set',
            'event',
            'purgeListingContent',
            'enqueueListingNotice',
            'commit',
            'emitListingPurged',
            'deleteRemoteMedia',
            'revokeCalendarConnection'
        ]);
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenCalledWith({
            vertical,
            mediaId: 'media-1',
            publicId: 'remote'
        });
        expect(h.retentionAfterCommit.revokeCalendarConnection).toHaveBeenCalledWith({
            connectionId: 'cal-1',
            accommodationId: listingId,
            provider: 'google'
        });
        expect(h.statusEvents[0]).toEqual({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            from: Status.ARCHIVED,
            to: Status.PURGED,
            actorType: 'job',
            correlationId: 'pb9-test',
            occurredAt: at
        });
        expect(h.listingNotices).toHaveLength(1);
        expect(h.listingNotices[0]).toMatchObject({
            template: 'verticals.price-alert-closed',
            recipientUserId: 'tourist-1',
            occurrenceKey: 'price-alert-closed:alert-1'
        });
        expect(
            h.listingNotices.some((notice) => notice.template === 'verticals.listing-purged')
        ).toBe(false);
    });
});

describe('TEST:V9b:3 AC:V9b:3 remote deletion after commit', () => {
    const marked = {
        markedMedia: [
            { mediaId: 'media-null-public-id', publicId: null },
            { mediaId: 'media-2', publicId: 'remote-2' }
        ],
        markedCalendar: [{ connectionId: 'cal-1', provider: 'GOOGLE_CALENDAR' }],
        closedAlerts: [],
        closedFixRequestId: null
    };

    it('calls each marked remote once, in photo then calendar order after commit', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            purgeContent: marked
        });
        const result = await purgeInactiveListing(args(h));
        expect(result).toMatchObject({ purged: true, warnings: [] });
        expect(h.calls.slice(-5)).toEqual([
            'commit',
            'emitListingPurged',
            'deleteRemoteMedia',
            'deleteRemoteMedia',
            'revokeCalendarConnection'
        ]);
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenCalledTimes(2);
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenNthCalledWith(1, {
            vertical,
            mediaId: 'media-null-public-id',
            publicId: null
        });
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenNthCalledWith(2, {
            vertical,
            mediaId: 'media-2',
            publicId: 'remote-2'
        });
        expect(h.retentionAfterCommit.revokeCalendarConnection).toHaveBeenCalledExactlyOnceWith({
            connectionId: 'cal-1',
            accommodationId: listingId,
            provider: 'GOOGLE_CALENDAR'
        });
    });

    it('keeps a committed result and attempts calendar when photo deletion fails', async () => {
        const onePhoto = { ...marked, markedMedia: marked.markedMedia.slice(0, 1) };
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            purgeContent: onePhoto
        });
        h.retentionAfterCommit.deleteRemoteMedia.mockRejectedValue(new Error('storage down'));
        const result = await purgeInactiveListing(args(h));
        expect(result).toMatchObject({
            purged: true,
            warnings: ['REMOTE_DELETION_FAILED']
        });
        expect(h.retentionAfterCommit.revokeCalendarConnection).toHaveBeenCalledOnce();
    });

    it('keeps a committed result and attempts photos when calendar revocation fails', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            purgeContent: marked
        });
        h.retentionAfterCommit.revokeCalendarConnection.mockRejectedValue(
            new Error('provider down')
        );
        const result = await purgeInactiveListing(args(h));
        expect(result).toMatchObject({ purged: true, warnings: ['REMOTE_DELETION_FAILED'] });
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenCalledTimes(2);
    });

    it('records both remote failures independently', async () => {
        const onePhoto = { ...marked, markedMedia: marked.markedMedia.slice(0, 1) };
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            purgeContent: onePhoto
        });
        h.retentionAfterCommit.deleteRemoteMedia.mockRejectedValue(new Error('storage down'));
        h.retentionAfterCommit.revokeCalendarConnection.mockRejectedValue(
            new Error('provider down')
        );
        await expect(purgeInactiveListing(args(h))).resolves.toMatchObject({
            purged: true,
            warnings: ['REMOTE_DELETION_FAILED', 'REMOTE_DELETION_FAILED']
        });
    });

    it('does not call remote ports when the transaction rejects', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: due,
            failTransaction: true,
            purgeContent: marked
        });
        await expect(purgeInactiveListing(args(h))).rejects.toThrow('rollback');
        expect(h.retentionAfterCommit.deleteRemoteMedia).not.toHaveBeenCalled();
        expect(h.retentionAfterCommit.revokeCalendarConnection).not.toHaveBeenCalled();
    });

    it.each([
        ['LISTING_NOT_FOUND', { retentionListingMissing: true }],
        ['STATE_CHANGED owner', { ownerId: 'other-owner' }],
        ['STATE_CHANGED status write', { setReturnsFalse: true }],
        ['NOT_ARCHIVED', { status: Status.PUBLISHED }],
        [
            'RETENTION_STOPPED',
            {
                status: Status.ARCHIVED,
                covered: false,
                retention: { stopped: true, pauseEndedAt: null }
            }
        ],
        ['COVERED', { status: Status.ARCHIVED, covered: true }],
        ['NOT_DUE', { status: Status.ARCHIVED, covered: false, inactiveSince: at }]
    ] as const)('does not call remote ports for %s', async (_label, config) => {
        const h = makeHarness({ ...config, purgeContent: marked });
        await purgeInactiveListing(args(h));
        expect(h.retentionAfterCommit.deleteRemoteMedia).not.toHaveBeenCalled();
        expect(h.retentionAfterCommit.revokeCalendarConnection).not.toHaveBeenCalled();
    });
});
