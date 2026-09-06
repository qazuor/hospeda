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

/**
 * One metric across both windows §7.4 asks for.
 *
 * `last7` is nullable and `last30` is not, and the asymmetry is deliberate: the
 * 30-day read is what decides whether the panel renders at all, so it is present
 * by construction wherever this shape exists. The 7-day read is an addition that
 * degrades on its own — see {@link resolvePartnerStatsView}.
 */
export interface PartnerStatsMetric {
    /** Deduplicated total over the last 30 days. The headline figure. */
    readonly last30: number;
    /** Deduplicated total over the last 7 days, or null when that read failed. */
    readonly last7: number | null;
}

/** Everything the panel needs: which cards apply, and both figures for each. */
export interface PartnerStatsView extends PartnerStatsCardVisibility {
    /** Page views of the partner's own page. */
    readonly views: PartnerStatsMetric;
    /** Clicks on the partner's carousel logo. */
    readonly clicks: PartnerStatsMetric;
}

/**
 * Builds the panel's whole view model from the two windowed reads (§7.4).
 *
 * ## Why both figures rather than a selector
 *
 * §7.4 asks for 7d and 30d. A selector would be the obvious shape and would put
 * JavaScript on a section that currently ships none — and an interaction to
 * maintain, on a read-only panel. Rendering both at once satisfies the same
 * requirement with markup, so the section stays at zero bytes of JS.
 *
 * ## Why 30 days is the primary figure
 *
 * It is the one the partner actually looks at, and the one the commercial page's
 * promise is scaled to. The 7-day number is context beside it, not a peer — the
 * component gives it correspondingly less visual weight.
 *
 * ## Why `last7` is nullable and `last30` is not
 *
 * Two calls to the same endpoint in the same parallel batch can, in principle,
 * fail independently. Losing the entire panel because the SECONDARY read
 * hiccuped is a worse outcome than showing the headline figure alone, so the
 * 7-day line is what degrades. The 30-day read is load-bearing: without it there
 * is no partner to resolve and no card to gate, so its absence hides the panel.
 *
 * ## What this function deliberately does NOT do: clamp
 *
 * `last7` cannot legitimately exceed `last30` — seven days are contained in
 * thirty — but this function does not enforce that, and must not start to.
 * Clamping would make the invariant true by construction and would therefore
 * make the test that asserts it VACUOUS: the single most likely bug here is the
 * two figures being wired to the wrong slots, and a clamp is exactly what would
 * hide it. The invariant is asserted over real inputs in the test suite instead,
 * where a swap turns it red.
 *
 * @param stats30 - The 30-day payload. Decides visibility, gating and identity.
 * @param stats7 - The 7-day payload, or null when that read failed.
 * @param locale - Active locale, forwarded to `resolvePartnerLogoLink`.
 * @returns The panel's view model.
 */
export function resolvePartnerStatsView({
    stats30,
    stats7,
    locale
}: {
    readonly stats30: MyPartnerStats | null;
    readonly stats7: MyPartnerStats | null;
    readonly locale: SupportedLocale;
}): PartnerStatsView {
    const cards = resolvePartnerStatsCards({ stats: stats30, locale });

    /**
     * The 7-day figure is taken only from a payload that is itself available.
     * An `{ available: false }` response carries no `views`/`clicks` at all, and
     * reading `0` out of it would print a number the server never reported.
     */
    const seven = stats7?.available ? stats7 : null;

    return {
        ...cards,
        views: {
            last30: stats30?.views?.total ?? 0,
            last7: seven?.views?.total ?? null
        },
        clicks: {
            last30: stats30?.clicks?.total ?? 0,
            last7: seven?.clicks?.total ?? null
        }
    };
}
