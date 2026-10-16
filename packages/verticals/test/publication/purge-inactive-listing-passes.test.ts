import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isFirstPurgePass,
    purgeInactiveListing
} from '../../src/publication/purge-inactive-listing';
import { at, listingId, makeHarness, userId, vertical } from './support';

const dueAt = new Date(at.getTime() - 180 * 86_400_000);
const args = (h: ReturnType<typeof makeHarness>, previousPassStartedAt: Date | null) => ({
    ...h,
    afterCommit: h.retentionAfterCommit,
    clock: { now: () => at },
    vertical,
    listingId,
    ownerId: userId,
    correlationId: 'pb9-passes',
    previousPassStartedAt
});
const noWrites = (h: ReturnType<typeof makeHarness>) => {
    expect(h.statusWrites).toEqual([]);
    expect(h.statusEvents).toEqual([]);
    expect(h.stampWrites).toEqual([]);
    expect(h.calls).not.toContain('purgeListingContent');
    expect(h.calls).not.toContain('enqueueListingNotice');
    expect(h.retentionAfterCommit.emitListingPurged).not.toHaveBeenCalled();
};

describe('TEST:V9b:6 AC:V9b:6 isFirstPurgePass', () => {
    it('treats missing history and a due date after the previous start as first pass', () => {
        expect(isFirstPurgePass({ coverageLostAt: null, dueAt, previousPassStartedAt: null })).toBe(
            true
        );
        expect(
            isFirstPurgePass({
                coverageLostAt: null,
                dueAt,
                previousPassStartedAt: new Date(dueAt.getTime() - 1)
            })
        ).toBe(true);
    });
    it('uses a strict boundary and only applies when coverage loss is missing', () => {
        expect(
            isFirstPurgePass({ coverageLostAt: null, dueAt, previousPassStartedAt: dueAt })
        ).toBe(false);
        expect(
            isFirstPurgePass({
                coverageLostAt: null,
                dueAt,
                previousPassStartedAt: new Date(dueAt.getTime() + 1)
            })
        ).toBe(false);
        expect(
            isFirstPurgePass({
                coverageLostAt: new Date(at.getTime() - 300 * 86_400_000),
                dueAt,
                previousPassStartedAt: null
            })
        ).toBe(false);
    });
});

describe('TEST:V9b:6 AC:V9b:6 PB9 rereads coverage and pause', () => {
    it('covered resets only the clock', async () => {
        const h = makeHarness({ status: Status.ARCHIVED, covered: true, inactiveSince: dueAt });
        await expect(purgeInactiveListing(args(h, at))).resolves.toEqual({
            purged: false,
            reason: 'COVERED'
        });
        expect(h.stampWrites).toEqual([{ vertical, listingIds: [listingId], at }]);
        expect(h.statusWrites).toEqual([]);
        expect(h.statusEvents).toEqual([]);
        expect(h.calls).not.toContain('purgeListingContent');
        expect(h.calls).not.toContain('enqueueListingNotice');
        expect(h.retentionAfterCommit.emitListingPurged).not.toHaveBeenCalled();
    });
    it('pause takes priority over coverage and writes nothing', async () => {
        const paused = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            retention: { stopped: true, pauseEndedAt: null },
            inactiveSince: dueAt
        });
        await expect(purgeInactiveListing(args(paused, null))).resolves.toEqual({
            purged: false,
            reason: 'RETENTION_STOPPED'
        });
        expect(paused.billing.coverage).not.toHaveBeenCalled();
        noWrites(paused);
        const pausedAndCovered = makeHarness({
            status: Status.ARCHIVED,
            covered: true,
            retention: { stopped: true, pauseEndedAt: null },
            inactiveSince: dueAt
        });
        await expect(purgeInactiveListing(args(pausedAndCovered, null))).resolves.toEqual({
            purged: false,
            reason: 'RETENTION_STOPPED'
        });
        expect(pausedAndCovered.stampWrites).toEqual([]);
    });
    it.each([
        null,
        new Date(dueAt.getTime() - 1)
    ])('defers the first due pass with no coverage-loss date (%s)', async (previous) => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            recordBillingCalls: true
        });
        await expect(purgeInactiveListing(args(h, previous))).resolves.toEqual({
            purged: false,
            reason: 'FIRST_PASS'
        });
        noWrites(h);
        expect(h.calls.indexOf('coverage')).toBeGreaterThan(-1);
        expect(h.calls.indexOf('coverage')).toBeLessThan(h.calls.indexOf('commit'));
    });
    it.each([
        at,
        new Date(at.getTime() + 1)
    ])('purges on a subsequent pass (%s)', async (previous) => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            recordBillingCalls: true,
            purgeContent: {
                markedMedia: [{ mediaId: 'm', publicId: 'p' }],
                markedCalendar: [{ connectionId: 'c', provider: 'google' }],
                closedAlerts: [],
                closedFixRequestId: null
            }
        });
        await expect(purgeInactiveListing(args(h, previous))).resolves.toMatchObject({
            purged: true
        });
    });
    it('purges on the first pass when coverage loss has a date', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            recordBillingCalls: true,
            retention: {
                stopped: false,
                pauseEndedAt: null,
                coverageLostAt: new Date(dueAt.getTime() - 1)
            }
        });
        await expect(purgeInactiveListing(args(h, null))).resolves.toMatchObject({ purged: true });
    });
    it('checks due before first pass', async () => {
        const h = makeHarness({ status: Status.ARCHIVED, covered: false, inactiveSince: at });
        await expect(purgeInactiveListing(args(h, null))).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        noWrites(h);
    });
});

describe('TEST:V9b:8 AC:V9b:8 PB9 pushes after commit', () => {
    it('pushes once after commit before remote deletions', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            recordBillingCalls: true,
            purgeContent: {
                markedMedia: [{ mediaId: 'm', publicId: 'p' }],
                markedCalendar: [{ connectionId: 'c', provider: 'google' }],
                closedAlerts: [],
                closedFixRequestId: null
            }
        });
        await purgeInactiveListing(args(h, at));
        expect(h.retentionAfterCommit.emitListingPurged).toHaveBeenCalledTimes(1);
        expect(h.retentionAfterCommit.emitListingPurged).toHaveBeenCalledWith({ listingId });
        expect(h.calls).toEqual([
            'lock',
            'readRetention',
            'retentionStopped',
            'coverage',
            'set',
            'event',
            'purgeListingContent',
            'commit',
            'emitListingPurged',
            'deleteRemoteMedia',
            'revokeCalendarConnection'
        ]);
    });
    it('keeps purge successful and tries both remotes when push fails', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            purgeContent: {
                markedMedia: [{ mediaId: 'm', publicId: 'p' }],
                markedCalendar: [{ connectionId: 'c', provider: 'google' }],
                closedAlerts: [],
                closedFixRequestId: null
            }
        });
        h.retentionAfterCommit.emitListingPurged.mockRejectedValue(
            new Error('billing unavailable')
        );
        await expect(purgeInactiveListing(args(h, at))).resolves.toMatchObject({
            purged: true,
            warnings: ['PURGE_NOTICE_FAILED']
        });
        expect(h.retentionAfterCommit.deleteRemoteMedia).toHaveBeenCalled();
        expect(h.retentionAfterCommit.revokeCalendarConnection).toHaveBeenCalled();
    });
    it.each([
        ['LISTING_NOT_FOUND', { retentionListingMissing: true }, 'LISTING_NOT_FOUND'],
        ['STATE_CHANGED owner', { ownerId: 'other' }, 'STATE_CHANGED'],
        ['STATE_CHANGED write', { setReturnsFalse: true, inactiveSince: dueAt }, 'STATE_CHANGED'],
        ['NOT_ARCHIVED', { status: Status.PUBLISHED }, 'NOT_ARCHIVED'],
        [
            'RETENTION_STOPPED',
            { retention: { stopped: true, pauseEndedAt: null } },
            'RETENTION_STOPPED'
        ],
        ['COVERED', { covered: true }, 'COVERED'],
        ['NOT_DUE', { inactiveSince: at }, 'NOT_DUE'],
        ['FIRST_PASS', { inactiveSince: dueAt }, 'FIRST_PASS']
    ] as const)('does not push for %s', async (_label, options, reason) => {
        const h = makeHarness({ status: Status.ARCHIVED, covered: false, ...options });
        const previous = _label === 'FIRST_PASS' ? null : at;
        const result = await purgeInactiveListing(args(h, previous));
        expect(result).toEqual({ purged: false, reason });
        expect(h.retentionAfterCommit.emitListingPurged).not.toHaveBeenCalled();
    });
    it('does not push when the transaction rolls back', async () => {
        const h = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: dueAt,
            failTransaction: true
        });
        await expect(purgeInactiveListing(args(h, at))).rejects.toThrow('rollback');
        expect(h.retentionAfterCommit.emitListingPurged).not.toHaveBeenCalled();
    });
});
