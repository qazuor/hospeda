/** TEST:V6:5 — restitution notice is queued inside the PB3 transaction. */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const candidates: readonly PublicationListing[] = ['a', 'b', 'c'].map((suffix, index) => ({
    id: `00000000-0000-4000-8000-00000000000${suffix}`,
    ownerId: userId,
    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    createdAt: new Date(at.getTime() + index),
    inactiveSince: at
}));

describe('coverage restitution notice', () => {
    it('enqueues restored and not-restored candidate ids before commit', async () => {
        const harness = makeHarness({ listings: candidates, limit: 2 });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.restored).toHaveLength(2);
        expect(harness.restitutionNotices).toHaveLength(1);
        expect(harness.restitutionNotices[0]?.payload.restoredListingIds).toEqual(result.restored);
        expect(harness.restitutionNotices[0]?.payload.notRestoredListingIds).toHaveLength(1);
        expect(harness.restitutionNotices[0]?.payload.criterion).toBe('LAST_FELL_FIRST_BACK');
        expect(harness.calls.indexOf('enqueueRestitutionNotice')).toBeLessThan(
            harness.calls.indexOf('commit')
        );
    });

    it('does not enqueue when no candidate is restored', async () => {
        const harness = makeHarness({ listings: candidates, limit: 0 });
        await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(harness.restitutionNotices).toHaveLength(0);
    });

    it('rolls the queued notice back with the publication transaction', async () => {
        const harness = makeHarness({ listings: candidates, limit: 2, failTransaction: true });
        await expect(
            recalculateCoverage({
                ...harness,
                clock,
                userId,
                vertical,
                correlationId: listingId
            })
        ).rejects.toThrow('rollback');
        expect(harness.restitutionNotices).toHaveLength(0);
    });
});
