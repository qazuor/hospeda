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

    it('does not fetch the detail of a PURGED listing and leaves its completeness null', async () => {
        // Arrange
        getProtected.mockImplementation(async ({ path }: { path: string }) => {
            if (path.endsWith('/venues/mine')) {
                return {
                    ok: true,
                    data: {
                        listings: [
                            summary('purged', PublicationStatusEnum.PURGED),
                            summary('draft', PublicationStatusEnum.DRAFT)
                        ]
                    }
                };
            }
            if (path.endsWith('/experiences/mine')) {
                return { ok: true, data: { listings: [] } };
            }
            return { ok: true, data: { id: 'draft', name: 'Listing draft' } };
        });

        // Act
        const listings = await fetchOwnerListingsWithState({});

        // Assert
        const detailPaths = getProtected.mock.calls
            .map(([args]) => (args as { path: string }).path)
            .filter((path) => !path.endsWith('/mine'));
        expect(detailPaths).toEqual(['/api/v1/protected/venues/draft']);

        const purged = listings.find((listing) => listing.id === 'purged');
        expect(purged?.publicationStatus).toBe(PublicationStatusEnum.PURGED);
        expect(purged?.completeness).toBeNull();
        expect(listings.find((listing) => listing.id === 'draft')?.completeness).not.toBeNull();
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

    it('renders the edit link only for a listing that is not purged', () => {
        expect(source).toMatch(/\{!isPurged\(listing\) && \(\s*<a\s+class="mc-list__edit"/);
        expect(source.split('class="mc-list__edit"').length - 1).toBe(1);
    });

    it('keeps a purged listing out of the menu QR widget', () => {
        expect(source).toContain(
            ".filter((listing) => listing.vertical === 'venue' && !isPurged(listing))"
        );
    });

    it('still renders the notices for every listing (row 20 is how a purged one is explained)', () => {
        expect(source).not.toMatch(/!isPurged\(listing\) && \(\s*<ListingNotices/);
        expect(source).toContain('<ListingNotices');
    });
});
