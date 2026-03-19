import { QueryClient } from '@tanstack/react-query';

/**
 * Creates a QueryClient configured for testing.
 * - retry: false -- fail immediately instead of retrying
 * - gcTime: Infinity -- prevents "Vitest did not exit" errors from pending GC timers
 */
export function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Number.POSITIVE_INFINITY
            },
            mutations: { retry: false }
        }
    });
}
