/**
 * @file accommodations-nearby-pois.test.ts
 * @description Unit tests for `accommodationsApi.getNearbyPois` (HOS-145 T-006).
 *
 * Mirrors the mock-`apiClient` style of `user-bookmarks-api.test.ts`: mock
 * the module at the boundary and assert on the exact path + params shape
 * sent to `apiClient.get`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { accommodationsApi } from '@/lib/api/endpoints';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getList: vi.fn(),
        post: vi.fn(),
        postProtected: vi.fn(),
        getProtected: vi.fn(),
        getListProtected: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

const SLUG = 'cabana-del-rio';

describe('accommodationsApi.getNearbyPois', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.get).mockResolvedValue({
            ok: true,
            data: { items: [] }
        });
    });

    it('calls apiClient.get with the correct path and no params when radius/limit are omitted', async () => {
        await accommodationsApi.getNearbyPois({ slug: SLUG });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `/api/v1/public/accommodations/${SLUG}/nearby-pois`,
            params: undefined
        });
    });

    it('forwards radius and limit as query params when provided', async () => {
        await accommodationsApi.getNearbyPois({ slug: SLUG, radius: 3, limit: 6 });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `/api/v1/public/accommodations/${SLUG}/nearby-pois`,
            params: { radius: 3, limit: 6 }
        });
    });

    it('forwards only radius when limit is omitted', async () => {
        await accommodationsApi.getNearbyPois({ slug: SLUG, radius: 10 });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `/api/v1/public/accommodations/${SLUG}/nearby-pois`,
            params: { radius: 10 }
        });
    });

    it('forwards only limit when radius is omitted', async () => {
        await accommodationsApi.getNearbyPois({ slug: SLUG, limit: 20 });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `/api/v1/public/accommodations/${SLUG}/nearby-pois`,
            params: { limit: 20 }
        });
    });

    it('returns the { items } envelope unwrapped by apiClient.get, not a paginated response', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        id: 'poi-1',
                        slug: 'plaza-central',
                        distanceKm: 1.2
                    }
                ]
            }
        });

        const result = await accommodationsApi.getNearbyPois({ slug: SLUG });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.items).toHaveLength(1);
            expect(result.data.items[0]).toMatchObject({ slug: 'plaza-central', distanceKm: 1.2 });
        }
    });
});
