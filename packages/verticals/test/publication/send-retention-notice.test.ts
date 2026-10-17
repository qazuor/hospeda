import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { addCalendarMonthsUtc } from '../../src/publication/retention-clock';
import {
    LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
    LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
    RETENTION_NOTICE_MILESTONES,
    retentionNoticeAt,
    retentionNoticeTargetDay
} from '../../src/publication/retention-notices';
import { sendRetentionNotice } from '../../src/publication/send-retention-notice';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const day = 86_400_000;
const overdueStart = new Date(at.getTime() - 110 * day);

async function send(harness: ReturnType<typeof makeHarness>, ownerId = userId) {
    return sendRetentionNotice({
        ...harness,
        clock,
        vertical,
        listingId,
        ownerId,
        correlationId: 'retention-test'
    });
}

describe('TEST:V9b:10 AC:V9b:10 sendRetentionNotice', () => {
    it('sends the PB4 notice with the action date in the schedule occurrence', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: overdueStart
        });
        const result = await send(harness);
        const targetAt = new Date(overdueStart.getTime() + 90 * day);
        expect(result).toEqual({ sent: true, notice: 'BEFORE_ARCHIVE', targetAt, enqueued: true });
        expect(harness.retentionNotices).toEqual([
            {
                template: LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
                recipientUserId: userId,
                listingId,
                milestone: RETENTION_NOTICE_MILESTONES.BEFORE_ARCHIVE,
                targetDate: retentionNoticeTargetDay({ at: targetAt }),
                payload: {
                    vertical,
                    listingId,
                    transition: 'PB4',
                    archiveAt: targetAt.toISOString()
                },
                correlationId: 'retention-test'
            }
        ]);
    });

    it('uses PB5 calendar months for a draft archive', async () => {
        const harness = makeHarness({
            status: Status.DRAFT,
            covered: false,
            inactiveSince: overdueStart
        });
        const result = await send(harness);
        const targetAt = addCalendarMonthsUtc({ at: overdueStart, months: 3 });
        expect(result).toMatchObject({ sent: true, notice: 'BEFORE_ARCHIVE', targetAt });
        expect(harness.retentionNotices[0]?.payload).toEqual({
            vertical,
            listingId,
            transition: 'PB5',
            archiveAt: targetAt.toISOString()
        });
    });

    it('sends the deletion notice using the later announced date and recent owner act', async () => {
        const announced = new Date(at.getTime() + 200 * day);
        const announcedHarness = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: overdueStart,
            deletionAnnouncedAt: announced
        });
        const announcedNoticeAt = retentionNoticeAt({ targetAt: announced, daysBefore: 15 });
        const announcedResult = await sendRetentionNotice({
            ...announcedHarness,
            clock: { now: () => announcedNoticeAt },
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'retention-test'
        });
        expect(announcedResult).toMatchObject({
            sent: true,
            notice: 'BEFORE_DELETION',
            targetAt: announced
        });
        expect(announcedHarness.retentionNotices[0]).toMatchObject({
            template: LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
            milestone: RETENTION_NOTICE_MILESTONES.BEFORE_DELETION,
            targetDate: retentionNoticeTargetDay({ at: announced }),
            payload: { vertical, listingId, deletionAt: announced.toISOString() }
        });

        const lastOwnerActAt = new Date(at.getTime() - 10 * day);
        const ownerActHarness = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: overdueStart,
            lastOwnerActAt
        });
        const ownerActTargetAt = new Date(lastOwnerActAt.getTime() + 180 * day);
        const ownerActNoticeAt = retentionNoticeAt({ targetAt: ownerActTargetAt, daysBefore: 15 });
        const ownerActResult = await sendRetentionNotice({
            ...ownerActHarness,
            clock: { now: () => ownerActNoticeAt },
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'retention-test'
        });
        expect(ownerActResult).toMatchObject({
            sent: true,
            notice: 'BEFORE_DELETION',
            targetAt: ownerActTargetAt
        });
    });

    it('does not read the owner act for a pre-archive notice (D1)', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: overdueStart,
            lastOwnerActAt: new Date(at.getTime() - day)
        });
        expect(await send(harness)).toMatchObject({
            sent: true,
            notice: 'BEFORE_ARCHIVE',
            targetAt: new Date(overdueStart.getTime() + 90 * day)
        });
        expect(harness.ownerActReads).toEqual([]);
    });

    it.each([
        Status.MODERATED,
        Status.PURGED
    ])('skips terminal status %s before pause and coverage', async (status) => {
        const harness = makeHarness({ status, covered: false, inactiveSince: overdueStart });
        expect(await send(harness)).toEqual({ sent: false, reason: 'NO_NOTICE_FOR_STATUS' });
        expect(harness.billing.retentionStopped).not.toHaveBeenCalled();
        expect(harness.billing.coverage).not.toHaveBeenCalled();
        expect(harness.retentionNotices).toEqual([]);
    });

    it('stops on pause before checking coverage; covered leaves every listing write empty', async () => {
        const paused = makeHarness({
            status: Status.PUBLISHED,
            retention: { stopped: true, pauseEndedAt: null }
        });
        expect(await send(paused)).toEqual({ sent: false, reason: 'RETENTION_STOPPED' });
        expect(paused.billing.coverage).not.toHaveBeenCalled();
        expect(paused.retentionNotices).toEqual([]);

        const covered = makeHarness({
            status: Status.PUBLISHED,
            covered: true,
            inactiveSince: overdueStart
        });
        expect(await send(covered)).toEqual({ sent: false, reason: 'COVERED' });
        expect(covered.stampWrites).toEqual([]);
        expect(covered.statusWrites).toEqual([]);
        expect(covered.statusEvents).toEqual([]);
        expect(covered.retentionNotices).toEqual([]);
    });

    it('uses an inclusive notice boundary and the configured plazo 4', async () => {
        const targetAt = new Date(overdueStart.getTime() + 90 * day);
        const noticeAt = retentionNoticeAt({ targetAt, daysBefore: 20 });
        const dueClock = { now: () => noticeAt };
        const dueHarness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: overdueStart,
            beforeArchiveDays: 20
        });
        const due = await sendRetentionNotice({
            ...dueHarness,
            clock: dueClock,
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'edge'
        });
        expect(due).toMatchObject({ sent: true, notice: 'BEFORE_ARCHIVE' });
        const earlyClock = { now: () => new Date(noticeAt.getTime() - 1) };
        const earlyHarness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: overdueStart,
            beforeArchiveDays: 20
        });
        expect(
            await sendRetentionNotice({
                ...earlyHarness,
                clock: earlyClock,
                vertical,
                listingId,
                ownerId: userId,
                correlationId: 'early'
            })
        ).toEqual({ sent: false, reason: 'NOT_DUE' });
        expect(earlyHarness.retentionNotices).toEqual([]);
    });

    it('reports existing occurrence as sent but not enqueued; handles missing and foreign rows', async () => {
        const existing = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: overdueStart,
            noticeEnqueued: false
        });
        expect(await send(existing)).toMatchObject({ sent: true, enqueued: false });
        const missing = makeHarness({ retentionListingMissing: true });
        expect(await send(missing)).toEqual({ sent: false, reason: 'LISTING_NOT_FOUND' });
        const foreign = makeHarness({
            status: Status.PUBLISHED,
            ownerId: '00000000-0000-4000-8000-000000000099'
        });
        expect(await send(foreign)).toEqual({ sent: false, reason: 'STATE_CHANGED' });
    });

    it.each([
        Status.PUBLISHED,
        Status.UNPUBLISHED_BY_BILLING,
        Status.DRAFT,
        Status.ARCHIVED,
        Status.MODERATED,
        Status.PURGED
    ])('never writes status, clock, event, or event notice for %s', async (status) => {
        const harness = makeHarness({ status, covered: false, inactiveSince: overdueStart });
        await send(harness);
        expect(harness.stampWrites).toEqual([]);
        expect(harness.statusWrites).toEqual([]);
        expect(harness.statusEvents).toEqual([]);
        expect(harness.listingNotices).toEqual([]);
    });
});
