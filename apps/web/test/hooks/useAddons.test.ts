/**
 * useAddons Hook Tests
 *
 * Tests for the useAddons custom hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveAddonPurchase } from '../../src/hooks/useAddons';
import { useAddons } from '../../src/hooks/useAddons';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useQZPay hook
vi.mock('@qazuor/qzpay-react', () => ({
    useQZPay: vi.fn(() => null)
}));

describe('useAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should initialize with loading state', () => {
        mockFetch.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                })
        );

        const { result } = renderHook(() => useAddons());

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBe(null);
        expect(result.current.error).toBe(null);
    });

    it('should fetch and return addon data successfully', async () => {
        const mockAddons: ActiveAddonPurchase[] = [
            {
                id: 'addon_1',
                addonId: 'extra_photos',
                name: 'Fotos Extra',
                description: '10 fotos adicionales',
                status: 'active',
                expiresAt: '2026-12-31T23:59:59Z',
                quantity: 1
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockAddons);
        expect(result.current.error).toBe(null);
    });

    it('should handle fetch errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
                error: {
                    message: 'Server error'
                }
            })
        });

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(null);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toContain('Failed to fetch addons');
    });

    it('should handle API error responses', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: false,
                error: {
                    message: 'Invalid request'
                }
            })
        });

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(null);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Invalid request');
    });

    it('should use correct API endpoint', async () => {
        const mockAddons: ActiveAddonPurchase[] = [];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        renderHook(() => useAddons());

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/billing/addons/my'),
            expect.objectContaining({
                credentials: 'include',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('should provide refetch function', async () => {
        const mockAddons: ActiveAddonPurchase[] = [
            {
                id: 'addon_1',
                addonId: 'extra_photos',
                name: 'Fotos Extra',
                description: '10 fotos adicionales',
                status: 'active',
                expiresAt: '2026-12-31T23:59:59Z',
                quantity: 1
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Call refetch
        await result.current.refetch();

        // Should call fetch again
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty addon list', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: []
            })
        });

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBe(null);
    });

    it('should use PUBLIC_API_URL environment variable', async () => {
        const originalEnv = import.meta.env.PUBLIC_API_URL;

        // Set environment variable
        import.meta.env.PUBLIC_API_URL = 'http://localhost:3001';

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: []
            })
        });

        renderHook(() => useAddons());

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:3001/billing/addons/my',
            expect.any(Object)
        );

        // Restore
        import.meta.env.PUBLIC_API_URL = originalEnv;
    });

    it('should handle network errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useAddons());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(null);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Network error');
    });
});
