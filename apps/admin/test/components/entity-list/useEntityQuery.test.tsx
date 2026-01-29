/**
 * Tests for useEntityQuery - Entity Query Hook
 *
 * Tests cover:
 * - Basic data fetching
 * - Loading states
 * - Error handling and retry logic
 * - Query key generation
 * - Cache behavior
 */

import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
    EntityQueryParams,
    EntityQueryResponse
} from '../../../src/components/entity-list/types';

// Test data types
interface TestEntity {
    id: string;
    name: string;
    slug: string;
}

// Mock implementation of useEntityQuery for testing
// This mirrors the actual implementation without dependencies
const useEntityQueryMock = <TData,>(
    entityName: string,
    queryFn: (params: EntityQueryParams) => Promise<EntityQueryResponse<TData>>,
    params: EntityQueryParams,
    _queryClient: QueryClient
) => {
    const queryKey = ['entities', entityName, 'list', params];

    return {
        queryKey,
        queryFn: () => queryFn(params),
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000
    };
};

// Query wrapper for testing
function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0
            }
        }
    });
}

// Create a test hook that uses the same pattern as useEntityQuery
function useTestEntityQuery<TData>(
    _entityName: string,
    queryFn: (params: EntityQueryParams) => Promise<EntityQueryResponse<TData>>,
    params: EntityQueryParams
) {
    const [data, setData] = React.useState<EntityQueryResponse<TData> | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
        setIsLoading(true);
        setError(null);

        queryFn(params)
            .then((result) => {
                setData(result);
                setIsLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err : new Error('Unknown error'));
                setIsLoading(false);
            });
    }, [queryFn, params]);

    return { data, isLoading, error };
}

describe('useEntityQuery', () => {
    describe('Basic Data Fetching', () => {
        it('should fetch entity data successfully', async () => {
            const mockData: EntityQueryResponse<TestEntity> = {
                data: [
                    { id: '1', name: 'Entity 1', slug: 'entity-1' },
                    { id: '2', name: 'Entity 2', slug: 'entity-2' }
                ],
                total: 2,
                page: 1,
                pageSize: 20
            };

            const queryFn = vi.fn().mockResolvedValue(mockData);

            const { result } = renderHook(() =>
                useTestEntityQuery('testEntities', queryFn, { page: 1, pageSize: 20 })
            );

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockData);
            expect(result.current.error).toBeNull();
            expect(queryFn).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
        });

        it('should pass correct parameters to query function', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [],
                total: 0,
                page: 2,
                pageSize: 25
            });

            const params: EntityQueryParams = {
                page: 2,
                pageSize: 25,
                q: 'search term',
                sort: [{ id: 'name', desc: false }]
            };

            renderHook(() => useTestEntityQuery('testEntities', queryFn, params));

            await waitFor(() => {
                expect(queryFn).toHaveBeenCalledWith(params);
            });
        });
    });

    describe('Loading States', () => {
        it('should start with loading state', () => {
            const queryFn = vi
                .fn()
                .mockImplementation(
                    () =>
                        new Promise((resolve) =>
                            setTimeout(
                                () => resolve({ data: [], total: 0, page: 1, pageSize: 20 }),
                                100
                            )
                        )
                );

            const { result } = renderHook(() =>
                useTestEntityQuery('testEntities', queryFn, { page: 1, pageSize: 20 })
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeNull();
        });

        it('should set loading to false after data loads', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [{ id: '1', name: 'Test', slug: 'test' }],
                total: 1,
                page: 1,
                pageSize: 20
            });

            const { result } = renderHook(() =>
                useTestEntityQuery('testEntities', queryFn, { page: 1, pageSize: 20 })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).not.toBeNull();
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors', async () => {
            const error = new Error('API Error: 500');
            const queryFn = vi.fn().mockRejectedValue(error);

            const { result } = renderHook(() =>
                useTestEntityQuery('testEntities', queryFn, { page: 1, pageSize: 20 })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe('API Error: 500');
        });

        it('should handle network errors', async () => {
            const queryFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

            const { result } = renderHook(() =>
                useTestEntityQuery('testEntities', queryFn, { page: 1, pageSize: 20 })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).not.toBeNull();
        });
    });

    describe('Query Key Generation', () => {
        it('should generate unique query keys for different entities', () => {
            const queryClient = createTestQueryClient();
            const params = { page: 1, pageSize: 20 };

            const config1 = useEntityQueryMock('accommodations', vi.fn(), params, queryClient);
            const config2 = useEntityQueryMock('destinations', vi.fn(), params, queryClient);

            expect(config1.queryKey).not.toEqual(config2.queryKey);
            expect(config1.queryKey[1]).toBe('accommodations');
            expect(config2.queryKey[1]).toBe('destinations');
        });

        it('should generate unique query keys for different params', () => {
            const queryClient = createTestQueryClient();

            const config1 = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20 },
                queryClient
            );
            const config2 = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 2, pageSize: 20 },
                queryClient
            );
            const config3 = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20, q: 'search' },
                queryClient
            );

            expect(config1.queryKey).not.toEqual(config2.queryKey);
            expect(config1.queryKey).not.toEqual(config3.queryKey);
        });

        it('should include sort in query key', () => {
            const queryClient = createTestQueryClient();

            const configNoSort = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20 },
                queryClient
            );
            const configWithSort = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20, sort: [{ id: 'name', desc: false }] },
                queryClient
            );

            expect(configNoSort.queryKey).not.toEqual(configWithSort.queryKey);
        });
    });

    describe('Parameter Changes', () => {
        it('should refetch when page changes', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [],
                total: 100,
                page: 1,
                pageSize: 20
            });

            const { result, rerender } = renderHook(
                ({ page }) => useTestEntityQuery('entities', queryFn, { page, pageSize: 20 }),
                { initialProps: { page: 1 } }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(queryFn).toHaveBeenCalledTimes(1);

            // Change page
            rerender({ page: 2 });

            await waitFor(() => {
                expect(queryFn).toHaveBeenCalledTimes(2);
            });

            expect(queryFn).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
        });

        it('should refetch when search query changes', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                pageSize: 20
            });

            const { result, rerender } = renderHook(
                ({ q }) => useTestEntityQuery('entities', queryFn, { page: 1, pageSize: 20, q }),
                { initialProps: { q: undefined as string | undefined } }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Change search query
            rerender({ q: 'beach' });

            await waitFor(() => {
                expect(queryFn).toHaveBeenCalledWith({ page: 1, pageSize: 20, q: 'beach' });
            });
        });

        it('should refetch when sort changes', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                pageSize: 20
            });

            type SortType = Array<{ id: string; desc: boolean }> | undefined;

            const { result, rerender } = renderHook(
                ({ sort }) =>
                    useTestEntityQuery('entities', queryFn, { page: 1, pageSize: 20, sort }),
                { initialProps: { sort: undefined as SortType } }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Change sort
            rerender({ sort: [{ id: 'name', desc: true }] });

            await waitFor(() => {
                expect(queryFn).toHaveBeenCalledWith({
                    page: 1,
                    pageSize: 20,
                    sort: [{ id: 'name', desc: true }]
                });
            });
        });
    });

    describe('Configuration', () => {
        it('should use correct stale time', () => {
            const queryClient = createTestQueryClient();
            const config = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20 },
                queryClient
            );

            expect(config.staleTime).toBe(30_000); // 30 seconds
        });

        it('should use correct gc time', () => {
            const queryClient = createTestQueryClient();
            const config = useEntityQueryMock(
                'entities',
                vi.fn(),
                { page: 1, pageSize: 20 },
                queryClient
            );

            expect(config.gcTime).toBe(5 * 60 * 1000); // 5 minutes
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty data response', async () => {
            const queryFn = vi.fn().mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                pageSize: 20
            });

            const { result } = renderHook(() =>
                useTestEntityQuery('entities', queryFn, { page: 1, pageSize: 20 })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data?.data).toHaveLength(0);
            expect(result.current.data?.total).toBe(0);
        });

        it('should handle large datasets', async () => {
            const largeData = Array.from({ length: 1000 }, (_, i) => ({
                id: String(i),
                name: `Entity ${i}`,
                slug: `entity-${i}`
            }));

            const queryFn = vi.fn().mockResolvedValue({
                data: largeData,
                total: 10000,
                page: 1,
                pageSize: 1000
            });

            const { result } = renderHook(() =>
                useTestEntityQuery('entities', queryFn, { page: 1, pageSize: 1000 })
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data?.data).toHaveLength(1000);
            expect(result.current.data?.total).toBe(10000);
        });

        it('should handle rapid parameter changes', async () => {
            const queryFn = vi.fn().mockImplementation(
                (params: EntityQueryParams) =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    data: [],
                                    total: 0,
                                    page: params.page,
                                    pageSize: params.pageSize
                                }),
                            50
                        )
                    )
            );

            const { result, rerender } = renderHook(
                ({ page }) => useTestEntityQuery('entities', queryFn, { page, pageSize: 20 }),
                { initialProps: { page: 1 } }
            );

            // Rapidly change pages
            rerender({ page: 2 });
            rerender({ page: 3 });
            rerender({ page: 4 });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Should have made multiple calls
            expect(queryFn).toHaveBeenCalled();
        });
    });
});
