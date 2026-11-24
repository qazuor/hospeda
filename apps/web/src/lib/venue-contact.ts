/**
 * @file venue-contact.ts
 * @description Single source of truth for whether a venue's public page has
 * anything to show in its contact block (HOS-2042).
 *
 * The venue contact block (`ListingContactBlock.astro`) renders the narrowed
 * business channels of `contactInfo` (mobile phone, optional landline, email,
 * site), the social profiles and the menu link. The "accepts events" CTA is an
 * in-page anchor INTO that block, so the block's render decision, the page's
 * section gate and the CTA's link decision must be ONE answer: a CTA that
 * anchors an empty block is worse than no CTA.
 *
 * Mirrors `experience-contact.ts`.
 */

import type { VenueContactInfo, VenueSocialNetworks } from '@/data/types';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

/** DOM id of the venue contact block, the target of the events CTA anchor. */
export const VENUE_CONTACT_ANCHOR_ID = 'venue-contact';

/** `true` when `value` is a non-empty string once trimmed. */
function usable(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Whether the venue publishes at least one business channel through
 * `contactInfo` (phone, landline, email or a safe website URL).
 *
 * @param params.contactInfo - The narrowed public contact object, or `null`.
 */
export function hasVenueContactInfoChannel({
    contactInfo
}: {
    readonly contactInfo?: VenueContactInfo | null;
}): boolean {
    if (!contactInfo) return false;
    return (
        usable(contactInfo.mobilePhone) ||
        usable(contactInfo.workPhone) ||
        usable(contactInfo.workEmail) ||
        resolveSafeExternalUrl(contactInfo.website) !== undefined
    );
}

/**
 * Whether the venue `ListingContactBlock` will render anything at all.
 *
 * @param params.contactInfo - The narrowed public contact object, or `null`.
 * @param params.socialNetworks - The venue's social profiles, or `null`.
 * @param params.menuUrl - The owner's external menu URL, if any.
 */
export function hasVenuePublicContact({
    contactInfo,
    socialNetworks,
    menuUrl
}: {
    readonly contactInfo?: VenueContactInfo | null;
    readonly socialNetworks?: VenueSocialNetworks | null;
    readonly menuUrl?: string | null;
}): boolean {
    const hasSocial = socialNetworks
        ? Object.values(socialNetworks).some((value) => Boolean(resolveSafeExternalUrl(value)))
        : false;
    return (
        hasVenueContactInfoChannel({ contactInfo }) ||
        hasSocial ||
        Boolean(resolveSafeExternalUrl(menuUrl))
    );
}
