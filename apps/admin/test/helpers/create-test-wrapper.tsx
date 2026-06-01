/**
 * createTestWrapper — React wrapper factory for renderHook tests.
 *
 * Provides QueryClientProvider (with retry: false and no GC delay) so hook
 * tests can use MSW-intercepted HTTP without retrying on expected failures.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTestQueryClient } from './create-test-query-client';

interface WrapperProps {
    readonly children: ReactNode;
}

/**
 * Creates a React wrapper component suitable for Vitest's `renderHook`.
 *
 * Each call returns a fresh wrapper backed by an isolated QueryClient so that
 * test state does not bleed across cases.
 *
 * @returns A React component that wraps its children in QueryClientProvider.
 *
 * @example
 * ```ts
 * const { result } = renderHook(() => usePlansQuery(), {
 *   wrapper: createTestWrapper(),
 * });
 * ```
 */
export function createTestWrapper(): React.ComponentType<{ children: ReactNode }> {
    const queryClient = createTestQueryClient();

    function TestWrapper({ children }: WrapperProps) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return TestWrapper;
}
