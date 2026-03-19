/**
 * @fileoverview
 * Adapter interface for ISR revalidation backends.
 * Implementations receive connection config in the constructor and expose
 * a simple `revalidate(path)` / `revalidateMany(paths)` API.
 *
 * Adapters MUST never throw — errors are captured in the result object.
 */

/**
 * Result of a single path revalidation attempt.
 * Always returned — never thrown.
 */
export interface RevalidatePathResult {
    /** The path that was revalidated (echoed from the input) */
    readonly path: string;
    /** Whether the revalidation request succeeded */
    readonly success: boolean;
    /** Error message if success is false */
    readonly error?: string;
    /** Time taken for the operation in milliseconds */
    readonly durationMs: number;
}

/**
 * Adapter interface for ISR page revalidation.
 *
 * Implementations receive all connection configuration in their constructor,
 * so individual `revalidate` / `revalidateMany` calls only need the target path.
 *
 * Implementations MUST never throw — errors are captured in the result.
 *
 * @example
 * ```ts
 * const adapter: RevalidationAdapter = new VercelRevalidationAdapter({
 *   bypassToken: process.env.HOSPEDA_ISR_BYPASS_TOKEN,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 * });
 *
 * const result = await adapter.revalidate({ path: '/alojamientos/hotel-paradise/' });
 * if (!result.success) {
 *   logger.error('Revalidation failed', { path: result.path, error: result.error });
 * }
 * ```
 */
export interface RevalidationAdapter {
    /** Human-readable adapter name for logging and diagnostics */
    readonly name: string;

    /**
     * Revalidate a single page path.
     * Must never throw — errors are captured in the result.
     *
     * @param params - Object containing the URL path to revalidate
     * @param params.path - The URL path to revalidate (e.g. '/alojamientos/hotel-paradise/')
     * @returns Result with success flag, duration, and optional error message
     */
    revalidate(params: { readonly path: string }): Promise<RevalidatePathResult>;

    /**
     * Revalidate multiple page paths concurrently.
     * Uses `Promise.allSettled` internally — a failure on one path does not abort others.
     * Must never throw.
     *
     * @param params - Object containing the array of URL paths to revalidate
     * @param params.paths - Array of URL paths to revalidate
     * @returns Array of results, one per path, in the same order as input
     */
    revalidateMany(params: {
        readonly paths: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidatePathResult>>;
}
