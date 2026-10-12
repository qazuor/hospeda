import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { PurgeAfterCommit } from '../../src/publication/publication-types';
import { purgeListing } from '../../src/publication/purge-listing';
import { at, clock, listingId, makeHarness, userId } from './support';

const media = { mediaId: 'media-1', publicId: 'remote-1' };
const emptyContent = {
    markedMedia: [],
    markedCalendar: [],
    closedAlerts: [],
    closedFixRequestId: null
};

function createAfterCommit(calls: string[], failMedia = false): PurgeAfterCommit {
    return {
        async emitCoverageChanged() {},
        async invalidateUser() {},
        async revalidate() {
            calls.push('revalidate');
        },
        async emitListingPurged() {
            calls.push('emit');
        },
        async deleteRemoteMedia() {
            calls.push('media');
            if (failMedia) throw new Error('storage unavailable');
        },
        async revokeCalendarConnection() {
            calls.push('calendar');
        }
    };
}

describe('TEST:V6:13 PB12', () => {
    it('TEST:V6:13 locks, rereads, transitions, purges, commits, then emits and deletes remotes', async () => {
        const harness = makeHarness({
            purgeContent: {
                ...emptyContent,
                markedMedia: [media],
                closedAlerts: [{ alertId: 'alert-1', touristUserId: 'tourist-1' }],
                closedFixRequestId: 'fix-1'
            }
        });
        const result = await purgeListing({
            ...harness,
            clock,
            afterCommit: createAfterCommit(harness.calls),
            actor: { kind: 'owner', userId },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            correlationId: 'corr-purge'
        });
        expect(result).toMatchObject({
            purged: true,
            from: Status.DRAFT,
            markedMedia: 1,
            closedAlerts: 1
        });
        expect(harness.calls).toEqual([
            'lock',
            'read',
            'set',
            'event',
            'purgeListingContent',
            'fixRequestEvent',
            'enqueueListingNotice',
            'enqueueListingNotice',
            'commit',
            'emit',
            'media'
        ]);
        expect(harness.listingNotices[0]?.payload).toMatchObject({ bySupport: false });
    });

    it('TEST:V6:13 rejects PURGED and does not write when the conditional transition loses', async () => {
        const alreadyPurged = makeHarness({ status: Status.PURGED });
        const invalid = await purgeListing({
            ...alreadyPurged,
            clock,
            afterCommit: createAfterCommit(alreadyPurged.calls),
            actor: { kind: 'owner', userId },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            correlationId: 'corr-invalid'
        });
        expect(invalid).toEqual({ purged: false, reason: 'INVALID_FROM' });
        expect(alreadyPurged.calls).toEqual(['lock', 'read', 'commit']);

        const raced = makeHarness({ setReturnsFalse: true });
        const changed = await purgeListing({
            ...raced,
            clock,
            afterCommit: createAfterCommit(raced.calls),
            actor: { kind: 'owner', userId },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            correlationId: 'corr-raced'
        });
        expect(changed).toEqual({ purged: false, reason: 'STATE_CHANGED' });
        expect(raced.calls).toEqual(['lock', 'read', 'commit']);
    });

    it('TEST:V6:13 sets the support actor payload and isolates remote deletion failures', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            purgeContent: {
                ...emptyContent,
                markedMedia: [media, { mediaId: 'media-2', publicId: 'remote-2' }],
                markedCalendar: [{ connectionId: 'calendar-1', provider: 'GOOGLE_CALENDAR' }]
            }
        });
        const afterCommit = createAfterCommit(harness.calls, true);
        const emit = vi.spyOn(afterCommit, 'emitListingPurged');
        const result = await purgeListing({
            ...harness,
            clock,
            afterCommit,
            actor: {
                kind: 'support',
                adminId: 'admin-1',
                ownerId: userId,
                reason: 'Owner requested removal'
            },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            correlationId: 'corr-support'
        });
        expect(result).toMatchObject({
            purged: true,
            from: Status.PUBLISHED,
            warnings: ['REMOTE_DELETION_FAILED', 'REMOTE_DELETION_FAILED']
        });
        expect(harness.statusWrites[0]).toMatchObject({ to: Status.PURGED, actorId: 'admin-1' });
        expect(harness.statusEvents[0]).toMatchObject({
            actorType: 'admin',
            actorId: 'admin-1',
            reason: 'Owner requested removal'
        });
        expect(harness.listingNotices[0]?.payload).toMatchObject({ bySupport: true });
        expect(harness.calls.indexOf('commit')).toBeLessThan(harness.calls.indexOf('emit'));
        expect(harness.calls).toContain('revalidate');
        expect(harness.calls.filter((call) => call === 'media')).toHaveLength(2);
        expect(harness.calls).toContain('calendar');
        expect(harness.calls).toContain('calendar');
        expect(emit).toHaveBeenCalledOnce();
        expect(at.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    });

    it('TEST:V6:13 requires a support reason before taking the lock', async () => {
        const harness = makeHarness();
        const result = await purgeListing({
            ...harness,
            clock,
            afterCommit: createAfterCommit(harness.calls),
            actor: { kind: 'support', adminId: 'admin-1', ownerId: userId, reason: '  ' },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            correlationId: 'corr-reason'
        });
        expect(result).toEqual({ purged: false, reason: 'REASON_REQUIRED' });
        expect(harness.calls).toEqual([]);
    });
});
