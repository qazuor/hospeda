/**
 * @file cache/cache-classes.ts
 * @description The freshness budget of every cacheable page, by class (HOS-426).
 *
 * Until this file existed there was ONE `Cache-Control` for the whole site —
 * `s-maxage=300, stale-while-revalidate=600` — shared by a legal page that can
 * only change on deploy and an events listing that changes when an editor saves.
 * `applyCacheHeaders` took no TTL argument, so there was no dial to turn: the
 * ~37 `s-maxage=300` mentions across `src/pages` were all comments.
 *
 * WHY A NAMED CLASS RATHER THAN A NUMBER PER CALL SITE. A `ttlSeconds: 3600` at
 * 40 call sites is 40 independent opportunities to drift, and a diff that moves
 * one page from 3600 to 7200 tells a reviewer nothing about whether that page is
 * still like its neighbours. A class makes the intent reviewable, makes a global
 * re-tune one edit here, and gives the static guard something it can actually
 * verify — that a page declared a class from this closed set.
 *
 * WHY THE CLASS IS REQUIRED, WITH NO DEFAULT. A default would let a new
 * cacheable page ship silently at whatever the default happens to be, which is
 * the failure this file exists to remove. Required means the compiler enumerates
 * every page the moment a class is added or the parameter changes.
 *
 * HOW A CLASS IS CHOSEN: by what can invalidate the page, which is the same
 * thing as the cache tag it declares. That is not a coincidence to preserve by
 * discipline — a page whose class disagrees with its tag is a page whose
 * freshness budget is being decided by the wrong mechanism.
 *
 *   - `static`  — content comes from `@repo/i18n` and the page source, so ONLY a
 *                 deploy changes it. Tagged `site-config`.
 *   - `catalog` — a listing. Invalidated by a COLLECTION tag purge, which works
 *                 today (HOS-424 does not affect it).
 *   - `detail`  — a single entity's page. Invalidated by an ENTITY tag purge,
 *                 which is broken today: see the HOS-424 note on `detail` below.
 *   - `home`    — aggregates featured content across entities; tagged `home`.
 *   - `pricing` — the four `suscriptores/*` pages; tagged `pricing`, purged by
 *                 `plan.service.ts` on a plan write.
 *
 * THE NUMBERS BELOW ARE OWNER DECISION D-15 (statics 24 h, catalog and detail
 * 1 h), and each one is only as safe as the purge that backs it. That is not a
 * platitude — the two highest budgets here were each blocked on a specific
 * mechanism landing first: `static` on the deploy purge being reliably timed
 * (HOS-427 + HOS-428), `detail` on entity-tag purging actually working
 * (HOS-424). Raising a budget whose purge is broken does not trade freshness
 * for hit rate; it just serves wrong content for longer. No test here can catch
 * that, because the number IS the specification — the reasoning next to each
 * class is the only guard.
 *
 * SWR IS CAPPED AT ONE HOUR RATHER THAN SCALING WITH THE TTL. Its job is
 * absorbing a revalidation round-trip, not extending the staleness budget. At
 * the old 2× ratio a 24 h static page could be served 72 h after it was
 * generated, which would undercut the very deploy purge that makes a 24 h TTL
 * defensible in the first place.
 */

/**
 * How long the edge may serve a cached response, and how long it may keep
 * serving the stale copy while it revalidates behind the request.
 */
export interface CacheClassBudget {
    /** `s-maxage` in seconds. */
    readonly sMaxAge: number;
    /** `stale-while-revalidate` in seconds. */
    readonly swr: number;
}

/**
 * Every page class and its freshness budget.
 *
 * Adding a class here is a product decision about a NEW kind of page, not a way
 * to give one page its own number — that is what the per-class grouping exists
 * to prevent.
 */
export const CACHE_CLASS_BUDGETS = {
    /**
     * A full day, and the only class where the TTL is not the safety net.
     *
     * These pages render from `@repo/i18n` and page source, so nothing short of
     * a deploy changes them and a content write has nothing to purge. That makes
     * the DEPLOY PURGE their entire invalidation story — at 300 s a missed purge
     * self-corrected within minutes and nobody noticed; at 86 400 s it does not.
     * Which is why this value is only defensible alongside HOS-428: the purge
     * fires 45 s after the container's FIRST REQUEST, and until Coolify's
     * healthcheck sends that request immediately, nothing bounds how long a
     * quiet deploy waits (`purge-on-deploy.ts`, "WHAT THE DELAY DOES NOT
     * GUARANTEE").
     *
     * If the healthcheck is ever turned back off, this number has to come back
     * down with it. They are one decision, not two.
     */
    static: { sMaxAge: 86_400, swr: 3_600 },
    catalog: { sMaxAge: 3_600, swr: 3_600 },
    /**
     * Reaching 3 600 s took a fix, not just a decision. Until HOS-424 (PR #2746)
     * a content write purged the collection tag but NOT the entity tag, so an
     * edited detail page stayed stale for its whole TTL and raising that TTL
     * would only have multiplied the defect. Do not treat this value as
     * independent of that: if entity-tag purging regresses, this is the number
     * that turns the regression from a 5-minute annoyance into an hour of a
     * published edit not appearing.
     */
    detail: { sMaxAge: 3_600, swr: 3_600 },
    home: { sMaxAge: 3_600, swr: 3_600 },
    pricing: { sMaxAge: 3_600, swr: 3_600 }
} as const satisfies Record<string, CacheClassBudget>;

/** The class a cacheable page declares. */
export type CacheClass = keyof typeof CACHE_CLASS_BUDGETS;

/**
 * Build the `Cache-Control` value for a cacheable response of a given class.
 *
 * @param params.cacheClass - The page's class.
 * @returns The `public, s-maxage=…, stale-while-revalidate=…` header value.
 */
export function resolveCacheableControl({
    cacheClass
}: {
    readonly cacheClass: CacheClass;
}): string {
    const { sMaxAge, swr } = CACHE_CLASS_BUDGETS[cacheClass];
    return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}
