/**
 * @file listing-notices-loader.test.ts
 * @description TEST:1762:1 (HOS-1762): the SSR loader of the listing notices for
 * the editor hubs.
 *
 * The notices are enrichment of the editor hub, never a precondition: the loader
 * returns the entry of the requested listing on success and `{ item: undefined }`
 * on every failure path (no session, API error, thrown request) instead of
 * throwing into the page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listingNotices = vi.fn();
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: (...args: unknown[]) => listingNotices(...args) }
}));

const warn = vi.fn();
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: (...args: unknown[]) => warn(...args) }
}));

import { loadListingNoticesItem } from '@/lib/listing/listing-notices-loader';

const LISTING_ID = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const OTHER_LISTING_ID = '8a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const COOKIE = 'session=abc';

const firstItem = {
    listingId: LISTING_ID,
    publicationStatus: 'PUBLISHED',
    recurringListingAddons: 0,
    notices: [{ kind: 'FIX_REQUESTED' }]
};
const secondItem = {
    listingId: OTHER_LISTING_ID,
    publicationStatus: 'PUBLISHED',
    recurringListingAddons: 1,
    notices: [{ kind: 'SURPLUS' }]
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TEST:1762:1 loadListingNoticesItem — notices of one listing for the editor hub', () => {
    it('returns the entry of the requested listing and reads the vertical once', async () => {
        // Arrange
        listingNotices.mockResolvedValue({
            ok: true,
            data: { trialRunning: false, items: [firstItem, secondItem] }
        });

        // Act
        const result = await loadListingNoticesItem({
            vertical: 'venue',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ item: firstItem });
        expect(listingNotices).toHaveBeenCalledTimes(1);
        expect(listingNotices).toHaveBeenCalledWith({
            vertical: 'venue',
            cookieHeader: COOKIE
        });
    });

    it('returns no entry when the read does not include the listing', async () => {
        // Arrange
        listingNotices.mockResolvedValue({
            ok: true,
            data: { trialRunning: false, items: [secondItem] }
        });

        // Act
        const result = await loadListingNoticesItem({
            vertical: 'accommodation',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ item: undefined });
    });

    it('does not call the API without a session cookie', async () => {
        // Act
        const result = await loadListingNoticesItem({
            vertical: 'accommodation',
            listingId: LISTING_ID
        });

        // Assert
        expect(result).toEqual({ item: undefined });
        expect(listingNotices).not.toHaveBeenCalled();
    });

    it('degrades to no entry and logs when the API answers an error', async () => {
        // Arrange
        listingNotices.mockResolvedValue({ ok: false, error: { status: 500 } });

        // Act
        const result = await loadListingNoticesItem({
            vertical: 'experience',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ item: undefined });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('degrades to no entry and logs when the request throws', async () => {
        // Arrange
        listingNotices.mockRejectedValue(new Error('boom'));

        // Act
        const result = await loadListingNoticesItem({
            vertical: 'experience',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ item: undefined });
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
