import type { RevalidateTargetResult, RevalidationAdapter } from './revalidation.adapter.js';
import { WHOLE_ZONE_TARGET } from './revalidation.adapter.js';

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
     * lives at `${siteUrl}/api/revalidate/?secret=...` (trailing slash required,
     * see {@link CloudflareRevalidationAdapter} for why). */
    readonly siteUrl: string;
}

/**
 * Maximum tags Cloudflare accepts in one purge request (Free/Pro/Business:
 * 100 operations per request). Larger batches are split.
 */
const MAX_TAGS_PER_PURGE_REQUEST = 100;

/**
 * Production adapter that invalidates the Cloudflare cache by POSTing to the
 * web app's `/api/revalidate` endpoint with a shared secret. The web endpoint
 * holds the Cloudflare credentials and forwards the purge for the configured
 * zone.
 *
 * Since HOS-369 W1-1 this sends the cache tags to purge instead of triggering a
 * whole-zone flush. {@link revalidateMany} still collapses a batch into as few
 * requests as possible — Cloudflare takes 100 tags per call, and the tag-purge
 * rate limit on the Free plan is 5 requests per minute, so requests are the
 * scarce resource, not tags.
 *
 * @example
 * ```ts
 * const adapter = new CloudflareRevalidationAdapter({
 *   secret: process.env.HOSPEDA_REVALIDATION_SECRET,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 * });
 *
 * const result = await adapter.revalidate({ tag: 'accom-hotel-paradise' });
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
     * Purge every response carrying one cache tag.
     * Never throws — errors are captured in the result.
     *
     * @param params.tag - The cache tag to purge
     * @returns Result with success flag, duration, and optional error message
     */
    async revalidate(params: { readonly tag: string }): Promise<RevalidateTargetResult> {
        const { tag } = params;
        const result = await this.postPurge({ body: { tags: [tag] } });
        return { ...result, target: tag };
    }

    /**
     * Purge a batch of cache tags, in as few upstream requests as Cloudflare's
     * 100-tags-per-request limit allows. Every input tag receives the outcome
     * of the request that carried it.
     *
     * @param params.tags - Cache tags to purge
     * @returns One result per input tag, in input order
     */
    async revalidateMany(params: {
        readonly tags: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidateTargetResult>> {
        const { tags } = params;
        if (tags.length === 0) {
            return [];
        }

        const results: RevalidateTargetResult[] = [];
        for (let i = 0; i < tags.length; i += MAX_TAGS_PER_PURGE_REQUEST) {
            const chunk = tags.slice(i, i + MAX_TAGS_PER_PURGE_REQUEST);
            const purge = await this.postPurge({ body: { tags: chunk } });
            for (const tag of chunk) {
                results.push({ ...purge, target: tag });
            }
        }
        return results;
    }

    /**
     * Flush the whole zone — the deploy-time escape hatch (spec §7.3).
     *
     * @param params.reason - Human-readable justification, forwarded for logging
     * @returns Result targeting `*`
     */
    async purgeEverything(params: { readonly reason?: string }): Promise<RevalidateTargetResult> {
        const result = await this.postPurge({
            body: { purgeEverything: true, reason: params.reason }
        });
        return { ...result, target: WHOLE_ZONE_TARGET };
    }

    /**
     * POST one purge instruction to the web `/api/revalidate/` endpoint.
     * Returns a partial result with a placeholder target — callers fill in the
     * real one.
     */
    private async postPurge({
        body
    }: {
        readonly body:
            | { readonly tags: ReadonlyArray<string> }
            | { readonly purgeEverything: true; readonly reason?: string };
    }): Promise<RevalidateTargetResult> {
        const start = Date.now();
        // Trailing slash is REQUIRED: the web app runs `trailingSlash: 'always'`
        // (apps/web/astro.config.mjs) and its middleware exempts `/api/*` from its
        // own trailing-slash redirect, so Astro core 301-redirects `/api/revalidate`
        // → `/api/revalidate/`. A POST following that 301 is downgraded to GET and
        // hits a route that only exports POST, yielding HTTP 404 (the exact failure
        // seen in prod, HOS-203). Emit the slashed form directly, mirroring
        // apps/web/src/lib/og-template.ts which does the same for `/api/og/`.
        const url = `${this.siteUrl}/api/revalidate/?secret=${encodeURIComponent(this.secret)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            const durationMs = Date.now() - start;

            if (!response.ok) {
                return {
                    target: '?',
                    success: false,
                    durationMs,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }

            return { target: '?', success: true, durationMs };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    target: '?',
                    success: false,
                    durationMs: Date.now() - start,
                    error: 'Request timeout (10s)'
                };
            }
            return {
                target: '?',
                success: false,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
