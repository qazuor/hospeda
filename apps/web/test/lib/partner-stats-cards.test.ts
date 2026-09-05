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
import { resolvePartnerStatsCards } from '../../src/lib/partner-stats-cards';

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
