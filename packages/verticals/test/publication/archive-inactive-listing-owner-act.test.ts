import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { addCalendarMonthsUtc } from '../../src/publication/retention-clock';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const DAY = 86_400_000;

async function archive(harness: ReturnType<typeof makeHarness>) {
    return archiveInactiveListing({
        ...harness,
        clock,
        vertical,
        listingId,
        ownerId: userId,
        correlationId: 'owner-act-archive'
    });
}

describe('TEST:1694:1 AC:1694:1 PB4 and PB5 count the V9a owner act', () => {
    it('PB4 waits for a recent owner act and archives without one', async () => {
        const recent = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 200 * DAY),
            lastOwnerActAt: new Date(at.getTime() - 10 * DAY)
        });
        expect(await archive(recent)).toEqual({ archived: false, reason: 'NOT_DUE' });
        expect(recent.statusWrites).toEqual([]);
        expect(recent.statusEvents).toEqual([]);
        expect(recent.listingNotices).toEqual([]);
        expect(recent.ownerActReads).toEqual([{ vertical, listingId }]);
        const noAct = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 200 * DAY),
            lastOwnerActAt: null
        });
        expect(await archive(noAct)).toMatchObject({ archived: true, transition: 'PB4' });
    });

    it('PB4 preserves the deletion distance from the owner-act clock and takes the maximum', async () => {
        const recentEnough = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 200 * DAY),
            lastOwnerActAt: new Date(at.getTime() - 95 * DAY)
        });
        expect(await archive(recentEnough)).toMatchObject({
            archived: true,
            transition: 'PB4',
            deletionAnnouncedAt: new Date(at.getTime() + 90 * DAY)
        });
        const older = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 100 * DAY),
            lastOwnerActAt: new Date(at.getTime() - 300 * DAY)
        });
        expect(await archive(older)).toMatchObject({
            archived: true,
            transition: 'PB4',
            deletionAnnouncedAt: new Date(at.getTime() + 90 * DAY)
        });
    });

    it('PB5 waits for a recent act and uses its calendar-month clock', async () => {
        const recent = makeHarness({
            status: Status.DRAFT,
            covered: false,
            inactiveSince: new Date(at.getTime() - 200 * DAY),
            lastOwnerActAt: new Date(at.getTime() - 10 * DAY)
        });
        expect(await archive(recent)).toEqual({ archived: false, reason: 'NOT_DUE' });
        expect(recent.statusWrites).toEqual([]);
        const act = new Date(at.getTime() - 120 * DAY);
        const draft = makeHarness({
            status: Status.DRAFT,
            covered: false,
            inactiveSince: new Date(at.getTime() - 200 * DAY),
            lastOwnerActAt: act
        });
        const dueAt = addCalendarMonthsUtc({ at: act, months: 3 });
        const deletionAnnouncedAt = new Date(
            at.getTime() + (act.getTime() + 180 * DAY - dueAt.getTime())
        );
        expect(await archive(draft)).toMatchObject({
            archived: true,
            transition: 'PB5',
            deletionAnnouncedAt
        });
    });

    it('does not read owner acts when retention is stopped or coverage is present', async () => {
        const stopped = makeHarness({
            status: Status.PUBLISHED,
            retention: { stopped: true, pauseEndedAt: null }
        });
        expect(await archive(stopped)).toEqual({ archived: false, reason: 'RETENTION_STOPPED' });
        expect(stopped.ownerActReads).toEqual([]);
        const covered = makeHarness({ status: Status.PUBLISHED, covered: true });
        expect(await archive(covered)).toEqual({ archived: false, reason: 'COVERED' });
        expect(covered.ownerActReads).toEqual([]);
    });
});
