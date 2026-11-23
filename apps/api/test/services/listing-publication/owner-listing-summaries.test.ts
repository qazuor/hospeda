/**
 * Tests for buildOwnerListingSummaries (HOS-2484): the `/mine` summaries carry
 * each unpublished listing's unmet publish requirements from ONE batch read,
 * and a failed read leaves the field out instead of inventing a checklist.
 */
import { ProductDomainEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ completeness: vi.fn() }));

vi.mock('../../../src/services/listing-publication/listing-publish-completeness-batch', () => ({
    evaluateListingsPublishCompleteness: mocks.completeness
}));

import { buildOwnerListingSummaries } from '../../../src/services/listing-publication/owner-listing-summaries';

const row = (id: string, publicationStatus: PublicationStatusEnum) =>
    ({ id, name: `L-${id}`, slug: `l-${id}`, type: 'CAFE', publicationStatus }) as never;

const ROWS = [
    row('pub', PublicationStatusEnum.PUBLISHED),
    row('draft', PublicationStatusEnum.DRAFT),
    row('done', PublicationStatusEnum.DRAFT),
    row('billing', PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
    row('purged', PublicationStatusEnum.PURGED)
];

describe('buildOwnerListingSummaries', () => {
    beforeEach(() => {
        mocks.completeness.mockReset();
    });

    it('evaluates only the unpublished, non-deleted listings, in one call', async () => {
        // Arrange
        mocks.completeness.mockResolvedValue(new Map([['draft', ['name']]]));

        // Act
        await buildOwnerListingSummaries({ vertical: VerticalEnum.VENUE, listings: ROWS });

        // Assert
        expect(mocks.completeness).toHaveBeenCalledTimes(1);
        const arg = mocks.completeness.mock.calls[0]?.[0] as {
            vertical: string;
            listings: { id: string }[];
        };
        expect(arg.vertical).toBe(VerticalEnum.VENUE);
        expect(arg.listings.map((listing) => listing.id)).toEqual(['draft', 'done', 'billing']);
    });

    it('attaches missingRequirements (empty when complete) only where a checklist applies', async () => {
        // Arrange
        mocks.completeness.mockResolvedValue(new Map([['draft', ['name', 'media.featuredImage']]]));

        // Act
        const summaries = await buildOwnerListingSummaries({
            vertical: VerticalEnum.EXPERIENCE,
            listings: ROWS
        });

        // Assert
        const byId = new Map(summaries.map((summary) => [summary.id, summary]));
        expect(byId.get('draft')?.missingRequirements).toEqual(['name', 'media.featuredImage']);
        expect(byId.get('done')?.missingRequirements).toEqual([]);
        expect(byId.get('billing')?.missingRequirements).toEqual([]);
        expect(byId.get('pub')).not.toHaveProperty('missingRequirements');
        expect(byId.get('purged')).not.toHaveProperty('missingRequirements');
        expect(byId.get('pub')).toMatchObject({
            vertical: ProductDomainEnum.EXPERIENCE,
            isPublic: true,
            hasPublicPage: true
        });
        expect(byId.get('draft')).toMatchObject({ isPublic: false, hasPublicPage: false });
    });

    it('leaves the field out when the batch read fails (unknown, never complete)', async () => {
        // Arrange
        mocks.completeness.mockRejectedValue(new Error('db down'));

        // Act
        const summaries = await buildOwnerListingSummaries({
            vertical: VerticalEnum.VENUE,
            listings: ROWS
        });

        // Assert
        expect(summaries).toHaveLength(5);
        for (const summary of summaries) {
            expect(summary).not.toHaveProperty('missingRequirements');
        }
    });
});
