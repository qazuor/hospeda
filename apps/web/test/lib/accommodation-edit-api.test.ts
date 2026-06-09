/**
 * @file accommodation-edit-api.test.ts
 * @description Tests for the accommodationEditApi endpoint wrappers.
 * Verifies that each method delegates to the correct apiClient method
 * with the expected path and parameters.
 */

import { apiClient } from '@/lib/api/client';
import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        getProtected: vi.fn(),
        getList: vi.fn(),
        patch: vi.fn()
    }
}));

describe('accommodationEditApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getById should call getProtected with the correct path', async () => {
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { id: 'acc-123', name: 'Test' }
        });

        const result = await accommodationEditApi.getById({
            id: 'acc-123',
            cookieHeader: 'session=abc'
        });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-123',
            cookieHeader: 'session=abc'
        });
        expect(result.ok).toBe(true);
    });

    it('update should call patch with the correct path and body', async () => {
        vi.mocked(apiClient.patch).mockResolvedValue({
            ok: true,
            data: { id: 'acc-123' }
        });

        const result = await accommodationEditApi.update({
            id: 'acc-123',
            data: { name: 'Updated Name' }
        });

        expect(apiClient.patch).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-123',
            body: { name: 'Updated Name' }
        });
        expect(result.ok).toBe(true);
    });

    it('getAmenities should call getList with the amenities path', async () => {
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: {
                items: [],
                pagination: {
                    page: 1,
                    pageSize: 50,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            }
        });

        const result = await accommodationEditApi.getAmenities();

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: '/api/v1/public/amenities',
            params: { pageSize: 200 }
        });
        expect(result.ok).toBe(true);
    });

    it('getDestinations should call getList with the destinations path', async () => {
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: {
                items: [],
                pagination: {
                    page: 1,
                    pageSize: 50,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            }
        });

        const result = await accommodationEditApi.getDestinations();

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: '/api/v1/public/destinations',
            params: { pageSize: 200 }
        });
        expect(result.ok).toBe(true);
    });
});
