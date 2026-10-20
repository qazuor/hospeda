/**
 * HOS-1063 §7.2 / OQ-7 (2) — which statistics cards apply to a partner.
 *
 * This is the rule the whole panel hangs on, and the one most likely to be
 * "simplified" into a bug: both cards are derived from the RESULT of
 * `resolvePartnerLogoLink` — the function the home carousel calls — and never
 * from a commercial label. Deriving them independently would create a second source
 * of truth about what the home page renders.
 *
 * The last describe block is the proof that the derivation is real: it shows
 * that HOS-1159 (external logo links stop being clickable) changes the panel WITHOUT
 * touching the module under test, because the resolver's answer is what moves.
 */

import { describe, expect, it } from 'vitest';
import type { MyPartnerStats } from '../../src/lib/api/endpoints-protected';
import {
    resolvePartnerStatsCards,
    resolvePartnerStatsView
} from '../../src/lib/partner-stats-cards';

const statsFor = (partner: Partial<NonNullable<MyPartnerStats['partner']>>): MyPartnerStats => ({
    available: true,
    partner: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Aliado',
        ...partner
    },
    windowDays: 30,
    views: { unique: 5, total: 8 },
    clicks: { unique: 2, total: 3 }
});

describe('resolvePartnerStatsCards — the panel is invisible without a partner', () => {
    it('renders nothing when the fetch failed', () => {
        expect(resolvePartnerStatsCards({ stats: null, locale: 'es' })).toEqual({
            visible: false,
            showViews: false,
            showClicks: false
        });
    });

    it('renders nothing when the caller owns no partner', () => {
        expect(resolvePartnerStatsCards({ stats: { available: false }, locale: 'es' })).toEqual({
            visible: false,
            showViews: false,
            showClicks: false
        });
    });
});

describe('resolvePartnerStatsCards — public page stays dark until V7', () => {
    it('shows clicks only when the partner has a safe external site', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ slug: 'bodega', websiteUrl: 'https://bodega.test' }),
            locale: 'es'
        });

        expect(result).toEqual({ visible: true, showViews: false, showClicks: true });
    });

    it('hides both cards when there is no external site', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ slug: 'bodega', websiteUrl: undefined }),
            locale: 'es'
        });

        expect(result).toEqual({ visible: true, showViews: false, showClicks: false });
    });

    it('drops clicks when the resolver refuses an unsafe website', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ websiteUrl: 'javascript:alert(1)' }),
            locale: 'es'
        });

        expect(result.showClicks).toBe(false);
        expect(result.showViews).toBe(false);
    });

    it('is locale-independent while the internal destination is unavailable', () => {
        const stats = statsFor({ slug: 'bodega', websiteUrl: 'https://bodega.test' });
        expect(resolvePartnerStatsCards({ stats, locale: 'en' })).toEqual(
            resolvePartnerStatsCards({ stats, locale: 'pt' })
        );
    });
});

// ---------------------------------------------------------------------------
// resolvePartnerStatsView — both windows at once (§7.4)
// ---------------------------------------------------------------------------

/**
 * A payload for one window, with the totals spelled out per metric.
 *
 * The partner overrides are SPREAD rather than taken as destructured parameters
 * with defaults, and that is not a style choice: a destructuring default fires
 * on `undefined`, so `slug: undefined` would silently restore `'bodega'` and a
 * test meaning "this partner has no slug" would quietly assert the opposite.
 * Object spread overwrites with `undefined` as asked. (Caught by the last test
 * in this file failing while the production code was correct.)
 */
const windowedStats = ({
    partner,
    windowDays,
    viewsTotal,
    clicksTotal
}: {
    partner?: Partial<NonNullable<MyPartnerStats['partner']>>;
    windowDays: number;
    viewsTotal: number;
    clicksTotal: number;
}): MyPartnerStats => ({
    available: true,
    partner: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Aliado',
        slug: 'bodega',
        websiteUrl: 'https://bodega.test',
        ...partner
    },
    windowDays,
    views: { unique: viewsTotal, total: viewsTotal },
    clicks: { unique: clicksTotal, total: clicksTotal }
});

describe('resolvePartnerStatsView — the 7 ≤ 30 invariant', () => {
    /**
     * The single most likely bug once two figures share a card is the two being
     * wired to the wrong slots, and comparing rendered strings would not catch
     * it — both strings exist either way.
     *
     * Seven days are CONTAINED in thirty, so `last7 <= last30` holds for any
     * honest data. Feeding a realistic pair (7d = 9, 30d = 41) and asserting the
     * invariant catches a swap directly: swapped, 41 > 9 and the test is red.
     * `resolvePartnerStatsView` deliberately does not clamp, precisely so this
     * assertion has something real to fail on.
     */
    it('keeps the 7-day figure at or below the 30-day figure for both metrics', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: windowedStats({ windowDays: 7, viewsTotal: 9, clicksTotal: 3 }),
            locale: 'es'
        });

        expect(view.views.last7).not.toBeNull();
        expect(view.clicks.last7).not.toBeNull();
        expect(view.views.last7 as number).toBeLessThanOrEqual(view.views.last30);
        expect(view.clicks.last7 as number).toBeLessThanOrEqual(view.clicks.last30);
    });

    /**
     * The invariant alone would still pass if BOTH slots were fed the 7-day
     * payload (9 <= 9). This pins the exact values so that degenerate wiring is
     * red too.
     */
    it('puts each window in its own slot, per metric', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: windowedStats({ windowDays: 7, viewsTotal: 9, clicksTotal: 3 }),
            locale: 'es'
        });

        expect(view.views).toEqual({ last30: 41, last7: 9 });
        expect(view.clicks).toEqual({ last30: 12, last7: 3 });
    });

    /**
     * Views and clicks must not be crossed either — a second axis on which two
     * numbers in one panel can be swapped.
     */
    it('does not cross the views figure with the clicks figure', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: windowedStats({ windowDays: 7, viewsTotal: 9, clicksTotal: 3 }),
            locale: 'es'
        });

        expect(view.views.last30).not.toBe(view.clicks.last30);
        expect(view.views.last30).toBe(41);
        expect(view.clicks.last30).toBe(12);
    });
});

describe('resolvePartnerStatsView — degradation is asymmetric on purpose', () => {
    it('keeps the panel and the headline figure when only the 7-day read fails', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: null,
            locale: 'es'
        });

        expect(view.visible).toBe(true);
        expect(view.views.last30).toBe(41);
        // null, NOT 0 — the component omits the line rather than printing a
        // number the server never reported.
        expect(view.views.last7).toBeNull();
        expect(view.clicks.last7).toBeNull();
    });

    /**
     * `available: false` is the authority, and the figures beside it are not.
     *
     * The payload here — `available: false` CARRYING numbers — is one the API
     * does not produce today, and that is exactly why the assertion is written
     * this way. An earlier version of this test passed `{ available: false }`
     * with no figures, and was VACUOUS: the `?? null` fallback answered null on
     * its own, so deleting the `available` check entirely left it green. The
     * figures have to be present for the check to have anything to refuse.
     *
     * The shape is reachable: `MyPartnerStats` marks `views`/`clicks` optional
     * and `available` a plain boolean, so a server-side change that started
     * echoing zeros alongside `available: false` would compile. Rendering "0 in
     * the last 7 days" from it is the same class of lie as printing a zero where
     * a metric does not apply.
     */
    it('ignores figures attached to an unavailable 7-day payload, rather than printing them', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: {
                available: false,
                views: { unique: 99, total: 99 },
                clicks: { unique: 77, total: 77 }
            },
            locale: 'es'
        });

        expect(view.views.last7).toBeNull();
        expect(view.clicks.last7).toBeNull();
        // The 30-day figures are untouched by the secondary read's state.
        expect(view.views.last30).toBe(41);
        expect(view.clicks.last30).toBe(12);
    });

    it('reports the 7-day figures as absent when that read failed outright', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({ windowDays: 30, viewsTotal: 41, clicksTotal: 12 }),
            stats7: null,
            locale: 'es'
        });

        expect(view.views.last7).toBeNull();
        expect(view.clicks.last7).toBeNull();
    });

    it('hides the whole panel when the 30-day read fails, whatever the 7-day read says', () => {
        const view = resolvePartnerStatsView({
            stats30: null,
            stats7: windowedStats({ windowDays: 7, viewsTotal: 9, clicksTotal: 3 }),
            locale: 'es'
        });

        expect(view.visible).toBe(false);
        expect(view.showViews).toBe(false);
        expect(view.showClicks).toBe(false);
    });
});

describe('resolvePartnerStatsView — gating is unchanged by the second window', () => {
    /**
     * G-3 across both windows: a partner whose public page is unavailable must not get
     * a views card, and therefore must not get EITHER figure. The numbers still
     * travel in the view model — suppressing them here would move the decision
     * away from `resolvePartnerLogoLink` — and it is `showViews` that the
     * component honours.
     */
    it('withholds the views card even though both figures exist', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({
                windowDays: 30,
                viewsTotal: 41,
                clicksTotal: 12
            }),
            stats7: windowedStats({
                windowDays: 7,
                viewsTotal: 9,
                clicksTotal: 3
            }),
            locale: 'es'
        });

        expect(view.showViews).toBe(false);
        expect(view.showClicks).toBe(true);
        // The figures still travel — suppressing them here would move the
        // "does this surface exist?" decision away from resolvePartnerLogoLink.
        // It is `showViews` the component honours.
        expect(view.views.last30).toBe(41);
    });

    it('withholds both cards when the logo links nowhere', () => {
        const noSurface = { slug: undefined, websiteUrl: undefined };
        const view = resolvePartnerStatsView({
            stats30: windowedStats({
                partner: noSurface,
                windowDays: 30,
                viewsTotal: 41,
                clicksTotal: 12
            }),
            stats7: windowedStats({
                partner: noSurface,
                windowDays: 7,
                viewsTotal: 9,
                clicksTotal: 3
            }),
            locale: 'es'
        });

        expect(view.visible).toBe(true);
        expect(view.showViews).toBe(false);
        expect(view.showClicks).toBe(false);
    });
});
