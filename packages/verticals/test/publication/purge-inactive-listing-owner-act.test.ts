import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { at, listingId, makeHarness, userId, vertical } from './support';

const DAY = 86_400_000;
const inactiveSince = new Date(at.getTime() - 300 * DAY);
const coverageLostAt = new Date(inactiveSince.getTime() - DAY);

function input(lastOwnerActAt: Date | null, deletionAnnouncedAt = new Date(at.getTime() - DAY)) {
    const harness = makeHarness({
        status: Status.ARCHIVED,
        inactiveSince,
        deletionAnnouncedAt,
        deletionAfterDays: 180,
        lastOwnerActAt,
        covered: false,
        retention: { stopped: false, pauseEndedAt: null, coverageLostAt }
    });
    return {
        harness,
        args: {
            ...harness,
            unitOfWork: harness.unitOfWork,
            billing: harness.billing,
            clock: { now: () => at },
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'owner-act-test',
            afterCommit: harness.retentionAfterCommit,
            previousPassStartedAt: at
        }
    };
}

describe('TEST:V9b:9 AC:V9b:9 PB9 counts fact 1 from the V9a register', () => {
    it('purges when there is no owner act', async () => {
        const { args } = input(null);
        await expect(purgeInactiveListing(args)).resolves.toMatchObject({ purged: true });
    });

    it('does not purge after a recent owner act and has no write effects', async () => {
        const { harness, args } = input(new Date(at.getTime() - 10 * DAY));
        await expect(purgeInactiveListing(args)).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(harness.calls).not.toContain('set');
        expect(harness.calls).not.toContain('event');
        expect(harness.calls).not.toContain('purgeListingContent');
        expect(harness.stampWrites).toEqual([]);
        expect(harness.calls).not.toContain('emitListingPurged');
        expect(harness.calls).not.toContain('deleteRemoteMedia');
        expect(harness.calls).not.toContain('revokeCalendarConnection');
    });

    it('purges after 180 days from an older owner act and returns that dueAt', async () => {
        const act = new Date(at.getTime() - 200 * DAY);
        const { args } = input(act, new Date(act.getTime() + 179 * DAY));
        await expect(purgeInactiveListing(args)).resolves.toMatchObject({
            purged: true,
            dueAt: new Date(act.getTime() + 180 * DAY)
        });
    });

    it('purges exactly at 180 days and waits until one millisecond later', async () => {
        const dueAct = new Date(at.getTime() - 180 * DAY);
        const due = input(dueAct);
        await expect(purgeInactiveListing(due.args)).resolves.toMatchObject({ purged: true });

        const before = input(new Date(dueAct.getTime() + 1));
        await expect(purgeInactiveListing(before.args)).resolves.toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
    });

    it('reads the owner act once under lock with the listing identifiers', async () => {
        const { harness, args } = input(null);
        await purgeInactiveListing(args);
        expect(harness.ownerActReads).toEqual([{ vertical, listingId }]);
    });

    it('does not read the owner register while paused or covered', async () => {
        const paused = makeHarness({
            status: Status.ARCHIVED,
            inactiveSince,
            retention: { stopped: true, pauseEndedAt: null },
            covered: false
        });
        await purgeInactiveListing({
            ...paused,
            unitOfWork: paused.unitOfWork,
            billing: paused.billing,
            clock: { now: () => at },
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'paused',
            afterCommit: paused.retentionAfterCommit,
            previousPassStartedAt: at
        });
        expect(paused.ownerActReads).toEqual([]);

        const covered = makeHarness({
            status: Status.ARCHIVED,
            inactiveSince,
            retention: { stopped: false, pauseEndedAt: null },
            covered: true
        });
        await purgeInactiveListing({
            ...covered,
            unitOfWork: covered.unitOfWork,
            billing: covered.billing,
            clock: { now: () => at },
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'covered',
            afterCommit: covered.retentionAfterCommit,
            previousPassStartedAt: at
        });
        expect(covered.ownerActReads).toEqual([]);
    });
});
