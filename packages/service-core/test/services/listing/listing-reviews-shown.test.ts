import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { listingShowsReviews } from '../../../src/services/listing/listing-reviews-shown.js';

describe('listingShowsReviews (AC:V9b:3, TRANS:V:PB9)', () => {
    it.each(
        Object.values(PublicationStatusEnum)
    )('returns the PURGED visibility rule for %s', (publicationStatus) => {
        expect(listingShowsReviews({ publicationStatus })).toBe(
            publicationStatus !== PublicationStatusEnum.PURGED
        );
    });
});
