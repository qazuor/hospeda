/**
 * @file cache/cache-tag-environment.ts
 * @description The web app's half of the cache-tag namespace (HOS-369).
 *
 * `staging.hospeda.com.ar` and `hospeda.com.ar` are the same Cloudflare zone,
 * so every tag this app emits carries the deployment that produced it —
 * `prod:list-accom`, `preview:home`. The API derives the identical namespace
 * from the identical variable through the identical function
 * (`resolveCacheTagEnvironment`, `@repo/cache-tags`); a divergence between the
 * two makes every purge match nothing while reporting success.
 *
 * This module resolves it ONCE per process and remembers the result, including
 * the failure. Two properties follow from that, both deliberate:
 *
 *   - the log line is emitted once, not once per request, so a misconfigured
 *     deployment is a visible startup-time error rather than log noise nobody
 *     reads;
 *   - a request cannot be served with a different namespace than the one that
 *     the same process already used, which is the only way the collector (which
 *     runs at render time) and the header writer (which runs after it) are
 *     guaranteed to agree.
 *
 * FAIL-CLOSED, NOT FAIL-FAST. When the environment cannot be resolved this
 * returns `null` and every caller declines to tag — which makes
 * `applyCacheHeaders` demote its response to `private, no-cache` and the static
 * endpoints do the same. The site keeps serving, uncached. Throwing here would
 * take a public site down over a cache-namespace variable; emitting untagged
 * cacheable responses would leave content nothing can invalidate for its whole
 * TTL; guessing `prod` would make staging evict production. Uncached-but-correct
 * is the only one of the four that is merely slow.
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import { resolveCacheTagEnvironment } from '@repo/cache-tags';

/** Memoised outcome; `undefined` means "not resolved yet", `null` means "failed". */
let resolved: CacheTagEnvironment | null | undefined;

/**
 * Read one variable straight from `process.env`, deliberately NOT through
 * `lib/env.ts`'s validated accessor.
 *
 * `validateWebEnv()` parses the WHOLE schema and throws on the first problem
 * anywhere in it, so routing this read through it would let an unrelated
 * misconfiguration — a missing `PUBLIC_SENTRY_DSN`, a malformed admin URL —
 * silently disable cache tagging across the site. The value is still declared
 * in `serverEnvBaseSchema`, so an out-of-range value is still rejected by
 * startup validation; this read only refuses to inherit OTHER variables'
 * failures. `pages/api/revalidate.ts` reads its Cloudflare credentials the same
 * way, for the same subsystem and the same reason.
 *
 * @param name - The environment variable to read.
 * @returns Its value, or undefined when unset or when there is no `process`.
 */
function readProcessEnv(name: string): string | undefined {
    if (typeof process === 'undefined' || !process.env) return undefined;
    return process.env[name];
}

/**
 * The deployment environment every cache tag emitted by this app is prefixed
 * with, or `null` when it cannot be determined.
 *
 * @returns The resolved environment, or `null` when tagging must be skipped.
 */
export function getCacheTagEnvironment(): CacheTagEnvironment | null {
    if (resolved !== undefined) return resolved;

    try {
        resolved = resolveCacheTagEnvironment({
            deployEnv: readProcessEnv('HOSPEDA_DEPLOY_ENV'),
            nodeEnv: readProcessEnv('NODE_ENV')
        });
    } catch (error) {
        resolved = null;
        // console rather than the app logger: this runs during middleware module
        // load, before any request context exists, and mirrors the existing
        // `reportInternalBypassSelfCheck` self-check in `src/middleware.ts`.
        console.error(
            '[web] Cache tagging DISABLED — cannot resolve the cache-tag namespace. ' +
                'Edge-cacheable responses will be demoted to `private, no-cache` and ' +
                'Cloudflare purges from the API will be rejected. ' +
                `Cause: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return resolved;
}

/**
 * Reset the memoised resolution.
 *
 * @internal Use only in tests, which need to exercise more than one deployment
 *   configuration inside a single process.
 */
export function _resetCacheTagEnvironment(): void {
    resolved = undefined;
}
