/**
 * @file noindex-hosts.ts
 * @description Parser for `HOSPEDA_NOINDEX_HOSTS`, the host list that must not
 * be indexed.
 *
 * Lives in its own dependency-free module on purpose. `robots.txt`, `llms.txt`
 * and `/api/indexnow` need only this one function, and importing it from
 * `middleware-helpers.ts` dragged that module's whole graph into each of them
 * — Sentry, `@repo/media`, `@repo/utils` and, since HOS-807, the icon sprite
 * (every `@repo/icons` glyph plus `react-dom/server`, rendered at module load).
 * `middleware-helpers.ts` re-exports it, so the global middleware keeps its
 * import and there is still exactly one parser.
 */

/**
 * Default noindex host (used when `HOSPEDA_NOINDEX_HOSTS` is unset).
 * Kept narrow on purpose: a missing env var is safer to default to the
 * known pre-launch staging host than to leave indexing wide open.
 */
const DEFAULT_NOINDEX_HOST = 'staging.hospeda.com.ar';

/**
 * Parse the `HOSPEDA_NOINDEX_HOSTS` env var (comma-separated host list)
 * into a normalised lowercase array. Used by both the global middleware
 * (which sets `X-Robots-Tag: noindex, nofollow`) and the dynamic
 * `robots.txt` endpoint (which serves `Disallow: /` for those hosts).
 *
 * Centralising the parser here means a future host alias only needs the
 * env var update — no risk of one mechanism updating without the other
 * (header sent but robots.txt still permissive, or vice versa).
 *
 * @param raw - Raw string from `import.meta.env.HOSPEDA_NOINDEX_HOSTS`.
 *              Pass `undefined` to fall back to the default.
 * @returns Lowercase, trimmed, deduplicated host list. Always non-empty
 *          (falls back to {@link DEFAULT_NOINDEX_HOST} when input is
 *          undefined / empty / all-whitespace).
 */
export function parseNoindexHosts(raw: string | undefined): ReadonlyArray<string> {
    const source = raw && raw.trim().length > 0 ? raw : DEFAULT_NOINDEX_HOST;
    const seen = new Set<string>();
    for (const part of source.split(',')) {
        const host = part.trim().toLowerCase();
        if (host.length > 0) seen.add(host);
    }
    return [...seen];
}
