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

const overdue = new Date(at.getTime() - 100 * 86_400_000);
const otherListingId = '00000000-0000-4000-8000-000000000003';

function addonSource(args: {
    readonly scope: 'LISTING' | 'VERTICAL';
    readonly target: string | null;
}) {
    return {
        type: 'ADDON' as const,
        reference: { kind: 'ADDON_VERSION' as const, addonVersionId: 'addon-version-1' },
        scope: args.scope,
        target: args.target,
        since: at,
        until: 'NO_KNOWN_DATE' as const,
        charged: null,
        floor: null
    };
}

async function archive(harness: ReturnType<typeof makeHarness>, correlationId: string) {
    return archiveInactiveListing({
        ...harness,
        clock,
        vertical,
        listingId,
        ownerId: userId,
        correlationId
    });
}

describe('TEST:V6:36 AC:V6:28 PB4 and PB5 enqueue the on-archive notice in the archive transaction', () => {
    it.each([
        { status: PublicationStatusEnum.PUBLISHED, transition: 'PB4', inactiveSince: overdue },
        {
            status: PublicationStatusEnum.DRAFT,
            transition: 'PB5',
            inactiveSince: new Date('2026-05-01T00:00:00Z')
        }
    ] as const)('TEST:V6:36 $transition from $status enqueues exactly one notice before commit', async ({
        status,
        transition,
        inactiveSince
    }) => {
        const harness = makeHarness({ status, covered: false, inactiveSince });
        const result = await archive(harness, `notice-${transition}`);
        if (!result.archived) throw new Error(`expected an archive, got ${result.reason}`);
        expect(result.transition).toBe(transition);
        expect(harness.listingNotices).toEqual([
            {
                template: 'verticals.listing-archived',
                recipientUserId: userId,
                payload: {
                    vertical,
                    listingId,
                    transition,
                    deletionAnnouncedAt: result.deletionAnnouncedAt.toISOString(),
                    listingAddonCount: 0
                },
                correlationId: `notice-${transition}`,
                occurrenceKey: `listing-archived:${listingId}`
            }
        ]);
        const enqueuedAt = harness.calls.indexOf('enqueueListingNotice');
        expect(enqueuedAt).toBeGreaterThan(harness.calls.indexOf('event'));
        expect(enqueuedAt).toBeLessThan(harness.calls.indexOf('commit'));
    });

    it('TEST:V6:36 enqueues nothing when the transition does not happen', async () => {
        const paused = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: false,
            inactiveSince: overdue,
            retention: { stopped: true, pauseEndedAt: null }
        });
        const covered = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: true,
            inactiveSince: overdue
        });
        const notDue = makeHarness({ status: PublicationStatusEnum.PUBLISHED, covered: false });
        const lost = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: false,
            inactiveSince: overdue,
            setReturnsFalse: true
        });
        const cases = [
            [paused, 'RETENTION_STOPPED'],
            [covered, 'COVERED'],
            [notDue, 'NOT_DUE'],
            [lost, 'STATE_CHANGED']
        ] as const;
        for (const [harness, reason] of cases) {
            await expect(archive(harness, reason)).resolves.toMatchObject({
                archived: false,
                reason
            });
            expect(harness.listingNotices).toEqual([]);
            expect(harness.calls).not.toContain('enqueueListingNotice');
        }
    });

    it('TEST:V6:36 counts only the listing-scoped addons that target this listing', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: overdue,
            sources: [
                addonSource({ scope: 'LISTING', target: listingId }),
                addonSource({ scope: 'LISTING', target: otherListingId }),
                addonSource({ scope: 'VERTICAL', target: null }),
                {
                    type: 'BASE',
                    reference: { kind: 'PLAN_VERSION', planVersionId: 'base-plan-version' },
                    scope: 'VERTICAL',
                    target: null,
                    since: at,
                    until: 'NEVER_EXPIRES',
                    charged: null,
                    floor: null
                }
            ]
        });
        await expect(archive(harness, 'addons')).resolves.toMatchObject({ archived: true });
        expect(harness.listingNotices).toHaveLength(1);
        expect(harness.listingNotices[0]?.payload).toMatchObject({ listingAddonCount: 1 });
    });
});
