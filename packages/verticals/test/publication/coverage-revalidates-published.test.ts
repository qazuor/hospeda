/**
 * TEST:6.11:1, AC:6:4 (HOS-1787 F-V1-029) — a coverage recalculation revalidates every listing
 * that was PUBLISHED when it started, plus the ones it lowered or restored. A plan change can
 * strip paid content without moving any publication status, so revalidating only the moved rows
 * would leave the paid page cached (HOS-1793).
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, makeHarness, userId, vertical } from './support';

const firstPublished = '00000000-0000-4000-8000-000000000101';
const secondPublished = '00000000-0000-4000-8000-000000000102';
const draftId = '00000000-0000-4000-8000-000000000103';
const unpublishedId = '00000000-0000-4000-8000-000000000104';

const listing = (id: string, publicationStatus: PublicationStatusEnum): PublicationListing => ({
    id,
    ownerId: userId,
    publicationStatus,
    createdAt: at,
    inactiveSince: at
});

/**
 * Reads the single revalidation call and returns its ids in a stable order. Fails when the
 * task ran more than once, because one coverage pass must schedule one revalidation.
 */
function revalidatedListingIds(harness: ReturnType<typeof makeHarness>): string[] {
    const revalidate = vi.mocked(harness.afterCommit.revalidate);
    expect(revalidate).toHaveBeenCalledTimes(1);
    const [input] = revalidate.mock.calls[0] ?? [];
    expect(input?.vertical).toBe(vertical);
    return [...(input?.listingIds ?? [])].sort();
}

describe('TEST:6.11:1 coverage revalidates every published listing of the owner', () => {
    it('revalidates both published listings when coverage is kept and nothing changes', async () => {
        const harness = makeHarness({
            listings: [
                listing(firstPublished, PublicationStatusEnum.PUBLISHED),
                listing(secondPublished, PublicationStatusEnum.PUBLISHED),
                listing(draftId, PublicationStatusEnum.DRAFT)
            ],
            declaredLimit: 3
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: firstPublished
        });

        expect(result.lowered).toEqual([]);
        expect(result.restored).toEqual([]);
        expect(harness.statusOf(firstPublished)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.statusOf(secondPublished)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.statusOf(draftId)).toBe(PublicationStatusEnum.DRAFT);
        expect(revalidatedListingIds(harness)).toEqual([firstPublished, secondPublished].sort());
    });

    it('revalidates the lowered listing and the one that stayed published, without repeats', async () => {
        const harness = makeHarness({
            listings: [
                listing(firstPublished, PublicationStatusEnum.PUBLISHED),
                listing(secondPublished, PublicationStatusEnum.PUBLISHED)
            ],
            declaredLimit: 1
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: firstPublished
        });

        expect(result.loweredBySurplus).toHaveLength(1);
        expect(result.restored).toEqual([]);
        expect(revalidatedListingIds(harness)).toEqual([firstPublished, secondPublished].sort());
    });

    it('revalidates both listings after losing coverage lowered them', async () => {
        const harness = makeHarness({
            covered: false,
            listings: [
                listing(firstPublished, PublicationStatusEnum.PUBLISHED),
                listing(secondPublished, PublicationStatusEnum.PUBLISHED)
            ]
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: firstPublished
        });

        expect(result.lowered.sort()).toEqual([firstPublished, secondPublished].sort());
        expect(revalidatedListingIds(harness)).toEqual([firstPublished, secondPublished].sort());
    });

    it('revalidates the still-published listing and the one it restored', async () => {
        const harness = makeHarness({
            listings: [
                listing(firstPublished, PublicationStatusEnum.PUBLISHED),
                listing(unpublishedId, PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
            ],
            declaredLimit: 2
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: firstPublished
        });

        expect(result.restored).toEqual([unpublishedId]);
        expect(revalidatedListingIds(harness)).toEqual([firstPublished, unpublishedId].sort());
    });

    it('does not revalidate when the transaction rolls back', async () => {
        const harness = makeHarness({
            covered: false,
            failTransaction: true,
            listings: [listing(firstPublished, PublicationStatusEnum.PUBLISHED)]
        });

        await expect(
            recalculateCoverage({
                ...harness,
                clock,
                userId,
                vertical,
                correlationId: firstPublished
            })
        ).rejects.toThrow('rollback');
        expect(harness.afterCommit.revalidate).not.toHaveBeenCalled();
    });
});
