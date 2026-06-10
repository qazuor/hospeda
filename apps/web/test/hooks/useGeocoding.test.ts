/**
 * @file useGeocoding.test.ts
 * @description Tests for useGeocodingSearch and useGeocodingReverse hooks.
 *
 * Uses mocked fetch to verify debounce behavior, error handling,
 * and suggestion updates without hitting the real API.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeocodingReverse, useGeocodingSearch } from '../../src/hooks/useGeocoding';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetchSuccess(data: unknown) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data
    });
}

function mockFetchError(status: number) {
    mockFetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => ({ error: { message: 'Failed' } })
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useGeocodingSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not fetch for queries shorter than 3 chars', async () => {
        const { result } = renderHook(() => useGeocodingSearch({ query: 'Be' }));

        await act(async () => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current.suggestions).toHaveLength(0);
        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch suggestions after debounce', async () => {
        mockFetchSuccess({
            suggestions: [{ label: 'Av. Belgrano 123', lat: -32.48, lng: -58.23 }]
        });

        const { result } = renderHook(() => useGeocodingSearch({ query: 'Belgrano' }));

        expect(mockFetch).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(350);
        });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(result.current.suggestions).toHaveLength(1);
            expect(result.current.suggestions[0].label).toBe('Av. Belgrano 123');
        });
    });

    it('should handle fetch errors gracefully', async () => {
        mockFetchError(500);

        const { result } = renderHook(() => useGeocodingSearch({ query: 'Belgrano' }));

        await act(async () => {
            vi.advanceTimersByTime(350);
        });

        await waitFor(() => {
            expect(result.current.error).toBeTruthy();
            expect(result.current.suggestions).toHaveLength(0);
        });
    });
});

describe('useGeocodingReverse', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should not fetch when lat/lng are null', () => {
        renderHook(() => useGeocodingReverse({ lat: null, lng: null }));

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch reverse geocode for valid coordinates', async () => {
        mockFetchSuccess({
            suggestion: {
                label: 'Av. Belgrano, CdU',
                lat: -32.48,
                lng: -58.23,
                street: 'Av. Belgrano'
            }
        });

        const { result } = renderHook(() => useGeocodingReverse({ lat: -32.4825, lng: -58.2372 }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(result.current.suggestion).not.toBeNull();
            expect(result.current.suggestion?.label).toBe('Av. Belgrano, CdU');
        });
    });

    it('should handle fetch errors gracefully', async () => {
        mockFetchError(500);

        const { result } = renderHook(() => useGeocodingReverse({ lat: -32.4825, lng: -58.2372 }));

        await waitFor(() => {
            expect(result.current.error).toBeTruthy();
            expect(result.current.suggestion).toBeNull();
        });
    });
});
