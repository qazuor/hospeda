/**
 * TEST:V6:33 (c), AC:V6:25 (HOS-1477) — every transition of this leaf schedules the revalidation
 * its row of `03` §9 declares. Each case runs the real transition over `makeHarness` and reads
 * `afterCommit.revalidate`. PB9 belongs to V9b and is not here.
 * Catalog: `.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/04-catalogos.md`.
 */
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { liftModeration } from '../../src/publication/lift-moderation';
import { takeDownListing } from '../../src/publication/moderate-listing';
import type { PurgeAfterCommit } from '../../src/publication/publication-types';
import { publishListing } from '../../src/publication/publish-listing';
import { purgeListing } from '../../src/publication/purge-listing';
import { reactivateListing } from '../../src/publication/reactivate-listing';
import { unpublishListing } from '../../src/publication/unpublish-listing';
import {
    at,
    clock,
    emailPseudonym,
    event,
    listingId,
    makeHarness,
    userId,
    vertical
} from './support';

type Harness = ReturnType<typeof makeHarness>;
type Expected = 'revalidates' | 'does not revalidate';

const adminId = '00000000-0000-4000-8000-000000000099';
const longInactive = new Date(at.getTime() - 200 * 86_400_000);

function purgeAfterCommit(harness: Harness): PurgeAfterCommit {
    return {
        ...harness.afterCommit,
        emitListingPurged: vi.fn(async () => {}),
        deleteRemoteMedia: vi.fn(async () => {}),
        revokeCalendarConnection: vi.fn(async () => {})
    };
}

const moderation = (harness: Harness) => ({
    ...harness,
    clock,
    adminId,
    ownerId: userId,
    vertical,
    listingId,
    reason: 'fix the data',
    correlationId: 'test-v6-33'
});

const coverage = (harness: Harness) => ({
    ...harness,
    clock,
    userId,
    vertical,
    correlationId: 'test-v6-33'
});

const archive = (harness: Harness) => ({
    ...harness,
    clock,
    vertical,
    listingId,
    ownerId: userId,
    correlationId: 'test-v6-33'
});

const purge = (harness: Harness) => ({
    ...harness,
    clock,
    afterCommit: purgeAfterCommit(harness),
    actor: { kind: 'owner' as const, userId },
    vertical,
    listingId,
    correlationId: 'test-v6-33'
});

/** One row per transition and origin; `run` performs it and returns the harness it used. */
const ROWS: readonly {
    readonly row: string;
    readonly expected: Expected;
    readonly run: () => Promise<{ readonly harness: Harness; readonly result: unknown }>;
    readonly done: Record<string, unknown>;
}[] = [
    // 04-catalogos.md:699 PB1 revalidates: yes, it reaches PUBLISHED.
    {
        row: 'PB1 from DRAFT',
        expected: 'revalidates',
        done: { published: true },
        run: async () => {
            const harness = makeHarness();
            const result = await publishListing({
                ...harness,
                clock,
                userId,
                vertical,
                listingId,
                event,
                emailPseudonym,
                correlationId: 'test-v6-33'
            });
            return { harness, result };
        }
    },
    // 04-catalogos.md:800 PB2 revalidates: yes, it leaves PUBLISHED.
    {
        row: 'PB2 from PUBLISHED when coverage is lost',
        expected: 'revalidates',
        done: { lowered: [listingId] },
        run: async () => {
            const harness = makeHarness({ status: Status.PUBLISHED, covered: false });
            return { harness, result: await recalculateCoverage(coverage(harness)) };
        }
    },
    // 04-catalogos.md:994 PB3 revalidates: yes, it reaches PUBLISHED.
    {
        row: 'PB3 from UNPUBLISHED_BY_BILLING, covered and within quota',
        expected: 'revalidates',
        done: { restored: [listingId] },
        run: async () => {
            const harness = makeHarness({ status: Status.UNPUBLISHED_BY_BILLING });
            return { harness, result: await recalculateCoverage(coverage(harness)) };
        }
    },
    // 04-catalogos.md:1088 PB4 revalidates: yes when it leaves PUBLISHED.
    {
        row: 'PB4 from PUBLISHED',
        expected: 'revalidates',
        done: { archived: true, transition: 'PB4' },
        run: async () => {
            const harness = makeHarness({
                status: Status.PUBLISHED,
                covered: false,
                inactiveSince: longInactive
            });
            return { harness, result: await archiveInactiveListing(archive(harness)) };
        }
    },
    // 04-catalogos.md:1088 PB4 from UNPUBLISHED_BY_BILLING: no.
    {
        row: 'PB4 from UNPUBLISHED_BY_BILLING',
        expected: 'does not revalidate',
        done: { archived: true, transition: 'PB4' },
        run: async () => {
            const harness = makeHarness({
                status: Status.UNPUBLISHED_BY_BILLING,
                covered: false,
                inactiveSince: longInactive
            });
            return { harness, result: await archiveInactiveListing(archive(harness)) };
        }
    },
    // 04-catalogos.md:1102 PB5 revalidates: no, DRAFT is not public.
    {
        row: 'PB5 from DRAFT',
        expected: 'does not revalidate',
        done: { archived: true, transition: 'PB5' },
        run: async () => {
            const harness = makeHarness({
                status: Status.DRAFT,
                covered: false,
                inactiveSince: longInactive
            });
            return { harness, result: await archiveInactiveListing(archive(harness)) };
        }
    },
    // 04-catalogos.md:1116 PB6 revalidates: yes, it leaves PUBLISHED.
    {
        row: 'PB6 from PUBLISHED',
        expected: 'revalidates',
        done: { unpublished: true },
        run: async () => {
            const harness = makeHarness({ status: Status.PUBLISHED });
            const result = await unpublishListing({
                ...harness,
                clock,
                userId,
                vertical,
                listingId,
                correlationId: 'test-v6-33'
            });
            return { harness, result };
        }
    },
    // 04-catalogos.md:1130 PB7 revalidates: yes, it reaches PUBLISHED.
    {
        row: 'PB7 from an ARCHIVED listing archived from PUBLISHED, covered and within quota',
        expected: 'revalidates',
        done: { restoredFromArchived: [listingId] },
        run: async () => {
            const harness = makeHarness({
                covered: true,
                limit: 1,
                status: Status.ARCHIVED,
                archiveOrigins: new Map([[listingId, Status.PUBLISHED]])
            });
            return { harness, result: await recalculateCoverage(coverage(harness)) };
        }
    },
    // 04-catalogos.md:1270 PB8 revalidates: no, neither ARCHIVED nor DRAFT is public.
    {
        row: 'PB8 from ARCHIVED',
        expected: 'does not revalidate',
        done: { reactivated: true },
        run: async () => {
            const harness = makeHarness({ status: Status.ARCHIVED });
            const result = await reactivateListing({
                ...harness,
                clock,
                vertical,
                listingId,
                userId,
                correlationId: 'test-v6-33'
            });
            return { harness, result };
        }
    },
    // 04-catalogos.md:1299 PB10 revalidates: yes when it leaves PUBLISHED.
    {
        row: 'PB10 from PUBLISHED',
        expected: 'revalidates',
        done: { ok: true },
        run: async () => {
            const harness = makeHarness({ status: Status.PUBLISHED });
            return { harness, result: await takeDownListing(moderation(harness)) };
        }
    },
    // 04-catalogos.md:1299 PB10 from the other three origins: no.
    {
        row: 'PB10 from DRAFT',
        expected: 'does not revalidate',
        done: { ok: true },
        run: async () => {
            const harness = makeHarness({ status: Status.DRAFT });
            return { harness, result: await takeDownListing(moderation(harness)) };
        }
    },
    // 04-catalogos.md:1481 PB11 revalidates: no, neither MODERATED nor DRAFT is public.
    {
        row: 'PB11 from MODERATED with a DRAFT origin',
        expected: 'does not revalidate',
        done: { ok: true, transition: 'PB11' },
        run: async () => {
            const harness = makeHarness({
                status: Status.MODERATED,
                moderationOrigin: { from: Status.DRAFT, archiveOrigin: null }
            });
            const result = await liftModeration({ ...moderation(harness), keepFixRequest: false });
            return { harness, result };
        }
    },
    // 04-catalogos.md:1495 PB12 revalidates: yes when it leaves PUBLISHED.
    {
        row: 'PB12 from PUBLISHED',
        expected: 'revalidates',
        done: { purged: true },
        run: async () => {
            const harness = makeHarness({ status: Status.PUBLISHED });
            return { harness, result: await purgeListing(purge(harness)) };
        }
    },
    // 04-catalogos.md:1495 PB12 from the other four origins: no.
    {
        row: 'PB12 from DRAFT',
        expected: 'does not revalidate',
        done: { purged: true },
        run: async () => {
            const harness = makeHarness({ status: Status.DRAFT });
            return { harness, result: await purgeListing(purge(harness)) };
        }
    },
    // 04-catalogos.md:1509 PB13 revalidates: not by itself; when the same act ends PUBLISHED through
    // PB3 (or lowers a published one through PB2), those rows revalidate. With quota: PB3.
    {
        row: 'PB13 with coverage and quota, back to PUBLISHED through PB3',
        expected: 'revalidates',
        done: { ok: true, transition: 'PB13', publicationStatus: Status.PUBLISHED },
        run: async () => {
            const harness = makeHarness({
                status: Status.MODERATED,
                covered: true,
                moderationOrigin: { from: Status.PUBLISHED, archiveOrigin: null }
            });
            const result = await liftModeration({ ...moderation(harness), keepFixRequest: false });
            return { harness, result };
        }
    },
    // 04-catalogos.md:1509 PB13 not by itself: without coverage it stays UNPUBLISHED_BY_BILLING.
    {
        row: 'PB13 without coverage, left UNPUBLISHED_BY_BILLING',
        expected: 'does not revalidate',
        done: { ok: true, transition: 'PB13', publicationStatus: Status.UNPUBLISHED_BY_BILLING },
        run: async () => {
            const harness = makeHarness({
                status: Status.MODERATED,
                covered: false,
                moderationOrigin: { from: Status.PUBLISHED, archiveOrigin: null }
            });
            const result = await liftModeration({ ...moderation(harness), keepFixRequest: false });
            return { harness, result };
        }
    }
];

describe('TEST:V6:33 every transition schedules the revalidation its 03 §9 row declares', () => {
    it('covers every transition of the leaf (PB1 to PB8, PB10 to PB13)', () => {
        const transitions = new Set(ROWS.map((entry) => entry.row.split(' ')[0]));
        expect([...transitions].sort()).toEqual(
            [
                'PB1',
                'PB2',
                'PB3',
                'PB4',
                'PB5',
                'PB6',
                'PB7',
                'PB8',
                'PB10',
                'PB11',
                'PB12',
                'PB13'
            ].sort()
        );
    });

    it.each(
        ROWS.map((entry) => [entry.row, entry.expected, entry] as const)
    )('%s %s', async (_row, expected, entry) => {
        const { harness, result } = await entry.run();
        expect(result).toMatchObject(entry.done);
        if (expected === 'revalidates') {
            expect(harness.afterCommit.revalidate).toHaveBeenCalledWith({
                vertical,
                listingIds: expect.arrayContaining([listingId])
            });
        } else {
            expect(harness.afterCommit.revalidate).not.toHaveBeenCalled();
        }
    });
});
