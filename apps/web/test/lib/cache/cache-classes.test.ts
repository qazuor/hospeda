/**
 * @file cache-classes.test.ts
 * @description The per-page-class freshness budgets, pinned as literals (HOS-426).
 *
 * WHY PIN NUMBERS A FUTURE CHANGE IS EXPECTED TO EDIT. Because that is the
 * point. These values decide how long the edge serves stale HTML for the whole
 * public site, and the change that raises them (owner decision D-15: statics to
 * 24 h, catalog and detail to 1 h) should show up as an explicit, reviewable
 * diff in a test — not slip through as a one-character edit nobody has to
 * acknowledge. A test that recomputed the expectation from
 * `CACHE_CLASS_BUDGETS` would pass no matter what those budgets said, which is
 * the same as not testing them.
 *
 * Every literal below is deliberately today's shipped behaviour: this file and
 * the mechanism it covers changed no response.
 */

import { describe, expect, it } from 'vitest';
import {
    CACHE_CLASS_BUDGETS,
    type CacheClass,
    resolveCacheableControl
} from '@/lib/cache/cache-classes';

/**
 * The header each class must produce, written out in full.
 *
 * Adding a class to the vocabulary without adding it here fails the closure
 * test below, so a new page kind cannot acquire a freshness budget silently.
 */
const EXPECTED_CONTROL: Readonly<Record<CacheClass, string>> = {
    static: 'public, s-maxage=300, stale-while-revalidate=600',
    catalog: 'public, s-maxage=300, stale-while-revalidate=600',
    detail: 'public, s-maxage=300, stale-while-revalidate=600',
    home: 'public, s-maxage=300, stale-while-revalidate=600',
    // The outlier, preserved rather than reconciled: the four `suscriptores/*`
    // pages were written with a 60 s SWR before they shared this vocabulary,
    // and folding them in must not change a TTL on the way past.
    pricing: 'public, s-maxage=300, stale-while-revalidate=60'
};

describe('resolveCacheableControl', () => {
    it.each(Object.entries(EXPECTED_CONTROL))('the "%s" class emits %s', (cacheClass, expected) => {
        expect(resolveCacheableControl({ cacheClass: cacheClass as CacheClass })).toBe(expected);
    });

    it('covers every class in the vocabulary', () => {
        // Closure: without this, adding a sixth class ships an untested budget
        // and every assertion above still passes.
        expect(Object.keys(CACHE_CLASS_BUDGETS).sort()).toEqual(
            Object.keys(EXPECTED_CONTROL).sort()
        );
    });

    it('never emits a budget of zero, which would disable edge caching outright', () => {
        for (const [cacheClass, budget] of Object.entries(CACHE_CLASS_BUDGETS)) {
            expect(budget.sMaxAge, `${cacheClass} s-maxage`).toBeGreaterThan(0);
            expect(budget.swr, `${cacheClass} stale-while-revalidate`).toBeGreaterThan(0);
        }
    });
});
