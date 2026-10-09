import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { readListingAccessFacts } from '../../src/authorization/listing-facts';

describe('readListingAccessFacts', () => {
    it('returns null for non-objects and rows without ownerId', () => {
        expect(readListingAccessFacts({ entity: null })).toBeNull();
        expect(readListingAccessFacts({ entity: 1 })).toBeNull();
        expect(readListingAccessFacts({ entity: {} })).toBeNull();
    });

    it('keeps the owner while treating an unknown publication state as null', () => {
        expect(
            readListingAccessFacts({ entity: { ownerId: 'owner', publicationStatus: 'OTHER' } })
        ).toEqual({ ownerId: 'owner', publicationStatus: null });
        expect(
            readListingAccessFacts({
                entity: {
                    ownerId: 'owner',
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                }
            })
        ).toEqual({ ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED });
    });
});
