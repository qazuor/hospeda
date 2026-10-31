/** @file Regression for HOS-1948: the dashboard counted drafts as published listings. */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { summarizeListingVisibility } from '@/lib/listing/dashboard-listing-counts';

const withStatus = (...statuses: PublicationStatusEnum[]) =>
    statuses.map((publicationStatus) => ({ publicationStatus }));

describe('summarizeListingVisibility (HOS-1948)', () => {
    it('counts zero published when every listing is a draft (the reported account)', () => {
        const result = summarizeListingVisibility({
            listings: withStatus(
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.DRAFT
            )
        });

        expect(result).toEqual({ published: 0, hidden: 3 });
    });

    it('counts only PUBLISHED as published and DRAFT or UNPUBLISHED_BY_BILLING as hidden', () => {
        const result = summarizeListingVisibility({
            listings: withStatus(
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            )
        });

        expect(result).toEqual({ published: 2, hidden: 2 });
    });

    it('counts archived, moderated and purged listings toward neither number', () => {
        const result = summarizeListingVisibility({
            listings: withStatus(
                PublicationStatusEnum.ARCHIVED,
                PublicationStatusEnum.MODERATED,
                PublicationStatusEnum.PURGED
            )
        });

        expect(result).toEqual({ published: 0, hidden: 0 });
    });

    it('does not count a listing whose status is missing as published', () => {
        const result = summarizeListingVisibility({ listings: [{}] });

        expect(result).toEqual({ published: 0, hidden: 0 });
    });
});
