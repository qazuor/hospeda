import type { RevalidatePathResult, RevalidationAdapter } from './revalidation.adapter.js';

/**
 * Constructor configuration for {@link VercelRevalidationAdapter}.
 */
export interface VercelRevalidationAdapterConfig {
    /** Bypass token configured in Vercel (value of the `x-prerender-revalidate` header) */
    readonly bypassToken: string;
    /** Base site URL (e.g. `https://hospeda.com.ar`) — paths are appended to it */
    readonly siteUrl: string;
}

/**
 * Production adapter that triggers Vercel On-Demand ISR via
 * the `x-prerender-revalidate` header mechanism.
 *
 * Connection configuration (bypass token + site URL) is provided once in the
 * constructor. Individual `revalidate` / `revalidateMany` calls only need the path.
 *
 * @see https://vercel.com/docs/incremental-static-regeneration/quickstart#on-demand-revalidation
 *
 * @example
 * ```ts
 * const adapter = new VercelRevalidationAdapter({
 *   bypassToken: process.env.HOSPEDA_ISR_BYPASS_TOKEN,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 * });
 *
 * const result = await adapter.revalidate('/alojamientos/hotel-paradise/');
 * ```
 */
export class VercelRevalidationAdapter implements RevalidationAdapter {
    readonly name = 'VercelRevalidationAdapter';

    private readonly bypassToken: string;
    private readonly siteUrl: string;

    constructor(config: VercelRevalidationAdapterConfig) {
        this.bypassToken = config.bypassToken;
        this.siteUrl = config.siteUrl;
    }

    /**
     * Revalidates a single page path by calling the Vercel revalidation endpoint
     * with the bypass token in the `x-prerender-revalidate` header.
     * Never throws — errors are captured in the result.
     *
     * @param path - The URL path to revalidate (e.g. '/alojamientos/hotel-paradise/')
     * @returns Result with success flag, duration, and optional error message
     */
    async revalidate(path: string): Promise<RevalidatePathResult> {
        const start = Date.now();
        const url = `${this.siteUrl}${path}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-prerender-revalidate': this.bypassToken
                }
            });

            const durationMs = Date.now() - start;

            if (!response.ok) {
                return {
                    path,
                    success: false,
                    durationMs,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }

            return { path, success: true, durationMs };
        } catch (error) {
            return {
                path,
                success: false,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Revalidates multiple page paths concurrently using `Promise.allSettled`.
     * A failure on one path does not abort others.
     * Never throws.
     *
     * @param paths - Array of URL paths to revalidate
     * @returns Array of results, one per path
     */
    async revalidateMany(paths: readonly string[]): Promise<readonly RevalidatePathResult[]> {
        const settled = await Promise.allSettled(paths.map((path) => this.revalidate(path)));
        return settled.map((result, i) => {
            if (result.status === 'fulfilled') return result.value;
            // Should not happen since revalidate() never throws, but handle defensively
            return {
                path: paths[i] ?? '',
                success: false,
                durationMs: 0,
                error:
                    result.reason instanceof Error ? result.reason.message : String(result.reason)
            };
        });
    }
}
