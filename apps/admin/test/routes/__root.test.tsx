/**
 * @file QueryClient Cache Persistence Tests
 *
 * Tests for TASK-102: Verify QueryClient cache persists across navigations
 * and component re-renders.
 */

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Helper to create QueryClient with same config as __root.tsx
 */
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000,
                gcTime: 30 * 60 * 1000,
                retry: (failureCount, error) => {
                    if (error instanceof Error && 'status' in error) {
                        const status = (error as { status: number }).status;
                        if (status >= 400 && status < 500) {
                            return false;
                        }
                    }
                    return failureCount < 3;
                },
                refetchOnWindowFocus: false
            },
            mutations: {
                retry: false
            }
        }
    });

// Note: TestRootWrapper and BadWrapper removed as unused
// They were examples for documentation purposes

describe('QueryClient Configuration', () => {
    describe('Cache Persistence', () => {
        it('should create QueryClient once with useState lazy initializer', () => {
            const createClientSpy = vi.fn(() => createTestQueryClient());

            function TestComponent() {
                const [queryClient] = useState(createClientSpy);
                return (
                    <QueryClientProvider client={queryClient}>
                        <div>Test</div>
                    </QueryClientProvider>
                );
            }

            const { rerender } = render(<TestComponent />);

            // Initial render
            expect(createClientSpy).toHaveBeenCalledTimes(1);

            // Re-render should NOT create new client
            rerender(<TestComponent />);
            expect(createClientSpy).toHaveBeenCalledTimes(1);

            // Multiple re-renders
            rerender(<TestComponent />);
            rerender(<TestComponent />);
            expect(createClientSpy).toHaveBeenCalledTimes(1);
        });

        it('should preserve cache data across component re-renders', async () => {
            const queryClient = createTestQueryClient();
            const mockData = { id: '1', name: 'Test Item' };
            const fetchFn = vi.fn().mockResolvedValue(mockData);

            function TestComponent() {
                const { data } = useQuery({
                    queryKey: ['test-item'],
                    queryFn: fetchFn
                });
                return <div>{data?.name}</div>;
            }

            const { rerender, getByText } = render(
                <QueryClientProvider client={queryClient}>
                    <TestComponent />
                </QueryClientProvider>
            );

            // Wait for initial fetch
            await waitFor(() => {
                expect(getByText('Test Item')).toBeInTheDocument();
            });
            expect(fetchFn).toHaveBeenCalledTimes(1);

            // Re-render should use cached data, not fetch again
            rerender(
                <QueryClientProvider client={queryClient}>
                    <TestComponent />
                </QueryClientProvider>
            );

            expect(getByText('Test Item')).toBeInTheDocument();
            expect(fetchFn).toHaveBeenCalledTimes(1); // Still 1, not 2
        });

        it('should maintain cache when navigating between routes (simulated)', async () => {
            const queryClient = createTestQueryClient();
            const mockData = { id: '1', name: 'Cached Data' };
            const fetchFn = vi.fn().mockResolvedValue(mockData);

            function RouteA() {
                const { data } = useQuery({
                    queryKey: ['shared-data'],
                    queryFn: fetchFn
                });
                return <div data-testid="route-a">{data?.name}</div>;
            }

            function RouteB() {
                const { data } = useQuery({
                    queryKey: ['shared-data'],
                    queryFn: fetchFn
                });
                return <div data-testid="route-b">{data?.name}</div>;
            }

            // Render Route A
            const { rerender, getByTestId } = render(
                <QueryClientProvider client={queryClient}>
                    <RouteA />
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(getByTestId('route-a')).toHaveTextContent('Cached Data');
            });
            expect(fetchFn).toHaveBeenCalledTimes(1);

            // Navigate to Route B (simulated)
            rerender(
                <QueryClientProvider client={queryClient}>
                    <RouteB />
                </QueryClientProvider>
            );

            // Should immediately show cached data
            expect(getByTestId('route-b')).toHaveTextContent('Cached Data');
            // Should NOT fetch again (data is fresh within staleTime)
            expect(fetchFn).toHaveBeenCalledTimes(1);

            // Navigate back to Route A
            rerender(
                <QueryClientProvider client={queryClient}>
                    <RouteA />
                </QueryClientProvider>
            );

            expect(getByTestId('route-a')).toHaveTextContent('Cached Data');
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('Cache Invalidation', () => {
        it('should refetch when cache is invalidated', async () => {
            const queryClient = createTestQueryClient();
            let callCount = 0;
            const fetchFn = vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve({ id: '1', name: `Data v${callCount}` });
            });

            function TestComponent() {
                const { data } = useQuery({
                    queryKey: ['invalidation-test'],
                    queryFn: fetchFn
                });
                const client = useQueryClient();

                return (
                    <div>
                        <span data-testid="data">{data?.name}</span>
                        <button
                            data-testid="invalidate"
                            onClick={() =>
                                client.invalidateQueries({ queryKey: ['invalidation-test'] })
                            }
                        >
                            Invalidate
                        </button>
                    </div>
                );
            }

            const { getByTestId } = render(
                <QueryClientProvider client={queryClient}>
                    <TestComponent />
                </QueryClientProvider>
            );

            // Initial fetch
            await waitFor(() => {
                expect(getByTestId('data')).toHaveTextContent('Data v1');
            });
            expect(fetchFn).toHaveBeenCalledTimes(1);

            // Invalidate cache
            act(() => {
                getByTestId('invalidate').click();
            });

            // Should refetch
            await waitFor(() => {
                expect(getByTestId('data')).toHaveTextContent('Data v2');
            });
            expect(fetchFn).toHaveBeenCalledTimes(2);
        });

        it('should respect staleTime before refetching', async () => {
            const queryClient = createTestQueryClient();
            const fetchFn = vi.fn().mockResolvedValue({ id: '1' });

            const { result } = renderHook(
                () =>
                    useQuery({
                        queryKey: ['stale-test'],
                        queryFn: fetchFn
                    }),
                {
                    wrapper: ({ children }) => (
                        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
                    )
                }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(fetchFn).toHaveBeenCalledTimes(1);

            // Data should not be stale immediately (staleTime is 5 minutes)
            expect(result.current.isStale).toBe(false);
        });
    });

    describe('Retry Configuration', () => {
        it('should not retry on 4xx errors', async () => {
            const queryClient = createTestQueryClient();
            const error = Object.assign(new Error('Not Found'), { status: 404 });
            const fetchFn = vi.fn().mockRejectedValue(error);

            const { result } = renderHook(
                () =>
                    useQuery({
                        queryKey: ['404-test'],
                        queryFn: fetchFn
                    }),
                {
                    wrapper: ({ children }) => (
                        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
                    )
                }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            // Should only call once (no retries for 4xx)
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });

        it('should retry up to 3 times for 5xx errors', async () => {
            const queryClient = createTestQueryClient();
            const error = Object.assign(new Error('Server Error'), { status: 500 });
            const fetchFn = vi.fn().mockRejectedValue(error);

            const { result } = renderHook(
                () =>
                    useQuery({
                        queryKey: ['500-test'],
                        queryFn: fetchFn,
                        retryDelay: 0 // Immediate retry for faster tests
                    }),
                {
                    wrapper: ({ children }) => (
                        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
                    )
                }
            );

            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true);
                },
                { timeout: 5000 }
            );

            // Should retry 3 times + initial = 4 calls
            expect(fetchFn).toHaveBeenCalledTimes(4);
        });

        it('should not retry mutations', () => {
            const queryClient = createTestQueryClient();

            // Verify mutation retry is disabled by default in config
            expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
        });
    });

    describe('Window Focus Refetch', () => {
        it('should have refetchOnWindowFocus disabled', () => {
            const queryClient = createTestQueryClient();
            const defaultOptions = queryClient.getDefaultOptions();

            expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
        });
    });

    describe('Garbage Collection', () => {
        it('should have gcTime set to 30 minutes', () => {
            const queryClient = createTestQueryClient();
            const defaultOptions = queryClient.getDefaultOptions();

            expect(defaultOptions.queries?.gcTime).toBe(30 * 60 * 1000);
        });

        it('should have staleTime set to 5 minutes', () => {
            const queryClient = createTestQueryClient();
            const defaultOptions = queryClient.getDefaultOptions();

            expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);
        });
    });
});

describe('Bad Pattern Detection', () => {
    it('should demonstrate why direct QueryClient creation is bad', () => {
        const createClientSpy = vi.fn(() => new QueryClient());

        function BadComponent() {
            // BAD: Creates new client on every render
            const queryClient = createClientSpy();
            return (
                <QueryClientProvider client={queryClient}>
                    <div>Bad</div>
                </QueryClientProvider>
            );
        }

        const { rerender } = render(<BadComponent />);
        expect(createClientSpy).toHaveBeenCalledTimes(1);

        // Each re-render creates a new client (BAD!)
        rerender(<BadComponent />);
        expect(createClientSpy).toHaveBeenCalledTimes(2);

        rerender(<BadComponent />);
        expect(createClientSpy).toHaveBeenCalledTimes(3);
    });
});
