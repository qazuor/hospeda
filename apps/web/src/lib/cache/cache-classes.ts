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
 * THE NUMBERS BELOW ARE DELIBERATELY ALL EQUAL RIGHT NOW. This file introduces
 * the mechanism at exactly today's behaviour, so the 40-call-site change that
 * comes with it cannot alter a single response. Raising them per owner decision
 * D-15 (statics 24 h, catalog and detail 1 h) is a separate change to this one
 * file — which is the entire point of having it.
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
    static: { sMaxAge: 300, swr: 600 },
    catalog: { sMaxAge: 300, swr: 600 },
    /**
     * Do NOT raise this ahead of HOS-424. A content write purges the collection
     * tag but not the entity tag, so an edited detail page is already stale for
     * its full TTL; a longer TTL multiplies a live defect rather than trading
     * freshness for hit rate.
     */
    detail: { sMaxAge: 300, swr: 600 },
    home: { sMaxAge: 300, swr: 600 },
    /**
     * The odd one out at 60 s of SWR rather than 600 s. That is not a decision,
     * it is the value the four `suscriptores/*` pages were independently written
     * with before they shared this vocabulary, preserved here so folding them in
     * changes no TTL. Reconcile it when the classes are re-tuned, not silently
     * on the way past.
     */
    pricing: { sMaxAge: 300, swr: 60 }
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
