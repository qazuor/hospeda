/**
 * @file useGeocoding.test.tsx
 * @description Tests for the admin geocoding TanStack Query hooks
 * (SPEC-097, Phase 6). Verify URL construction, response unwrapping, and the
 * "skip when query too short" guard.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
    fetchApi: (...args: unknown[]) => fetchApiMock(...args)
}));

import {
    useGeocodingAutocomplete,
    useGeocodingReverse
} from '@/features/accommodations/hooks/useGeocoding';

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } }
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

describe('useGeocodingAutocomplete', () => {
    it('does not call fetchApi when query is shorter than 3 chars', () => {
        fetchApiMock.mockReset();
        renderHook(() => useGeocodingAutocomplete({ query: 'ab' }), {
            wrapper: makeWrapper()
        });
        expect(fetchApiMock).not.toHaveBeenCalled();
    });

    it('calls the autocomplete endpoint with q + locale and unwraps suggestions', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue({
            data: { suggestions: [{ label: 'X', lat: 1, lng: 2 }] },
            status: 200
        });

        const { result } = renderHook(
            () => useGeocodingAutocomplete({ query: 'Belgrano', locale: 'es' }),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([{ label: 'X', lat: 1, lng: 2 }]);
        const [arg] = fetchApiMock.mock.calls[0];
        expect((arg as { path: string }).path).toContain('/api/v1/admin/geocoding/autocomplete?');
        expect((arg as { path: string }).path).toContain('q=Belgrano');
        expect((arg as { path: string }).path).toContain('locale=es');
    });

    it('returns empty suggestions when response has no suggestions key', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue({ data: {}, status: 200 });

        const { result } = renderHook(() => useGeocodingAutocomplete({ query: 'ZZZ' }), {
            wrapper: makeWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([]);
    });
});

describe('useGeocodingReverse', () => {
    it('does not call fetchApi when lat or lng are null', () => {
        fetchApiMock.mockReset();
        renderHook(() => useGeocodingReverse({ lat: null, lng: -58.04 }), {
            wrapper: makeWrapper()
        });
        expect(fetchApiMock).not.toHaveBeenCalled();
    });

    it('calls the reverse endpoint and returns the suggestion', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue({
            data: { suggestion: { label: 'Calle 1', lat: -30.7, lng: -58.04 } },
            status: 200
        });

        const { result } = renderHook(() => useGeocodingReverse({ lat: -30.7, lng: -58.04 }), {
            wrapper: makeWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toMatchObject({ label: 'Calle 1' });
        const [arg] = fetchApiMock.mock.calls[0];
        expect((arg as { path: string }).path).toContain('/api/v1/admin/geocoding/reverse?');
    });
});
