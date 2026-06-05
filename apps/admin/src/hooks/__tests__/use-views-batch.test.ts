// @vitest-environment jsdom
/**
 * Unit tests for useViewsBatch hook (SPEC-197 T-017/T-018).
 *
 * Coverage:
 * - Returns empty Map when entityIds is empty (hook disabled).
 * - Returns empty Map when enabled=false.
 * - Returns populated Map<entityId, total> on success.
 * - isLoading=true while in-flight.
 * - isError=true on failure.
 * - Calls correct API path with entityType and entityIds params.
 */

import { useViewsBatch } from '@/hooks/use-views-batch';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const mockedFetchApi = vi.mocked(fetchApi);

afterEach(() => {
    vi.clearAllMocks();
});

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

// ---------------------------------------------------------------------------
// Disabled states
// ---------------------------------------------------------------------------

describe('useViewsBatch — disabled when entityIds is empty', () => {
    it('should return empty Map and not call fetchApi when entityIds is empty', () => {
        // Arrange
        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () => useViewsBatch({ entityType: 'ACCOMMODATION', entityIds: [] }),
            { wrapper }
        );

        // Assert
        expect(result.current.viewsMap.size).toBe(0);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

describe('useViewsBatch — disabled when enabled=false', () => {
    it('should return empty Map and not call fetchApi when enabled=false', () => {
        // Arrange
        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useViewsBatch({
                    entityType: 'POST',
                    entityIds: ['post-001'],
                    enabled: false
                }),
            { wrapper }
        );

        // Assert
        expect(result.current.viewsMap.size).toBe(0);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe('useViewsBatch — success', () => {
    it('should return populated Map on success', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: [
                    { entityId: 'acc-001', unique: 10, total: 25 },
                    { entityId: 'acc-002', unique: 5, total: 8 }
                ]
            },
            status: 200
        });

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useViewsBatch({
                    entityType: 'ACCOMMODATION',
                    entityIds: ['acc-001', 'acc-002']
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert
        expect(result.current.viewsMap.get('acc-001')).toBe(25);
        expect(result.current.viewsMap.get('acc-002')).toBe(8);
        expect(result.current.isError).toBe(false);
    });

    it('should call the correct API path with entityType and entityIds', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [] },
            status: 200
        });

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useViewsBatch({
                    entityType: 'EVENT',
                    entityIds: ['event-001', 'event-002']
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledOnce();
        const path = mockedFetchApi.mock.calls[0]?.[0]?.path ?? '';
        expect(path).toContain('/api/v1/admin/views/batch');
        expect(path).toContain('entityType=EVENT');
        expect(path).toContain('window=30d');
        // Both IDs present (sorted)
        expect(path).toContain('event-001');
        expect(path).toContain('event-002');
    });
});

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

describe('useViewsBatch — error', () => {
    it('should set isError=true when fetchApi rejects', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Network error'));

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () => useViewsBatch({ entityType: 'POST', entityIds: ['post-001'] }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));

        // Assert
        expect(result.current.viewsMap.size).toBe(0);
        expect(result.current.isLoading).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Zero views
// ---------------------------------------------------------------------------

describe('useViewsBatch — zero-view entities', () => {
    it('should map total=0 correctly (not undefined)', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: [{ entityId: 'acc-zero', unique: 0, total: 0 }]
            },
            status: 200
        });

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () => useViewsBatch({ entityType: 'ACCOMMODATION', entityIds: ['acc-zero'] }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert — 0 must be stored, not undefined
        expect(result.current.viewsMap.has('acc-zero')).toBe(true);
        expect(result.current.viewsMap.get('acc-zero')).toBe(0);
    });
});
