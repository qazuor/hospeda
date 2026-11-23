/**
 * HOS-1640 parity: the MP4 preview's listing outcomes are what the coverage reconciler
 * (PB7) does — the same restored set, the same surplus-lowered set — including the
 * HOS-1810 one-address refusal, which leaves the slot to the next candidate.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { planListingReturn } from '../../src/publication/listing-return-preview';
import type { RestorationPlace } from '../../src/publication/publication-order';
import type { PublicationListing } from '../../src/publication/publication-types';
import { at, clock, makeHarness, userId, vertical } from './support';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, publicationStatus: PublicationStatusEnum): PublicationListing => ({
    id: id(n),
    ownerId: userId,
    publicationStatus,
    createdAt: new Date(at.getTime() - n * 1000),
    inactiveSince: at
});

const listings = [
    row(1, PublicationStatusEnum.PUBLISHED),
    row(2, PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
    row(3, PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
    row(4, PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
    row(5, PublicationStatusEnum.ARCHIVED),
    row(6, PublicationStatusEnum.ARCHIVED),
    row(7, PublicationStatusEnum.MODERATED),
    row(8, PublicationStatusEnum.PURGED),
    row(9, PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
    row(10, PublicationStatusEnum.DRAFT),
    row(11, PublicationStatusEnum.PUBLISHED)
];
const archiveOrigins = new Map([
    [id(5), PublicationStatusEnum.PUBLISHED],
    [id(6), PublicationStatusEnum.DRAFT]
]);
const publicationInstants = new Map([
    [id(1), new Date('2026-01-01T00:00:00Z')],
    [id(11), new Date('2026-01-15T00:00:00Z')],
    [id(2), new Date('2026-02-01T00:00:00Z')],
    [id(3), new Date('2026-04-01T00:00:00Z')],
    [id(4), new Date('2026-03-01T00:00:00Z')]
]);
const incomplete = [id(9)];

const place = (key: string | null, exempt = false): RestorationPlace => ({ key, exempt });
const PLACES: Record<string, ReadonlyMap<string, RestorationPlace> | undefined> = {
    none: undefined,
    // 3 (first in order) and 4 share a place; 2 sits where the published 1 is.
    shared: new Map([
        [id(1), place('a')],
        [id(2), place('a')],
        [id(3), place('b')],
        [id(4), place('b')],
        [id(5), place('c')],
        [id(11), place('d')]
    ]),
    // The published 1 holds an exception for its key, so 2 may join it; 5 holds one and
    // may join 3; 4 has no key, which never collides.
    exempt: new Map([
        [id(1), place('a', true)],
        [id(2), place('a')],
        [id(3), place('b')],
        [id(4), place(null)],
        [id(5), place('b', true)],
        [id(11), place('d')]
    ])
};

const sorted = (ids: readonly string[]) => [...ids].sort();

describe('HOS-1640 parity: the MP4 listing preview is what PB7 restores and lowers', () => {
    const cases = Object.keys(PLACES).flatMap((places) =>
        [0, 1, 2, 3, 4, 6].map((limit) => [places, limit] as const)
    );
    it.each(cases)('places %s, declared limit %i', async (places, limit) => {
        // Arrange
        const placeMap = PLACES[places];
        const harness = makeHarness({
            covered: true,
            limit,
            declaredLimit: limit,
            listings,
            archiveOrigins,
            publicationInstants,
            incompleteListingIds: incomplete,
            ...(placeMap ? { locations: placeMap } : {})
        });

        // Act
        const preview = planListingReturn({
            listings: listings.map((listing) => ({ ...listing, name: listing.id })),
            archiveOrigins,
            incompleteIds: new Set(incomplete),
            publishedAt: publicationInstants,
            limit,
            ...(placeMap ? { places: placeMap } : {})
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: 'hos-1640-parity'
        });

        // Assert
        const having = (outcome: string) =>
            sorted(preview.filter((item) => item.outcome === outcome).map((item) => item.id));
        expect(having('RETURNS')).toEqual(sorted(result.restored));
        expect(having('LOWERED_BY_SURPLUS')).toEqual(sorted(result.lowered));
    });

    it('the shared-place case does exercise the refusal: 4 comes back blocked, 2 too', () => {
        // Arrange / Act
        const preview = planListingReturn({
            listings: listings.map((listing) => ({ ...listing, name: listing.id })),
            archiveOrigins,
            incompleteIds: new Set(incomplete),
            publishedAt: publicationInstants,
            limit: 6,
            places: PLACES.shared
        });

        // Assert
        const outcome = (n: number) => preview.find((item) => item.id === id(n))?.outcome;
        expect(outcome(3)).toBe('RETURNS');
        expect(outcome(4)).toBe('LOCATION_CONFLICT');
        expect(outcome(2)).toBe('LOCATION_CONFLICT');
        expect(outcome(5)).toBe('RETURNS');
    });
});
