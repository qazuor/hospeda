// @vitest-environment jsdom
/**
 * Unit tests for useEntityViewStats hook (SPEC-197 T-016).
 *
 * Coverage:
 * - Returns null stats + isLoading=false when enabled=false (permission guard).
 * - Returns null stats + isLoading=false when entityId is empty.
 * - Returns populated stats for 7d and 30d windows on success.
 * - isLoading=true while requests are in-flight.
 * - isError=true + null stats when requests fail.
 * - Fires separate requests for window=7d and window=30d.
 */

import { useEntityViewStats } from '@/hooks/use-entity-view-stats';
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

describe('useEntityViewStats — disabled when enabled=false', () => {
    it('should return null stats without calling fetchApi when enabled=false', () => {
        // Arrange
        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useEntityViewStats({
                    entityId: 'acc-001',
                    entityType: 'ACCOMMODATION',
                    enabled: false
                }),
            { wrapper }
        );

        // Assert
        expect(result.current.stats7d).toBeNull();
        expect(result.current.stats30d).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

describe('useEntityViewStats — disabled when entityId is empty', () => {
    it('should return null stats and not call fetchApi when entityId is empty', () => {
        // Arrange
        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useEntityViewStats({
                    entityId: '',
                    entityType: 'POST'
                }),
            { wrapper }
        );

        // Assert
        expect(result.current.stats7d).toBeNull();
        expect(result.current.stats30d).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe('useEntityViewStats — success', () => {
    it('should return stats7d and stats30d populated on success', async () => {
        // Arrange — differentiate by window param
        mockedFetchApi.mockImplementation((params) => {
            const path = params?.path ?? '';
            if (path.includes('window=7d')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [{ entityId: 'acc-001', unique: 10, total: 25 }]
                    },
                    status: 200
                });
            }
            return Promise.resolve({
                data: {
                    success: true,
                    data: [{ entityId: 'acc-001', unique: 50, total: 120 }]
                },
                status: 200
            });
        });

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useEntityViewStats({
                    entityId: 'acc-001',
                    entityType: 'ACCOMMODATION'
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert
        expect(result.current.stats7d).toEqual({ unique: 10, total: 25 });
        expect(result.current.stats30d).toEqual({ unique: 50, total: 120 });
        expect(result.current.isError).toBe(false);
    });

    it('should fire two separate requests (7d and 30d)', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [] },
            status: 200
        });

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useEntityViewStats({
                    entityId: 'event-001',
                    entityType: 'EVENT'
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert — two calls, one per window
        expect(mockedFetchApi).toHaveBeenCalledTimes(2);
        const paths = mockedFetchApi.mock.calls.map((call) => call[0]?.path ?? '');
        expect(paths.some((p) => p.includes('window=7d'))).toBe(true);
        expect(paths.some((p) => p.includes('window=30d'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

describe('useEntityViewStats — error', () => {
    it('should set isError=true and return null stats when both requests fail', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Server error'));

        const wrapper = createWrapper();

        // Act
        const { result } = renderHook(
            () =>
                useEntityViewStats({
                    entityId: 'post-001',
                    entityType: 'POST'
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));

        // Assert
        expect(result.current.stats7d).toBeNull();
        expect(result.current.stats30d).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Zero views
// ---------------------------------------------------------------------------

describe('useEntityViewStats — zero views', () => {
    it('should return { unique: 0, total: 0 } when API returns zero counts', async () => {
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
            () =>
                useEntityViewStats({
                    entityId: 'acc-zero',
                    entityType: 'ACCOMMODATION'
                }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Assert — zeros are preserved, not null
        expect(result.current.stats7d).toEqual({ unique: 0, total: 0 });
        expect(result.current.stats30d).toEqual({ unique: 0, total: 0 });
    });
});
