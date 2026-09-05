/**
 * HOS-1063 §7.2 / OQ-7 (2) — which statistics cards apply to a partner.
 *
 * This is the rule the whole panel hangs on, and the one most likely to be
 * "simplified" into a bug: both cards are derived from the RESULT of
 * `resolvePartnerLogoLink` — the function the home carousel calls — and never
 * from a `tier` label. Deriving them independently would create a second source
 * of truth about what the home page renders.
 *
 * The last describe block is the proof that the derivation is real: it shows
 * that HOS-1159 (silver logos stop being clickable) changes the panel WITHOUT
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

describe('resolvePartnerStatsCards — a GOLD partner with a page', () => {
    it('shows BOTH cards', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ tier: 'gold', slug: 'bodega', websiteUrl: 'https://bodega.test' }),
            locale: 'es'
        });

        expect(result).toEqual({ visible: true, showViews: true, showClicks: true });
    });

    /**
     * `resolvePartnerLogoLink` fails closed on a gold partner with no slug — it
     * would otherwise link to `/partners//`. The panel must fail closed the same
     * way, and this is the case that proves the gate is not just `tier`.
     */
    it('hides the views card for a GOLD partner with no slug, exactly as the carousel drops the link', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ tier: 'gold', slug: undefined, websiteUrl: undefined }),
            locale: 'es'
        });

        expect(result.visible).toBe(true);
        expect(result.showViews).toBe(false);
        expect(result.showClicks).toBe(false);
    });
});

describe('resolvePartnerStatsCards — a SILVER partner (G-3)', () => {
    /**
     * The G-3 case. A silver partner has no page, so their view count is not
     * LOW, it is UNDEFINED — and a rendered `0` would read as "nobody came to
     * see you". The card must be suppressed, and the component's negative branch
     * carries no numeral (asserted separately by the section guard).
     */
    it('hides the views card — the metric does not exist, it is not zero', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ tier: 'silver', slug: 'plata', websiteUrl: 'https://plata.test' }),
            locale: 'es'
        });

        expect(result.showViews).toBe(false);
    });

    /**
     * The mirror-image error. TODAY the code links a silver logo to the
     * partner's own site whenever they filled one in (spec §5.3), so those
     * clicks are real and hiding them would be as wrong as inventing a zero.
     */
    it('SHOWS the clicks card while a silver logo still links out', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ tier: 'silver', slug: 'plata', websiteUrl: 'https://plata.test' }),
            locale: 'es'
        });

        expect(result.showClicks).toBe(true);
    });

    it('hides the clicks card for a silver partner with no website — the day-one state', () => {
        const result = resolvePartnerStatsCards({
            stats: statsFor({ tier: 'silver', slug: 'plata', websiteUrl: undefined }),
            locale: 'es'
        });

        expect(result.showClicks).toBe(false);
        expect(result.showViews).toBe(false);
    });
});

describe('resolvePartnerStatsCards — the derivation survives HOS-1159 without an edit here', () => {
    /**
     * `resolvePartnerLogoLink` refuses a website whose scheme is not http(s)
     * (HOS-592). That refusal is the same mechanism HOS-1159 will use to stop
     * linking silver logos, so this case demonstrates the property that matters:
     * when the RESOLVER stops returning a link, the clicks card stops rendering,
     * with no change to `partner-stats-cards.ts`.
     *
     * A `tier === 'gold'` gate would keep answering the old question and would
     * have to be found and edited by hand.
     */
    it('drops the clicks card when the resolver refuses the website, without any tier logic', () => {
        const result = resolvePartnerStatsCards({
            // eslint-disable-next-line no-script-url
            stats: statsFor({ tier: 'silver', websiteUrl: 'javascript:alert(1)' }),
            locale: 'es'
        });

        expect(result.showClicks).toBe(false);
    });

    it('is locale-independent — the locale only shapes the internal href', () => {
        const stats = statsFor({ tier: 'gold', slug: 'bodega' });
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
        tier: 'gold',
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
     * G-3 across both windows: a partner with no page of their own must not get
     * a views card, and therefore must not get EITHER figure. The numbers still
     * travel in the view model — suppressing them here would move the decision
     * away from `resolvePartnerLogoLink` — and it is `showViews` that the
     * component honours.
     */
    it('withholds the views card for a silver partner even though both figures exist', () => {
        const view = resolvePartnerStatsView({
            stats30: windowedStats({
                partner: { tier: 'silver' },
                windowDays: 30,
                viewsTotal: 41,
                clicksTotal: 12
            }),
            stats7: windowedStats({
                partner: { tier: 'silver' },
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
        const noSurface = { tier: 'silver', slug: undefined, websiteUrl: undefined };
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
