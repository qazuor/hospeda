import { PublicationStatusEnum } from '@repo/schemas';
import { recalculateCoverage } from '@repo/verticals';
import { describe, expect, it } from 'vitest';
import {
    at,
    clock,
    makeHarness,
    userId,
    vertical
} from '../../../../../verticals/test/publication/support';
import { planListingReturn } from '../../../../src/services/billing/subscription/late-manual-payment-return-plan';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, publicationStatus: PublicationStatusEnum) => ({
    id: id(n),
    ownerId: userId,
    publicationStatus,
    createdAt: new Date(at.getTime() - n * 1000),
    inactiveSince: at
});

describe('HOS-1640 parity: the MP4 preview «vuelve» and «baja» sets are what PB7 restores and lowers', () => {
    it.each([0, 1, 2, 3, 6])('with a declared limit of %i', async (limit) => {
        // Arrange
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
            row(10, PublicationStatusEnum.DRAFT)
        ];
        const archiveOrigins = new Map([
            [id(5), PublicationStatusEnum.PUBLISHED],
            [id(6), PublicationStatusEnum.DRAFT]
        ]);
        const publicationInstants = new Map([
            [id(1), new Date('2026-01-01T00:00:00Z')],
            [id(2), new Date('2026-02-01T00:00:00Z')],
            [id(3), new Date('2026-04-01T00:00:00Z')],
            [id(4), new Date('2026-03-01T00:00:00Z')]
        ]);
        const incomplete = [id(9)];
        const harness = makeHarness({
            covered: true,
            limit,
            declaredLimit: limit,
            listings,
            archiveOrigins,
            publicationInstants,
            incompleteListingIds: incomplete
        });

        // Act
        const preview = planListingReturn({
            listings: listings.map((listing) => ({ ...listing, name: listing.id })),
            archiveOrigins,
            incompleteIds: new Set(incomplete),
            publishedAt: publicationInstants,
            limit
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: 'hos-1640-parity'
        });

        // Assert
        const returning = preview
            .filter((item) => item.outcome === 'RETURNS')
            .map((item) => item.id)
            .sort();
        const lowered = preview
            .filter((item) => item.outcome === 'LOWERED_BY_SURPLUS')
            .map((item) => item.id)
            .sort();
        expect(returning).toEqual([...result.restored].sort());
        expect(lowered).toEqual([...result.lowered].sort());
    });
});
