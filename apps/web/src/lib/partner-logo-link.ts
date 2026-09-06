/**
 * @file partner-logo-link.ts
 * @description Decides where a partner logo in the home carousel points
 * (HOS-294 D-1). Extracted from `PartnersSection.astro` because this single
 * branch IS the difference between the two paid partner plans, and because the
 * marquee renders its track TWICE (a visible one and an `aria-hidden` duplicate
 * for the seamless loop) — sharing one resolver is what stops the two halves
 * from drifting into different links.
 */

import type { PartnerData } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { buildUrl } from '@/lib/urls';

/** The tier that owns a page at `/partners/<slug>/`. */
const GOLD_TIER = 'gold';

/**
 * `rel` for an outbound partner link.
 *
 * - `sponsored` — this link exists because of a commercial relationship, which
 *   is exactly what Google asks to be declared.
 * - `nofollow` — belt and braces alongside `sponsored`, so no ranking signal
 *   flows out. Together they make the outbound link cost nothing in SEO terms,
 *   which is what made linking silver logos outward acceptable at all.
 * - `noopener` — the standard safety for a `_blank` target.
 */
const EXTERNAL_REL = 'sponsored nofollow noopener';

/** How a logo should be wrapped. `href === undefined` means: do not wrap it. */
export interface PartnerLogoLink {
    /** Target URL, or `undefined` when the logo must render unlinked. */
    readonly href?: string;
    /** `rel` attribute — set only for outbound links. */
    readonly rel?: string;
    /** `target` attribute — set only for outbound links. */
    readonly target?: string;
    /**
     * WHICH branch produced the link, or `undefined` when there is none
     * (HOS-1063).
     *
     * Returned rather than re-derived by callers, because three separate places
     * need to know and each one deriving it independently is three chances to
     * disagree with what the carousel actually renders:
     *
     *  1. the carousel tags its anchors with it, so the click beacon can report
     *     the right `destination` without re-resolving anything;
     *  2. the partner's statistics panel renders the CLICKS card only when a
     *     link exists at all, and the VIEWS card only when that link is
     *     `OWN_PAGE`;
     *  3. that same panel therefore cannot contradict the home page, whichever
     *     way HOS-1159 resolves silver's clickability.
     *
     * Point 2 is the load-bearing one. The alternative — the panel testing
     * `tier === 'gold' && slug` for itself — is a SECOND source of truth about
     * what this function decides, and it drifts the moment this function does.
     */
    readonly destination?: PartnerLogoDestination;
}

/**
 * The two destinations a clickable partner logo can lead to.
 *
 * Mirrors `PartnerLogoClickDestinationEnum` in `@repo/schemas`, which is what
 * the capture endpoint validates against. Declared here as a plain union rather
 * than imported so this module stays free of a runtime dependency: it is
 * imported by an inline `<script>` path on the home page, whose JS budget is the
 * subject of HOS-160 and HOS-168.
 */
export type PartnerLogoDestination = 'OWN_PAGE' | 'EXTERNAL';

/**
 * Resolves the link for one partner logo.
 *
 * - **gold** with a slug -> its own page, as a plain internal link. No `rel`,
 *   no `target`: adding either would tell search engines not to follow a link
 *   to our own page, and would eject the visitor into a new tab to reach a page
 *   on this same site.
 * - **anything else** with a website whose scheme survives
 *   {@link resolveSafeExternalUrl} -> that website, `sponsored nofollow
 *   noopener` in a new tab.
 * - **neither** -> no link. The carousel renders the logo in a plain element,
 *   which is what it already did for partners with no website. This is the
 *   common case for a freshly provisioned partner, whose `websiteUrl` starts
 *   null (spec R-1), so it is a normal state and not an error.
 *
 * Fails closed on three sides: a gold partner missing its slug gets NO link
 * rather than a link to `/partners//`, an unrecognised tier is treated as
 * non-gold rather than as gold, and a website whose scheme is not http(s) gets
 * NO link rather than an `href` the browser would execute.
 *
 * That last one is not theoretical (HOS-592 / F-02): `websiteUrl` is written by
 * the partner through `PATCH /api/v1/protected/partners/mine` — session only,
 * no partner permission — validated with `z.string().url()`, which accepts
 * `javascript:`. The admin content review that follows never re-checks the
 * scheme. Since the carousel renders its track twice, an unsafe value would
 * have shipped the same executable link twice on the home page.
 *
 * @param partner - The carousel item.
 * @param locale - Active locale, for the internal href.
 * @returns The href and attributes to render, if any.
 */
export function resolvePartnerLogoLink({
    partner,
    locale
}: {
    readonly partner: PartnerData;
    readonly locale: SupportedLocale;
}): PartnerLogoLink {
    if (partner.tier === GOLD_TIER && partner.slug) {
        return {
            href: buildUrl({ locale, path: `partners/${partner.slug}` }),
            destination: 'OWN_PAGE'
        };
    }

    const websiteHref = resolveSafeExternalUrl(partner.url);
    if (websiteHref) {
        return {
            href: websiteHref,
            rel: EXTERNAL_REL,
            target: '_blank',
            destination: 'EXTERNAL'
        };
    }

    return {};
}
