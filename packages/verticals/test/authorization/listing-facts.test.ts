import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    readListingAccessFacts,
    resolveEffectivePublicationStatus
} from '../../src/authorization/listing-facts';

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
                    publicationStatus: 'OTHER',
                    lifecycleState: 'ACTIVE',
                    visibility: 'PUBLIC'
                }
            })
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

describe('resolveEffectivePublicationStatus (transitory V6.9 bridge)', () => {
    it.each([
        [
            'written DRAFT wins',
            PublicationStatusEnum.DRAFT,
            'ACTIVE',
            'PUBLIC',
            PublicationStatusEnum.DRAFT
        ],
        [
            'written PUBLISHED wins',
            PublicationStatusEnum.PUBLISHED,
            'DRAFT',
            'PRIVATE',
            PublicationStatusEnum.PUBLISHED
        ],
        ['ACTIVE + PUBLIC', null, 'ACTIVE', 'PUBLIC', PublicationStatusEnum.PUBLISHED],
        ['ACTIVE + PRIVATE', null, 'ACTIVE', 'PRIVATE', null],
        ['DRAFT + PUBLIC', null, 'DRAFT', 'PUBLIC', null],
        ['ARCHIVED + PUBLIC', null, 'ARCHIVED', 'PUBLIC', null],
        ['null lifecycle', null, null, 'PUBLIC', null],
        ['null visibility', null, 'ACTIVE', null, null],
        ['both null', null, null, null, null],
        ['missing lifecycle', null, undefined, 'PUBLIC', null],
        ['missing visibility', null, 'ACTIVE', undefined, null],
        ['unknown lifecycle', null, 'OTHER', 'PUBLIC', null],
        ['unknown visibility', null, 'ACTIVE', 'OTHER', null]
    ] as const)('%s', (_name, publicationStatus, lifecycleState, visibility, expected) => {
        expect(
            resolveEffectivePublicationStatus({ publicationStatus, lifecycleState, visibility })
        ).toBe(expected);
    });

    it('feeds the effective status into listing access facts', () => {
        expect(
            readListingAccessFacts({
                entity: {
                    ownerId: 'owner',
                    publicationStatus: null,
                    lifecycleState: 'ACTIVE',
                    visibility: 'PUBLIC'
                }
            })
        ).toEqual({ ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED });
    });
});
