/**
 * TEST:V6:34 AC:V6:26 (HOS-1483) — the composition of the inverse listing
 * entries in `apps/api`: building them touches no `@repo/db` export, `listing`
 * and `listingPurged` delegate to the listing reader, and `onListingPurged` is
 * the PB12 emitter's registry.
 */
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findListingsById } = vi.hoisted(() => ({ findListingsById: vi.fn() }));

vi.mock('@repo/db', () => ({ listingContractModel: { findListingsById } }));

import { createApiListingInverse } from '../../../src/utils/listing-publication/listing-inverse';
import { emitListingPurged } from '../../../src/utils/listing-publication/listing-purged-emitter';

const listingId = '44444444-4444-4444-8444-444444444444';
const ownerId = '55555555-5555-4555-8555-555555555555';

describe('TEST:V6:34 AC:V6:26 createApiListingInverse', () => {
    beforeEach(() => {
        findListingsById.mockReset();
    });

    it('does not read the database when it is built', () => {
        createApiListingInverse();

        expect(findListingsById).toHaveBeenCalledTimes(0);
    });

    it('delegates listing to the listing reader', async () => {
        findListingsById.mockResolvedValue([
            { vertical: 'experience', ownerId, publicationStatus: 'MODERATED' }
        ]);
        const inverse = createApiListingInverse();

        await expect(inverse.listing({ listingId })).resolves.toEqual({
            vertical: VerticalEnum.EXPERIENCE,
            ownerId,
            acceptsFeature: false
        });
        expect(findListingsById).toHaveBeenCalledWith({ listingId });
    });

    it('delegates listingPurged to the listing reader', async () => {
        findListingsById.mockResolvedValue([
            { vertical: 'accommodation', ownerId, publicationStatus: 'PURGED' }
        ]);
        const inverse = createApiListingInverse();

        await expect(inverse.listingPurged({ listingId })).resolves.toEqual({ purged: true });
        expect(findListingsById).toHaveBeenCalledWith({ listingId });
    });

    it('onListingPurged is the PB12 emitter registry', async () => {
        const inverse = createApiListingInverse();
        const received = new Promise<unknown>((resolve) => {
            const unsubscribe = inverse.onListingPurged((event) => {
                unsubscribe();
                resolve(event);
            });
        });

        await emitListingPurged({ listingId });

        await expect(received).resolves.toEqual({ listingId });
    });
});
