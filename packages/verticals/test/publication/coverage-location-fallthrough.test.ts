/**
 * HOS-1640 B1 regression: a restore write that answers "not changed" inside the lock (the
 * HOS-1810 one-address rule, a deleted row) must leave its slot to the next candidate.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const a = '00000000-0000-4000-8000-0000000000b1';
const b = '00000000-0000-4000-8000-0000000000b2';
const c = '00000000-0000-4000-8000-0000000000b3';

const fallen = (id: string): PublicationListing => ({
    id,
    ownerId: userId,
    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    createdAt: at,
    inactiveSince: at
});

/** A was published most recently, then B, then C: the restore order is A, B, C. */
const publicationInstants = new Map([
    [a, new Date('2026-10-03T00:00:00Z')],
    [b, new Date('2026-10-02T00:00:00Z')],
    [c, new Date('2026-10-01T00:00:00Z')]
]);

describe('PB7 restore loop: a refused write does not spend a slot (HOS-1640 B1)', () => {
    it('quota 2, B refused: restores A and C', async () => {
        // Arrange
        const harness = makeHarness({
            listings: [fallen(a), fallen(b), fallen(c)],
            limit: 2,
            publicationInstants,
            setReturnsFalseFor: [b]
        });

        // Act
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });

        // Assert
        expect(result.restored).toEqual([a, c]);
        expect(harness.statusOf(b)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('quota 2, A and B share an address, C does not: restores A and C', async () => {
        // Arrange
        const harness = makeHarness({
            listings: [fallen(a), fallen(b), fallen(c)],
            limit: 2,
            publicationInstants,
            locations: new Map([
                [a, { key: 'calle-1', exempt: false }],
                [b, { key: 'calle-1', exempt: false }],
                [c, { key: 'calle-2', exempt: false }]
            ])
        });

        // Act
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });

        // Assert
        expect(result.restored).toEqual([a, c]);
        expect(harness.statusOf(b)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('quota 1, A refused: the single slot goes to B', async () => {
        // Arrange
        const harness = makeHarness({
            listings: [fallen(a), fallen(b), fallen(c)],
            limit: 1,
            publicationInstants,
            setReturnsFalseFor: [a]
        });

        // Act
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });

        // Assert
        expect(result.restored).toEqual([b]);
    });
});
