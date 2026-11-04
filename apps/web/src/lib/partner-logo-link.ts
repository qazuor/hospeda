/**
 * @file partner-logo-link.ts
 * @description Resolves a partner logo destination from its public-page entitlement.
 */

import type { PartnerData } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { buildUrl } from '@/lib/urls';

const EXTERNAL_REL = 'sponsored nofollow noopener';

/** How a logo should be wrapped. `href === undefined` means: do not wrap it. */
export interface PartnerLogoLink {
    /** Target URL, or `undefined` when the logo must render unlinked. */
    readonly href?: string;
    /** `rel` attribute — set only for outbound links. */
    readonly rel?: string;
    /** `target` attribute — set only for outbound links. */
    readonly target?: string;
    /** Destination recorded by the logo-click endpoint. */
    readonly destination?: PartnerLogoDestination;
}

/** Destination recorded by the logo-click endpoint. */
export type PartnerLogoDestination = 'OWN_PAGE' | 'EXTERNAL';

/**
 * Resolve a partner logo link, failing closed when an internal slug or safe external URL is absent.
 * A page link is same-site and therefore has no `rel` or `target` attributes.
 *
 * @param partner - The carousel item.
 * @param locale - Active locale, used for an internal page URL.
 * @returns The href and attributes to render, if any.
 */
export function resolvePartnerLogoLink({
    partner,
    locale
}: {
    readonly partner: PartnerData;
    readonly locale: SupportedLocale;
}): PartnerLogoLink {
    if (partner.hasPublicPage === true && partner.slug) {
        return {
            href: buildUrl({ locale, path: `partners/${partner.slug}` }),
            destination: 'OWN_PAGE'
        };
    }

    const websiteHref = resolveSafeExternalUrl(partner.url);
    if (!websiteHref) return {};

    return {
        href: websiteHref,
        rel: EXTERNAL_REL,
        target: '_blank',
        destination: 'EXTERNAL'
    };
}
