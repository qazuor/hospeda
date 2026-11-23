/**
 * @file owner-listings.test.ts
 * @description Tests for fetchOwnerListings (SPEC-249 T-009).
 *
 * Verifies the helper merges both verticals, degrades cleanly when one vertical
 * request fails, and returns an empty list when the owner has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import {
    fetchOwnerListingDetail,
    fetchOwnerListings,
    fetchOwnerListingsWithState,
    OwnerListingsUnavailableError
} from '../owner-listings';

vi.mock('../../api/client', () => ({
    apiClient: { getProtected: vi.fn() }
}));

const mockGetProtected = vi.mocked(apiClient.getProtected);

const gastro = {
    id: '11111111-1111-4111-8111-111111111111',
    vertical: 'venue',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    type: 'PARRILLA',
    isPublic: true
};
const exp = {
    id: '22222222-2222-4222-8222-222222222222',
    vertical: 'experience',
    name: 'Kayak',
    slug: 'kayak',
    type: 'TOUR_GUIDE',
    isPublic: false
};

afterEach(() => vi.clearAllMocks());

describe('fetchOwnerListings', () => {
    it('merges venue and experience listings', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [gastro] } })
            .mockResolvedValueOnce({ ok: true, data: { listings: [exp] } });

        const result = await fetchOwnerListings({ cookieHeader: 'session=x' });

        expect(result).toHaveLength(2);
        expect(result.map((l) => l.vertical)).toEqual(['venue', 'experience']);
    });

    it('degrades cleanly when one vertical fails', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [gastro] } })
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });

        const result = await fetchOwnerListings({ cookieHeader: 'session=x' });

        expect(result).toHaveLength(1);
        expect(result[0]?.vertical).toBe('venue');
    });

    it('throws instead of returning an empty list when both verticals fail (HOS-2421)', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } })
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });

        await expect(fetchOwnerListings({ cookieHeader: 'session=x' })).rejects.toBeInstanceOf(
            OwnerListingsUnavailableError
        );
    });

    it('throws when one vertical fails and the other is genuinely empty (HOS-2421)', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [] } })
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });

        await expect(fetchOwnerListings({ cookieHeader: 'session=x' })).rejects.toBeInstanceOf(
            OwnerListingsUnavailableError
        );
    });

    it('returns an empty list when the owner has none', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [] } })
            .mockResolvedValueOnce({ ok: true, data: { listings: [] } });

        const result = await fetchOwnerListings({ cookieHeader: 'session=x' });

        expect(result).toEqual([]);
    });
});

describe('fetchOwnerListingDetail', () => {
    const detail = { id: 'abc', ownerId: 'owner-1', name: 'La Parrilla', slug: 'la-parrilla' };

    it('fetches venue detail from the venues path', async () => {
        mockGetProtected.mockResolvedValueOnce({ ok: true, data: detail });

        const result = await fetchOwnerListingDetail({
            vertical: 'venue',
            id: 'abc',
            cookieHeader: 'session=x'
        });

        expect(result).toEqual(detail);
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/abc',
            cookieHeader: 'session=x'
        });
    });

    it('fetches experience detail from the experiences path', async () => {
        mockGetProtected.mockResolvedValueOnce({ ok: true, data: detail });

        await fetchOwnerListingDetail({ vertical: 'experience', id: 'xyz' });

        expect(mockGetProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/experiences/xyz',
            cookieHeader: undefined
        });
    });

    it('returns null when the request fails', async () => {
        mockGetProtected.mockResolvedValueOnce({
            ok: false,
            error: { status: 404, message: 'not found' }
        });

        const result = await fetchOwnerListingDetail({ vertical: 'venue', id: 'abc' });

        expect(result).toBeNull();
    });
});

describe('fetchOwnerListingsWithState (HOS-2484)', () => {
    const draft = {
        ...exp,
        id: '33333333-3333-4333-8333-333333333333',
        publicationStatus: 'DRAFT',
        missingRequirements: ['name', 'media.featuredImage']
    };
    const ready = { ...draft, id: '44444444-4444-4444-8444-444444444444', missingRequirements: [] };
    const unread = {
        ...draft,
        id: '55555555-5555-4555-8555-555555555555',
        missingRequirements: undefined
    };

    it('reads ONLY the requested vertical, in one request, never a listing detail', async () => {
        // Arrange
        mockGetProtected.mockResolvedValueOnce({ ok: true, data: { listings: [draft] } });

        // Act
        await fetchOwnerListingsWithState({ vertical: 'experience', cookieHeader: 'session=x' });

        // Assert
        expect(mockGetProtected).toHaveBeenCalledTimes(1);
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/experiences/mine',
            cookieHeader: 'session=x'
        });
    });

    it('maps missingRequirements to the completeness preview, absent to unknown', async () => {
        // Arrange
        mockGetProtected.mockResolvedValueOnce({
            ok: true,
            data: { listings: [gastro, draft, ready, unread] }
        });

        // Act
        const result = await fetchOwnerListingsWithState({ vertical: 'venue' });

        // Assert
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/mine',
            cookieHeader: undefined
        });
        expect(result.map((listing) => listing.completeness)).toEqual([
            null,
            { complete: false, missing: ['name', 'media.featuredImage'] },
            { complete: true, missing: [] },
            null
        ]);
    });

    it('throws OwnerListingsUnavailableError when the list read fails (never a false empty)', async () => {
        // Arrange
        mockGetProtected.mockResolvedValueOnce({ ok: false, error: { status: 503, message: 'x' } });

        // Act + Assert
        await expect(fetchOwnerListingsWithState({ vertical: 'venue' })).rejects.toBeInstanceOf(
            OwnerListingsUnavailableError
        );
    });
});
