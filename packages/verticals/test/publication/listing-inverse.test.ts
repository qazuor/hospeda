/**
 * TEST:V6:34 AC:V6:26 (HOS-1483) — `ficha()` (`listing`) and `fichaPurgada()`
 * (`listingPurged`) over the three states of the AC, PUBLISHED, MODERATED and
 * PURGED, in each listing vertical (contract §4.1).
 */
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    AmbiguousListingIdError,
    createListingInverse,
    type ListingContractReaderRow,
    ListingNotFoundError
} from '../../src/publication/listing-inverse';

const LISTING_VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;

/** A fake reader over an in-memory map of id → rows. */
function makeReader(rows: ReadonlyMap<string, readonly ListingContractReaderRow[]>) {
    const findListingsById = vi.fn(
        async (args: { readonly listingId: string }) => rows.get(args.listingId) ?? []
    );
    return { reader: { findListingsById }, findListingsById };
}

function single(row: ListingContractReaderRow) {
    const listingId = crypto.randomUUID();
    const { reader, findListingsById } = makeReader(new Map([[listingId, [row]]]));
    return { inverse: createListingInverse({ reader }), listingId, findListingsById };
}

describe('TEST:V6:34 AC:V6:26 listing and listingPurged over the three states', () => {
    for (const vertical of LISTING_VERTICALS) {
        it(`${vertical}: PUBLISHED, MODERATED and PURGED`, async () => {
            const expected: readonly [PublicationStatusEnum, boolean, boolean][] = [
                [PublicationStatusEnum.PUBLISHED, true, false],
                [PublicationStatusEnum.MODERATED, false, false],
                [PublicationStatusEnum.PURGED, false, true]
            ];
            for (const [state, acceptsFeature, purged] of expected) {
                const ownerId = crypto.randomUUID();
                const { inverse, listingId } = single({
                    vertical,
                    ownerId,
                    publicationStatus: state
                });

                const answer = await inverse.listing({ listingId });
                const purgedAnswer = await inverse.listingPurged({ listingId });

                expect(answer, state).toEqual({ vertical, ownerId, acceptsFeature });
                expect(Object.keys(answer).sort(), 'never the state').toEqual([
                    'acceptsFeature',
                    'ownerId',
                    'vertical'
                ]);
                expect(purgedAnswer, state).toEqual({ purged });
            }
        });
    }

    it('the other three states accept a feature and are not purged', async () => {
        for (const state of [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.ARCHIVED
        ]) {
            const ownerId = crypto.randomUUID();
            const { inverse, listingId } = single({
                vertical: VerticalEnum.GASTRONOMY,
                ownerId,
                publicationStatus: state
            });

            expect(await inverse.listing({ listingId }), state).toEqual({
                vertical: VerticalEnum.GASTRONOMY,
                ownerId,
                acceptsFeature: true
            });
            expect(await inverse.listingPurged({ listingId }), state).toEqual({ purged: false });
        }
    });

    it('a row that does not exist is purged, and listing refuses it', async () => {
        const { reader, findListingsById } = makeReader(new Map());
        const inverse = createListingInverse({ reader });
        const listingId = crypto.randomUUID();

        expect(await inverse.listingPurged({ listingId })).toEqual({ purged: true });
        await expect(inverse.listing({ listingId })).rejects.toBeInstanceOf(ListingNotFoundError);
        await expect(inverse.listing({ listingId })).rejects.toMatchObject({
            name: 'ListingNotFoundError',
            listingId
        });
        expect(findListingsById).toHaveBeenCalledWith({ listingId });
    });

    it('an id that is not a UUID is a row that does not exist, without reading', async () => {
        const { reader, findListingsById } = makeReader(new Map());
        const inverse = createListingInverse({ reader });

        expect(await inverse.listingPurged({ listingId: 'not-a-uuid' })).toEqual({
            purged: true
        });
        await expect(inverse.listing({ listingId: 'not-a-uuid' })).rejects.toBeInstanceOf(
            ListingNotFoundError
        );
        expect(findListingsById).not.toHaveBeenCalled();
    });

    it('two rows with the same id fail closed', async () => {
        const listingId = crypto.randomUUID();
        const ownerId = crypto.randomUUID();
        const { reader } = makeReader(
            new Map([
                [
                    listingId,
                    [
                        {
                            vertical: VerticalEnum.ACCOMMODATION,
                            ownerId,
                            publicationStatus: PublicationStatusEnum.PUBLISHED
                        },
                        {
                            vertical: VerticalEnum.EXPERIENCE,
                            ownerId,
                            publicationStatus: PublicationStatusEnum.PURGED
                        }
                    ]
                ]
            ])
        );
        const inverse = createListingInverse({ reader });

        await expect(inverse.listing({ listingId })).rejects.toBeInstanceOf(
            AmbiguousListingIdError
        );
        await expect(inverse.listingPurged({ listingId })).rejects.toBeInstanceOf(
            AmbiguousListingIdError
        );
    });

    it('an unknown state or vertical fails closed', async () => {
        const ownerId = crypto.randomUUID();
        const unknownState = single({
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId,
            publicationStatus: 'GONE'
        });
        const unknownVertical = single({
            vertical: 'hotel',
            ownerId,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });

        await expect(
            unknownState.inverse.listing({ listingId: unknownState.listingId })
        ).rejects.toThrow(/publication status/);
        await expect(
            unknownState.inverse.listingPurged({ listingId: unknownState.listingId })
        ).rejects.toThrow(/publication status/);
        await expect(
            unknownVertical.inverse.listing({ listingId: unknownVertical.listingId })
        ).rejects.toThrow(/vertical/);
        await expect(
            unknownVertical.inverse.listingPurged({ listingId: unknownVertical.listingId })
        ).rejects.toThrow(/vertical/);
    });

    it('an empty argument is rejected by the contract schema', async () => {
        const { reader, findListingsById } = makeReader(new Map());
        const inverse = createListingInverse({ reader });

        await expect(inverse.listing({ listingId: '' })).rejects.toThrow();
        await expect(inverse.listingPurged({ listingId: '' })).rejects.toThrow();
        expect(findListingsById).not.toHaveBeenCalled();
    });
});
