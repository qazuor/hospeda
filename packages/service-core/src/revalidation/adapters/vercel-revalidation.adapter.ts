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
 * const result = await adapter.revalidate({ path: '/alojamientos/hotel-paradise/' });
 * ```
 */
export class VercelRevalidationAdapter implements RevalidationAdapter {
    readonly name = 'VercelRevalidationAdapter';

    private readonly bypassToken: string;
    private readonly siteUrl: string;

    constructor(config: VercelRevalidationAdapterConfig) {
        if (!config.bypassToken?.trim()) {
            throw new Error(
                'VercelRevalidationAdapter: bypassToken is required and cannot be empty'
            );
        }
        this.bypassToken = config.bypassToken;
        this.siteUrl = config.siteUrl;
    }

    /**
     * Revalidates a single page path by calling the Vercel revalidation endpoint
     * with the bypass token in the `x-prerender-revalidate` header.
     * Never throws — errors are captured in the result.
     *
     * @param params - Object containing the URL path to revalidate
     * @param params.path - The URL path to revalidate (e.g. '/alojamientos/hotel-paradise/')
     * @returns Result with success flag, duration, and optional error message
     */
    async revalidate(params: { readonly path: string }): Promise<RevalidatePathResult> {
        const { path } = params;
        const start = Date.now();
        const url = `${this.siteUrl}${path}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-prerender-revalidate': this.bypassToken
                },
                signal: controller.signal
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
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    path,
                    success: false,
                    durationMs: Date.now() - start,
                    error: 'Request timeout (10s)'
                };
            }
            return {
                path,
                success: false,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Revalidates multiple page paths in chunked batches to avoid overwhelming
     * the target server. Each chunk of up to 10 paths runs concurrently via
     * `Promise.allSettled`, with a 200ms delay between chunks.
     * A failure on one path does not abort others.
     * Never throws.
     *
     * @param params - Object containing the array of URL paths to revalidate
     * @param params.paths - Array of URL paths to revalidate
     * @returns Array of results, one per path, in input order
     */
    async revalidateMany(params: {
        readonly paths: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidatePathResult>> {
        const { paths } = params;
        const CHUNK_SIZE = 10;
        const DELAY_MS = 200;
        const results: RevalidatePathResult[] = [];

        for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
            const chunk = paths.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.allSettled(
                chunk.map((path) => this.revalidate({ path }))
            );

            for (const result of chunkResults) {
                results.push(
                    result.status === 'fulfilled'
                        ? result.value
                        : {
                              path: '?',
                              success: false,
                              durationMs: 0,
                              error: String(result.reason)
                          }
                );
            }

            // Delay between chunks (but not after the last chunk)
            if (i + CHUNK_SIZE < paths.length) {
                await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
            }
        }

        return results;
    }
}
