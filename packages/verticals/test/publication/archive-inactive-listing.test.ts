import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

describe('TEST:V6:8 archive inactivity', () => {
    it('TEST:V6:8 checks lock, row, pause, coverage, and writes PB4 with announced deletion', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: false,
            recordBillingCalls: true,
            inactiveSince: new Date(at.getTime() - 100 * 86_400_000)
        });
        const result = await archiveInactiveListing({
            ...harness,
            clock,
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'archive-test'
        });
        expect(result).toMatchObject({
            archived: true,
            transition: 'PB4',
            deletionAnnouncedAt: new Date(at.getTime() + 90 * 86_400_000)
        });
        expect(harness.calls.slice(0, 5)).toEqual([
            'lock',
            'readRetention',
            'retentionStopped',
            'coverage',
            'set'
        ]);
        expect(harness.calls).toContain('event');
        expect(harness.calls.at(-1)).toBe('revalidate');
    });

    it('TEST:V6:8 stops on retention, stamps only this listing if covered, and skips a future deadline', async () => {
        const paused = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            retention: { stopped: true, pauseEndedAt: null }
        });
        await expect(
            archiveInactiveListing({
                ...paused,
                clock,
                vertical,
                listingId,
                ownerId: userId,
                correlationId: 'paused'
            })
        ).resolves.toMatchObject({ reason: 'RETENTION_STOPPED' });
        expect(paused.calls).toEqual(['lock', 'readRetention', 'retentionStopped', 'commit']);
        const covered = makeHarness({
            status: PublicationStatusEnum.DRAFT,
            covered: true,
            recordBillingCalls: true
        });
        await expect(
            archiveInactiveListing({
                ...covered,
                clock,
                vertical,
                listingId,
                ownerId: userId,
                correlationId: 'covered'
            })
        ).resolves.toMatchObject({ reason: 'COVERED' });
        expect(covered.calls).toContain('stamp');
        expect(covered.calls).not.toContain('set');
        const future = makeHarness({ status: PublicationStatusEnum.PUBLISHED, covered: false });
        await expect(
            archiveInactiveListing({
                ...future,
                clock,
                vertical,
                listingId,
                ownerId: userId,
                correlationId: 'future'
            })
        ).resolves.toMatchObject({ reason: 'NOT_DUE' });
        expect(future.calls).not.toContain('set');
    });

    it('TEST:V6:8 omits a lost event and revalidates only PB4 from PUBLISHED', async () => {
        const lost = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 100 * 86_400_000),
            setReturnsFalse: true
        });
        await expect(
            archiveInactiveListing({
                ...lost,
                clock,
                vertical,
                listingId,
                ownerId: userId,
                correlationId: 'lost'
            })
        ).resolves.toMatchObject({ reason: 'STATE_CHANGED' });
        expect(lost.calls).not.toContain('event');
        const unpublished = makeHarness({
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            covered: false,
            inactiveSince: new Date(at.getTime() - 100 * 86_400_000)
        });
        const result = await archiveInactiveListing({
            ...unpublished,
            clock,
            vertical,
            listingId,
            ownerId: userId,
            correlationId: 'ubb'
        });
        expect(result).toMatchObject({ archived: true, transition: 'PB4' });
        expect(unpublished.calls).not.toContain('revalidate');
    });
});
