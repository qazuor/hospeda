/**
 * @file owner-listings-purged.test.ts
 * @description `fetchOwnerListingsWithState` and the `/mi-cuenta/comercio/`
 * index for a `PURGED` listing (HOS-1641, Coord-351 F4): the summary carries
 * `publicationStatus`, a purged listing gets no completeness preview (its card
 * renders no action), and the page offers it no edit link and no menu QR.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PublicationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProtected } = vi.hoisted(() => ({ getProtected: vi.fn() }));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { getProtected, postProtected: vi.fn(), patchProtected: vi.fn() }
}));

import { fetchOwnerListingsWithState } from '../../../src/lib/listing/owner-listings';

function summary(id: string, publicationStatus: PublicationStatusEnum) {
    return {
        id,
        vertical: 'venue' as const,
        name: `Listing ${id}`,
        slug: `listing-${id}`,
        type: 'RESTAURANT',
        publicationStatus,
        isPublic: publicationStatus === PublicationStatusEnum.PUBLISHED,
        hasPublicPage: publicationStatus === PublicationStatusEnum.PUBLISHED
    };
}

describe('fetchOwnerListingsWithState — PURGED (HOS-1641)', () => {
    beforeEach(() => {
        getProtected.mockReset();
    });

    it('gives a PURGED listing no completeness preview, from ONE list request (HOS-2484)', async () => {
        getProtected.mockResolvedValue({
            ok: true,
            data: {
                listings: [
                    { ...summary('purged', PublicationStatusEnum.PURGED), missingRequirements: [] },
                    {
                        ...summary('draft', PublicationStatusEnum.DRAFT),
                        missingRequirements: ['name']
                    }
                ]
            }
        });

        const listings = await fetchOwnerListingsWithState({ vertical: 'venue' });

        expect(getProtected).toHaveBeenCalledTimes(1);
        const purged = listings.find((listing) => listing.id === 'purged');
        expect(purged?.publicationStatus).toBe(PublicationStatusEnum.PURGED);
        expect(purged?.completeness).toBeNull();
        expect(listings.find((listing) => listing.id === 'draft')?.completeness).toEqual({
            complete: false,
            missing: ['name']
        });
    });
});

describe('mi-cuenta/comercio/index.astro — PURGED offers no action (HOS-1641)', () => {
    const source = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
        'utf8'
    );

    it('decides "purged" from publicationStatus', () => {
        expect(source).toContain('listing.publicationStatus === PublicationStatusEnum.PURGED');
    });

    it('links a purged listing nowhere and gives it no action (HOS-2484 card)', () => {
        const card = readFileSync(
            resolve(__dirname, '../../../src/components/account/OwnerListingCard.astro'),
            'utf8'
        );
        expect(source).toContain('<OwnerListingCard listing={listing}');
        expect(card).toContain('href={actions.edit ? editUrl : undefined}');
        // The primary action resolver answers 'none' for PURGED, so neither the
        // edit button nor the menu renders (unit-tested in
        // owner-listing-primary-action.test.ts).
        expect(card).toContain(
            "resolveOwnerListingPrimaryAction({ listing, affordance: publishAffordance }) === 'publish'"
        );
        expect(card).toContain(') : actions.edit ? (');
    });

    it('keeps a purged listing out of the menu QR widget', () => {
        // HOS-1856 moved the vertical check out of the page (G-FAC-05): the
        // filter now uses `isVenueListing` and the widget receives the result.
        expect(source).toContain('const venueListings = listings.filter(');
        expect(source).toContain('isVenueListing(listing) && !isPurged(listing)');
        expect(source).toContain('listings={venueListings.map(');
    });

    it('still renders the notices for every listing (row 20 is how a purged one is explained)', () => {
        expect(source).not.toMatch(/!isPurged\(listing\) && \(\s*<ListingNotices/);
        expect(source).toContain(
            'notices={noticesByVertical.get(listing.vertical)?.byListingId.get(listing.id)}'
        );
    });
});
