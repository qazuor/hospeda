/**
 * @file partner-logo-link.ts
 * @description Resolves the external link for a partner logo. V7 restores the
 * internal page destination on the public key.
 */

import type { PartnerData } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

const EXTERNAL_REL = 'sponsored nofollow noopener';

/** How a logo should be wrapped. `href === undefined` means: do not wrap it. */
export interface PartnerLogoLink {
    /** Target URL, or `undefined` when the logo must render unlinked. */
    readonly href?: string;
    /** `rel` attribute — set only for outbound links. */
    readonly rel?: string;
    /** `target` attribute — set only for outbound links. */
    readonly target?: string;
    /** Outbound destination; the internal destination returns with V7. */
    readonly destination?: PartnerLogoDestination;
}

/** Destination recorded by the logo-click endpoint. */
export type PartnerLogoDestination = 'OWN_PAGE' | 'EXTERNAL';

/**
 * Resolves the external partner site link, if it has a safe HTTP(S) URL.
 * V7 restores the internal page destination on the partner's public key.
 *
 * @param partner - The carousel item.
 * @param locale - Active locale, reserved for the V7 internal destination.
 * @returns The outbound href and attributes, or an empty object.
 */
export function resolvePartnerLogoLink({
    partner,
    locale: _locale
}: {
    readonly partner: PartnerData;
    readonly locale: SupportedLocale;
}): PartnerLogoLink {
    void _locale;
    const websiteHref = resolveSafeExternalUrl(partner.url);
    if (!websiteHref) return {};

    return {
        href: websiteHref,
        rel: EXTERNAL_REL,
        target: '_blank',
        destination: 'EXTERNAL'
    };
}
