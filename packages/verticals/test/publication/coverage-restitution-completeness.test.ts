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
});
