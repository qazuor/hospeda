/**
 * @file owner-listings.test.ts
 * @description Tests for fetchOwnerCommerceListings (SPEC-249 T-009).
 *
 * Verifies the helper merges both verticals, degrades cleanly when one vertical
 * request fails, and returns an empty list when the owner has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { fetchOwnerCommerceListings, fetchOwnerListingDetail } from '../owner-listings';

vi.mock('../../api/client', () => ({
    apiClient: { getProtected: vi.fn() }
}));

const mockGetProtected = vi.mocked(apiClient.getProtected);

const gastro = {
    id: '11111111-1111-4111-8111-111111111111',
    vertical: 'gastronomy',
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

describe('fetchOwnerCommerceListings', () => {
    it('merges gastronomy and experience listings', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [gastro] } })
            .mockResolvedValueOnce({ ok: true, data: { listings: [exp] } });

        const result = await fetchOwnerCommerceListings({ cookieHeader: 'session=x' });

        expect(result).toHaveLength(2);
        expect(result.map((l) => l.vertical)).toEqual(['gastronomy', 'experience']);
    });

    it('degrades cleanly when one vertical fails', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [gastro] } })
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });

        const result = await fetchOwnerCommerceListings({ cookieHeader: 'session=x' });

        expect(result).toHaveLength(1);
        expect(result[0]?.vertical).toBe('gastronomy');
    });

    it('returns an empty list when the owner has none', async () => {
        mockGetProtected
            .mockResolvedValueOnce({ ok: true, data: { listings: [] } })
            .mockResolvedValueOnce({ ok: true, data: { listings: [] } });

        const result = await fetchOwnerCommerceListings({ cookieHeader: 'session=x' });

        expect(result).toEqual([]);
    });
});

describe('fetchOwnerListingDetail', () => {
    const detail = { id: 'abc', ownerId: 'owner-1', name: 'La Parrilla', slug: 'la-parrilla' };

    it('fetches gastronomy detail from the gastronomies path', async () => {
        mockGetProtected.mockResolvedValueOnce({ ok: true, data: detail });

        const result = await fetchOwnerListingDetail({
            vertical: 'gastronomy',
            id: 'abc',
            cookieHeader: 'session=x'
        });

        expect(result).toEqual(detail);
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
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

        const result = await fetchOwnerListingDetail({ vertical: 'gastronomy', id: 'abc' });

        expect(result).toBeNull();
    });
});
