/** TEST:1744:1 — incomplete billing candidates are skipped during restitution. */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, makeHarness, userId, vertical } from './support';

const completeId = '00000000-0000-4000-8000-000000000101';
const incompleteId = '00000000-0000-4000-8000-000000000102';
const candidates: readonly PublicationListing[] = [completeId, incompleteId].map((id, index) => ({
    id,
    ownerId: userId,
    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    createdAt: new Date(at.getTime() + index),
    inactiveSince: at
}));

describe('coverage restitution completeness', () => {
    it('restores only the complete candidate', async () => {
        const harness = makeHarness({
            listings: candidates,
            limit: 3,
            incompleteListingIds: [incompleteId]
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: completeId
        });
        expect(result.restored).toEqual([completeId]);
        expect(harness.statusWrites.map(({ listingId: id }) => id)).toEqual([completeId]);
    });

    it('does not let an earlier incomplete candidate consume the only available slot', async () => {
        const orderedCandidates = [incompleteId, completeId].map((id, index) => ({
            id,
            ownerId: userId,
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            createdAt: new Date(at.getTime() + index),
            inactiveSince: at
        })) satisfies readonly PublicationListing[];
        const harness = makeHarness({
            listings: orderedCandidates,
            limit: 1,
            incompleteListingIds: [incompleteId]
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: completeId
        });
        expect(result.restored).toEqual([completeId]);
    });

    it('keeps an incomplete returnable archive archived', async () => {
        const archived = {
            ...candidates[0]!,
            id: completeId,
            publicationStatus: PublicationStatusEnum.ARCHIVED
        };
        const harness = makeHarness({
            listings: [archived],
            archiveOrigins: new Map([[completeId, PublicationStatusEnum.PUBLISHED]]),
            incompleteListingIds: [completeId],
            limit: 1
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: incompleteId
        });
        expect(result.restored).toEqual([]);
        expect(harness.statusWrites).toEqual([]);
    });

    it('omits incomplete candidates from the notice and queues no notice when all are incomplete', async () => {
        const harness = makeHarness({
            listings: candidates,
            limit: 3,
            incompleteListingIds: [incompleteId]
        });
        await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: completeId
        });
        expect(harness.restitutionNotices[0]?.payload.restoredListingIds).toEqual([completeId]);
        expect(harness.restitutionNotices[0]?.payload.notRestoredListingIds).toEqual([]);

        const allIncomplete = makeHarness({
            listings: candidates,
            limit: 3,
            incompleteListingIds: [completeId, incompleteId]
        });
        await recalculateCoverage({
            ...allIncomplete,
            clock,
            userId,
            vertical,
            correlationId: completeId
        });
        expect(allIncomplete.restitutionNotices).toEqual([]);
    });
});
