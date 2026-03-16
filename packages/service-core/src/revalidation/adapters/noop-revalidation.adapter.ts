import type { RevalidatePathResult, RevalidationAdapter } from './revalidation.adapter.js';

/**
 * No-op adapter used in development and test environments.
 * Simulates successful revalidation without making any HTTP calls.
 *
 * @example
 * ```ts
 * const adapter = new NoOpRevalidationAdapter();
 * const result = await adapter.revalidate('/alojamientos/hotel-paradise/');
 * // result.success === true, no HTTP request was made
 * ```
 */
export class NoOpRevalidationAdapter implements RevalidationAdapter {
    readonly name = 'NoOpRevalidationAdapter';

    /**
     * Simulates a successful revalidation without making any HTTP calls.
     * Used in development and test environments to avoid network dependencies.
     *
     * @param path - The URL path (returned in the result, otherwise ignored)
     * @returns A successful result with the given path and measured duration
     */
    async revalidate(path: string): Promise<RevalidatePathResult> {
        const start = Date.now();
        return {
            path,
            success: true,
            durationMs: Date.now() - start
        };
    }

    /**
     * Simulates successful revalidation for all paths without making any HTTP calls.
     *
     * @param paths - The URL paths to simulate revalidating
     * @returns Array of successful results, one per path
     */
    async revalidateMany(paths: readonly string[]): Promise<readonly RevalidatePathResult[]> {
        return Promise.all(paths.map((path) => this.revalidate(path)));
    }
}
