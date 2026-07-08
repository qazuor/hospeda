/**
 * @file ssr-cache.ts
 * @description Tiny in-process, short-TTL cache for public GET requests issued
 * during SSR (HOS-103).
 *
 * Why this exists: the Astro web app is SSR and calls the public API for every
 * render. A single home render fans out to several public endpoints (some of
 * them requested by more than one component), and Astro's `prefetch` re-runs the
 * full page frontmatter on interaction. Because SSR traffic reaches the API from
 * a single egress IP, all of it shares ONE public rate-limit bucket, so this
 * fan-out exhausts the limit quickly.
 *
 * This cache collapses that fan-out in two ways:
 *   1. **In-flight de-duplication** — two components requesting the same URL in
 *      the same render share a single fetch (the pending promise is reused).
 *   2. **Short TTL** — a successful response is reused for `ttlMs` (default
 *      {@link SSR_PUBLIC_CACHE_TTL_MS}), so repeated renders within that window
 *      (e.g. prefetch bursts, or the footer stats read on every page) hit the
 *      API at most once per key per window.
 *
 * Scope guarantees (enforced by the caller in `client.ts`, not here):
 *   - SSR only. The browser bundle never routes through this cache.
 *   - Public GETs only. Requests carrying credentials/cookies (per-user data)
 *     are never cached.
 *   - Opt-in per endpoint. Only endpoints that pass a `cacheTtlMs` are cached;
 *     interactive reads (search) and detail/mutation calls are left untouched.
 *
 * The store is process-local. Under multiple API/web instances each keeps its
 * own copy — acceptable for public catalog data with a 60s tolerance.
 */

/** A resolved, still-valid cache entry. */
interface CacheEntry<T> {
    /** Epoch ms after which the entry is stale and must be recomputed. */
    readonly expiresAt: number;
    /** The cached loader result. */
    readonly value: T;
}

/**
 * Default TTL for cached public SSR GETs: 60 seconds. Long enough to collapse
 * duplicate reads within a render and repeated renders from prefetch bursts,
 * short enough that public catalog data (destinations, stats, posts, ...) is
 * never meaningfully stale.
 */
export const SSR_PUBLIC_CACHE_TTL_MS = 60_000;

/**
 * Hard cap on the number of resolved entries kept at once. A safety net against
 * unbounded growth in the long-running Astro Node SSR process if a
 * high-cardinality call site ever opts in (mirrors the bounded in-memory store
 * in the API's `rate-limit.ts`). Enforced synchronously on every write — no
 * background timer to manage. Opt-in is scoped to bounded homepage reads today,
 * so this rarely triggers; it exists so a future misuse cannot leak memory.
 */
export const SSR_CACHE_MAX_ENTRIES = 500;

// Resolved values keyed by request key. Separate from the in-flight map so a
// settled value survives after its promise is cleared.
const resolvedStore = new Map<string, CacheEntry<unknown>>();

/**
 * Evicts entries when the resolved store is at capacity, right before a new
 * write. Drops expired entries first; if still at the cap, drops the oldest
 * entries (Map iteration is insertion order) until under it.
 *
 * @param nowMs - Current epoch ms (injected for testability).
 */
function evictIfAtCapacity(nowMs: number): void {
    if (resolvedStore.size < SSR_CACHE_MAX_ENTRIES) {
        return;
    }
    for (const [key, entry] of resolvedStore) {
        if (entry.expiresAt <= nowMs) {
            resolvedStore.delete(key);
        }
    }
    while (resolvedStore.size >= SSR_CACHE_MAX_ENTRIES) {
        const oldest = resolvedStore.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        resolvedStore.delete(oldest);
    }
}

// Promises for requests currently in flight, keyed by request key. Used to
// de-duplicate concurrent identical requests within a single render.
const inFlightStore = new Map<string, Promise<unknown>>();

/**
 * Clears the entire SSR cache (both resolved and in-flight maps).
 * Exported for test isolation; not used by production code.
 */
export function clearSsrCache(): void {
    resolvedStore.clear();
    inFlightStore.clear();
}

/**
 * Returns the number of resolved (settled) entries currently held. For tests
 * and diagnostics only.
 */
export function ssrCacheSize(): number {
    return resolvedStore.size;
}

/**
 * Returns a value for `key` from the cache, or runs `loader` to produce it.
 *
 * Behaviour:
 *   - A fresh resolved entry (`expiresAt` in the future) is returned as-is.
 *   - Otherwise, if a load for the same key is already in flight, its promise is
 *     returned (concurrent de-duplication) — no second loader call is made.
 *   - Otherwise `loader` runs; on completion it is removed from the in-flight
 *     map, and its result is stored with a fresh TTL only when `isCacheable`
 *     returns true (defaults to always). A non-cacheable result (e.g. an error
 *     response) is therefore retried on the next call rather than pinned.
 *
 * @param params - Request key, TTL, loader, optional cacheability predicate, and
 *   an injectable clock (`now`, for tests).
 * @returns The cached or freshly-loaded value.
 */
export async function getOrSetCached<T>({
    key,
    ttlMs,
    loader,
    isCacheable = () => true,
    now = Date.now
}: {
    readonly key: string;
    readonly ttlMs: number;
    readonly loader: () => Promise<T>;
    readonly isCacheable?: (value: T) => boolean;
    readonly now?: () => number;
}): Promise<T> {
    const hit = resolvedStore.get(key);
    if (hit && hit.expiresAt > now()) {
        return hit.value as T;
    }

    const pending = inFlightStore.get(key);
    if (pending) {
        return pending as Promise<T>;
    }

    const promise = (async () => {
        try {
            const value = await loader();
            if (isCacheable(value)) {
                evictIfAtCapacity(now());
                resolvedStore.set(key, { expiresAt: now() + ttlMs, value });
            }
            return value;
        } finally {
            inFlightStore.delete(key);
        }
    })();

    inFlightStore.set(key, promise);
    return promise;
}
