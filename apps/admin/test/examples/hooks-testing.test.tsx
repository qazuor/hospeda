/**
 * Example: Testing React Hooks with API Calls
 *
 * This file demonstrates how to test React hooks that make API calls.
 * Uses @testing-library/react-hooks patterns with MSW for API mocking.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mockData, mockErrorResponse, mockPaginatedResponse } from '../mocks/handlers';
import { server } from '../mocks/server';

const API_BASE = '/api/v1';

/**
 * Example hook that fetches entities
 * This simulates the pattern used in useEntityQuery
 */
function useExampleEntityFetch(endpoint: string) {
    const [data, setData] = useState<unknown[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const response = await fetch(endpoint);
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }
                const result = await response.json();
                setData(result.data?.items || []);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [endpoint]);

    return { data, isLoading, error };
}

/**
 * Wrapper for testing hooks with React Query
 */
function createQueryWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0
            }
        }
    });

    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

describe('Hook Testing Examples', () => {
    describe('Basic Hook Testing', () => {
        it('should test a simple fetch hook', async () => {
            const { result } = renderHook(() =>
                useExampleEntityFetch(`${API_BASE}/public/accommodations`)
            );

            // Initial state should be loading
            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeNull();

            // Wait for data to load
            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Verify data loaded correctly
            expect(result.current.data).toHaveLength(1);
            expect(result.current.error).toBeNull();
        });

        it('should handle errors in hooks', async () => {
            // Override handler to return error
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Entity not found'), {
                        status: 404
                    });
                })
            );

            const { result } = renderHook(() =>
                useExampleEntityFetch(`${API_BASE}/public/accommodations`)
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toContain('404');
        });
    });

    describe('Testing with TanStack Query', () => {
        it('should test hook with QueryClientProvider wrapper', async () => {
            // Example of a hook that uses TanStack Query
            function useEntitiesQuery() {
                const [data, setData] = useState<unknown>(null);
                const [isLoading, setIsLoading] = useState(true);

                useEffect(() => {
                    fetch(`${API_BASE}/public/destinations`)
                        .then((res) => res.json())
                        .then((result) => {
                            setData(result.data);
                            setIsLoading(false);
                        });
                }, []);

                return { data, isLoading };
            }

            const wrapper = createQueryWrapper();
            const { result } = renderHook(() => useEntitiesQuery(), { wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeDefined();
        });
    });

    describe('Testing Hook State Updates', () => {
        it('should track state changes over time', async () => {
            const stateHistory: Array<{ isLoading: boolean; hasData: boolean }> = [];

            function useTrackedFetch(endpoint: string) {
                const [state, setState] = useState({ data: null as unknown, isLoading: true });

                useEffect(() => {
                    fetch(endpoint)
                        .then((res) => res.json())
                        .then((result) => {
                            setState({ data: result.data, isLoading: false });
                        });
                }, [endpoint]);

                // Track state for testing
                useEffect(() => {
                    stateHistory.push({
                        isLoading: state.isLoading,
                        hasData: state.data !== null
                    });
                }, [state]);

                return state;
            }

            const { result } = renderHook(() => useTrackedFetch(`${API_BASE}/public/events`));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Verify state transitions
            expect(stateHistory.length).toBeGreaterThanOrEqual(2);
            expect(stateHistory[0]).toEqual({ isLoading: true, hasData: false });
            expect(stateHistory[stateHistory.length - 1]).toEqual({
                isLoading: false,
                hasData: true
            });
        });
    });

    describe('Testing Hooks with Dependencies', () => {
        it('should re-fetch when dependencies change', async () => {
            let fetchCount = 0;

            server.use(
                http.get(`${API_BASE}/public/accommodations/:id`, ({ params }) => {
                    fetchCount++;
                    return HttpResponse.json({
                        success: true,
                        data: { id: params.id, name: `Hotel ${params.id}` },
                        metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
                    });
                })
            );

            function useFetchById(id: string) {
                const [data, setData] = useState<unknown>(null);

                useEffect(() => {
                    fetch(`${API_BASE}/public/accommodations/${id}`)
                        .then((res) => res.json())
                        .then((result) => setData(result.data));
                }, [id]);

                return data;
            }

            const { result, rerender } = renderHook(({ id }) => useFetchById(id), {
                initialProps: { id: '1' }
            });

            await waitFor(() => {
                expect(result.current).not.toBeNull();
            });

            expect(fetchCount).toBe(1);

            // Change the ID
            rerender({ id: '2' });

            await waitFor(() => {
                expect((result.current as { id: string })?.id).toBe('2');
            });

            expect(fetchCount).toBe(2);
        });
    });

    describe('Testing Debounced Hooks', () => {
        it('should test debounce logic without network', async () => {
            vi.useFakeTimers();

            function useDebounce<T>(value: T, delay = 300): T {
                const [debouncedValue, setDebouncedValue] = useState(value);

                useEffect(() => {
                    const timer = setTimeout(() => {
                        setDebouncedValue(value);
                    }, delay);
                    return () => clearTimeout(timer);
                }, [value, delay]);

                return debouncedValue;
            }

            const { result, rerender } = renderHook(({ query }) => useDebounce(query), {
                initialProps: { query: 'test' }
            });

            // Value shouldn't update immediately
            expect(result.current).toBe('test'); // initial state from useState

            // Type more quickly than debounce
            rerender({ query: 'te' });
            rerender({ query: 'tes' });
            rerender({ query: 'test2' });

            // Before debounce triggers, value should still be initial
            expect(result.current).toBe('test');

            // Fast-forward past debounce
            act(() => {
                vi.advanceTimersByTime(300);
            });

            // Only the final value should be set
            expect(result.current).toBe('test2');

            vi.useRealTimers();
        });

        it('should test debounced search with network', async () => {
            let lastQuery = '';
            server.use(
                http.get(`${API_BASE}/public/accommodations`, ({ request }) => {
                    const url = new URL(request.url);
                    lastQuery = url.searchParams.get('q') || '';
                    return HttpResponse.json(mockPaginatedResponse([mockData.accommodation]));
                })
            );

            function useDebouncedSearch(query: string) {
                const [results, setResults] = useState<unknown[]>([]);

                useEffect(() => {
                    if (query) {
                        fetch(`${API_BASE}/public/accommodations?q=${query}`)
                            .then((res) => res.json())
                            .then((data) => setResults(data.data?.items || []));
                    }
                }, [query]);

                return { results, query };
            }

            const { result } = renderHook(() => useDebouncedSearch('test'));

            await waitFor(() => {
                expect(result.current.results).toHaveLength(1);
            });

            expect(lastQuery).toBe('test');
        });
    });

    describe('Testing Mutation Hooks', () => {
        it('should test create mutation hook', async () => {
            server.use(
                http.post(`${API_BASE}/admin/accommodations`, async ({ request }) => {
                    const body = await request.json();
                    return HttpResponse.json(
                        {
                            success: true,
                            data: { id: 'new-id', ...(body as object) },
                            metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
                        },
                        { status: 201 }
                    );
                })
            );

            function useCreateEntity() {
                const [isLoading, setIsLoading] = useState(false);
                const [result, setResult] = useState<unknown>(null);
                const [error, setError] = useState<Error | null>(null);

                const create = async (data: object) => {
                    setIsLoading(true);
                    setError(null);
                    try {
                        const response = await fetch(`${API_BASE}/admin/accommodations`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const json = await response.json();
                        setResult(json.data);
                        return json.data;
                    } catch (err) {
                        setError(err instanceof Error ? err : new Error('Create failed'));
                        throw err;
                    } finally {
                        setIsLoading(false);
                    }
                };

                return { create, isLoading, result, error };
            }

            const { result } = renderHook(() => useCreateEntity());

            expect(result.current.isLoading).toBe(false);
            expect(result.current.result).toBeNull();

            // Execute mutation
            await act(async () => {
                await result.current.create({ name: 'New Hotel' });
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.result).toEqual({ id: 'new-id', name: 'New Hotel' });
        });
    });
});
