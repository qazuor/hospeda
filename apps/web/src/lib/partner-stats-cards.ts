/**
 * @file partner-stats-cards.ts
 * @description Decides which cards the partner statistics panel renders
 * (HOS-1063 A-5, §7.2, OQ-7 (2)).
 *
 * Extracted from `PartnerStatsSection.astro` rather than written inline, for a
 * reason that is about testability and not tidiness: a test over the SOURCE of
 * an `.astro` file cannot tell what is DECLARED from what is RENDERED, so the
 * one rule in this feature that must not silently invert would have had no
 * honest test. Here it is a pure function with real inputs and real outputs, and
 * a mutation to it turns a test red.
 *
 * ## The rule, and why it is derived rather than decided
 *
 * Both cards are gated by the RESULT of `resolvePartnerLogoLink` — the very
 * function the home carousel calls, on the same inputs — and never by the
 * partner's tier:
 *
 *  - **views**: the resolver returned an `OWN_PAGE` link, i.e. the partner has a
 *    page at `/partners/<slug>/` for anyone to visit;
 *  - **clicks**: the resolver returned ANY link, because a logo that links
 *    nowhere cannot be clicked.
 *
 * A `tier === 'gold'` test would be a SECOND source of truth about what the home
 * page renders. The two would agree today and part ways the moment HOS-1159
 * makes a silver logo stop being clickable — at which point this file needs no
 * change at all, because the resolver's answer changes and these follow.
 *
 * ## The absent-vs-zero rule
 *
 * A card whose metric does not apply is ABSENT (or replaced by an explanatory
 * line), never rendered as `0`. "0 visitas" reads as *nobody came to see you*;
 * the true statement is *this metric does not exist at your level* (G-3, AC-9).
 * This module returns the booleans; the component is what must honour them by
 * emitting no numeral in the negative branch.
 */

import type { MyPartnerStats } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { resolvePartnerLogoLink } from '@/lib/partner-logo-link';

/** Which cards the panel should render for one partner. */
export interface PartnerStatsCardVisibility {
    /** Whether the panel renders at all. False for a caller who owns no partner. */
    readonly visible: boolean;
    /** Whether to render the page-views card with a number in it. */
    readonly showViews: boolean;
    /** Whether to render the logo-clicks card with a number in it. */
    readonly showClicks: boolean;
}

/**
 * Resolves which statistics cards apply to the caller's partner.
 *
 * @param stats - The payload from `GET /protected/partners/mine/stats`, or null
 *   when the fetch failed (the panel then renders nothing, like every other
 *   fail-soft section on that page).
 * @param locale - Active locale, needed only because `resolvePartnerLogoLink`
 *   builds a localised internal href. It never affects the outcome.
 * @returns Which cards to render.
 */
export function resolvePartnerStatsCards({
    stats,
    locale
}: {
    readonly stats: MyPartnerStats | null;
    readonly locale: SupportedLocale;
}): PartnerStatsCardVisibility {
    if (!stats?.available || !stats.partner) {
        return { visible: false, showViews: false, showClicks: false };
    }

    const link = resolvePartnerLogoLink({
        partner: {
            id: stats.partner.id,
            name: stats.partner.name,
            // `logoPath` and `aspectRatio` are required by `PartnerData` and
            // ignored by the resolver. Filled with inert values rather than
            // widening the resolver's parameter type, because the whole point of
            // this module is that it changes NOTHING about the function the
            // carousel depends on.
            logoPath: '',
            url: stats.partner.websiteUrl,
            slug: stats.partner.slug,
            tier: stats.partner.tier,
            aspectRatio: 1
        },
        locale
    });

    return {
        visible: true,
        showViews: link.destination === 'OWN_PAGE',
        showClicks: link.href !== undefined
    };
}
