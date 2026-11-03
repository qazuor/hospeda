/** HOS-1984: when coverage returns with the cap full, the newest manual publish stays published. */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const oldId = '00000000-0000-4000-8000-0000000000a1';
const newId = '00000000-0000-4000-8000-0000000000a2';

const fallen = (id: string, createdOffset: number): PublicationListing => ({
    id,
    ownerId: userId,
    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    createdAt: new Date(at.getTime() + createdOffset),
    inactiveSince: at
});

describe('coverage return with a full cap (HOS-1984)', () => {
    it('keeps the listing the host published most recently and leaves the older one unpublished', async () => {
        // Arrange: the old listing was published long ago, the new one just now. Both fell.
        const harness = makeHarness({
            listings: [fallen(oldId, 0), fallen(newId, 1000)],
            limit: 1,
            publicationInstants: new Map([
                [oldId, new Date('2026-09-01T00:00:00Z')],
                [newId, new Date('2026-10-31T22:26:31Z')]
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
        expect(result.restored).toEqual([newId]);
        expect(harness.statusOf(newId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.statusOf(oldId)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('orders by manual publish instant, not by creation time', async () => {
        // The listing created EARLIER carries the NEWER manual publish instant.
        const harness = makeHarness({
            listings: [fallen(oldId, 0), fallen(newId, 1000)],
            limit: 1,
            publicationInstants: new Map([
                [oldId, new Date('2026-10-31T22:26:31Z')],
                [newId, new Date('2026-09-01T00:00:00Z')]
            ])
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.restored).toEqual([oldId]);
        expect(harness.statusOf(newId)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('ranks a listing with no manual publish instant behind one the host published by hand', async () => {
        const harness = makeHarness({
            listings: [fallen(oldId, 0), fallen(newId, 1000)],
            limit: 1,
            publicationInstants: new Map([[newId, new Date('2026-10-31T22:26:31Z')]])
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.restored).toEqual([newId]);
    });
});
