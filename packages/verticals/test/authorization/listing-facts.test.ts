import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { readListingAccessFacts } from '../../src/authorization/listing-facts';

describe('readListingAccessFacts', () => {
    it('returns null for non-objects and rows without ownerId', () => {
        expect(readListingAccessFacts({ entity: null })).toBeNull();
        expect(readListingAccessFacts({ entity: 1 })).toBeNull();
        expect(readListingAccessFacts({ entity: {} })).toBeNull();
    });

    it.each(
        Object.values(PublicationStatusEnum)
    )('returns the written publication state %s as is', (status) => {
        expect(
            readListingAccessFacts({ entity: { ownerId: 'owner', publicationStatus: status } })
        ).toEqual({ ownerId: 'owner', publicationStatus: status });
    });

    // HOS-1641 (V6.9b): the transitory Coord-43 bridge is gone. A row without a
    // valid written state fails closed — it is never derived as PUBLISHED.
    it.each([
        ['absent', { ownerId: 'owner' }],
        ['NULL', { ownerId: 'owner', publicationStatus: null }],
        ['undefined', { ownerId: 'owner', publicationStatus: undefined }],
        ['unknown', { ownerId: 'owner', publicationStatus: 'OTHER' }],
        ['the old lifecycle value', { ownerId: 'owner', publicationStatus: 'ACTIVE' }]
    ] as const)('fails closed to a null state when the written state is %s', (_name, entity) => {
        expect(readListingAccessFacts({ entity })).toEqual({
            ownerId: 'owner',
            publicationStatus: null
        });
    });

    it('keeps a null owner when ownerId is not a string', () => {
        expect(
            readListingAccessFacts({
                entity: { ownerId: 42, publicationStatus: PublicationStatusEnum.PUBLISHED }
            })
        ).toEqual({ ownerId: null, publicationStatus: PublicationStatusEnum.PUBLISHED });
    });
});
