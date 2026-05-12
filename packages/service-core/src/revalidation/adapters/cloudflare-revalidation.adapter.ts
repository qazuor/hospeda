import type { RevalidatePathResult, RevalidationAdapter } from './revalidation.adapter.js';

/**
 * Constructor configuration for {@link CloudflareRevalidationAdapter}.
 */
export interface CloudflareRevalidationAdapterConfig {
    /**
     * Shared secret used to authenticate with the web app's
     * `/api/revalidate` endpoint (matched against
     * `HOSPEDA_REVALIDATION_SECRET` on the web side).
     */
    readonly secret: string;
    /** Base site URL (e.g. `https://hospeda.com.ar`) — the cache-purge endpoint
     * lives at `${siteUrl}/api/revalidate?secret=...`. */
    readonly siteUrl: string;
}

/**
 * Production adapter that triggers Cloudflare cache purge by POSTing to
 * the web app's `/api/revalidate` endpoint with a shared secret. The web
 * endpoint then forwards a `purge_everything` request to the Cloudflare
 * API for the configured zone.
 *
 * Cloudflare's `purge_everything` invalidates the whole zone in one call,
 * so {@link revalidateMany} is implemented as a single request (rather
 * than once per path) — the input paths are returned in the result for
 * traceability but the underlying network call is unified.
 *
 * @example
 * ```ts
 * const adapter = new CloudflareRevalidationAdapter({
 *   secret: process.env.HOSPEDA_REVALIDATION_SECRET,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 * });
 *
 * const result = await adapter.revalidate({ path: '/alojamientos/hotel-paradise/' });
 * ```
 */
export class CloudflareRevalidationAdapter implements RevalidationAdapter {
    readonly name = 'CloudflareRevalidationAdapter';

    private readonly secret: string;
    private readonly siteUrl: string;

    constructor(config: CloudflareRevalidationAdapterConfig) {
        if (!config.secret?.trim()) {
            throw new Error(
                'CloudflareRevalidationAdapter: secret is required and cannot be empty'
            );
        }
        this.secret = config.secret;
        this.siteUrl = config.siteUrl.replace(/\/$/, '');
    }

    /**
     * Triggers a single Cloudflare zone purge.
     * Never throws — errors are captured in the result.
     *
     * @param params.path - The URL path that motivated the revalidation. Used only
     *   in the result for traceability; the actual purge invalidates the whole zone.
     * @returns Result with success flag, duration, and optional error message
     */
    async revalidate(params: { readonly path: string }): Promise<RevalidatePathResult> {
        const { path } = params;
        const result = await this.purgeOnce();
        return { ...result, path };
    }

    /**
     * Triggers a SINGLE Cloudflare zone purge for the whole batch — Cloudflare's
     * purge endpoint already invalidates everything at once, so calling per-path
     * would be wasted requests. The same result (success or failure) is reported
     * for every input path.
     *
     * @param params.paths - Array of URL paths that motivated the revalidation
     * @returns Array of results, one per path, all sharing the same purge outcome
     */
    async revalidateMany(params: {
        readonly paths: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidatePathResult>> {
        const { paths } = params;
        if (paths.length === 0) {
            return [];
        }
        const purge = await this.purgeOnce();
        return paths.map((path) => ({ ...purge, path }));
    }

    /**
     * Internal helper that hits the web `/api/revalidate?secret=...` endpoint once.
     * Returns a partial result with `path: '?'` (callers fill in the path).
     */
    private async purgeOnce(): Promise<RevalidatePathResult> {
        const start = Date.now();
        const url = `${this.siteUrl}/api/revalidate?secret=${encodeURIComponent(this.secret)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                signal: controller.signal
            });

            const durationMs = Date.now() - start;

            if (!response.ok) {
                return {
                    path: '?',
                    success: false,
                    durationMs,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }

            return { path: '?', success: true, durationMs };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    path: '?',
                    success: false,
                    durationMs: Date.now() - start,
                    error: 'Request timeout (10s)'
                };
            }
            return {
                path: '?',
                success: false,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
