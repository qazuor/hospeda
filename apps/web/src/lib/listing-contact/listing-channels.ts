/**
 * @file listing-channels.ts
 * @description Pure builders for the channel-only contact surfaces of the
 * experience and venue detail pages (HOS-2532, spec §7.8).
 *
 * Experiences and venues have no inquiry form and no WhatsApp channel
 * (HOS-363, HOS-1076): their dock bar and panel only list the channels the
 * listing actually publishes. Every href is derived here, on the server, from
 * the public payload, so the pages stay session-blind and the island receives
 * ready-to-render, already-sanitized links.
 *
 * The decision of "is there anything to contact" reuses the page-level
 * predicates (`hasPublicContactChannel`, `hasVenuePublicContact`'s inputs) so
 * the bar, the in-page contact block and the events CTA cannot disagree.
 */

import type { ExperienceContactInfo, VenueSocialNetworks } from '@/data/types';
import { resolveExperiencePriceDisplay } from '@/lib/experience/price-display';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import type { ListingContactPrice } from './listing-contact-price';

/** Channel kinds a channel-only panel can render. Mirrors the analytics vocabulary. */
export type ListingChannelKind = 'phone' | 'email' | 'website' | 'social';

/** One tappable channel, with an href that already survived the scheme allow-list. */
export interface ListingChannel {
    readonly kind: ListingChannelKind;
    readonly href: string;
    /** The visible value (number, address, host, or network name). */
    readonly text: string;
    /** Brand key for social channels, used to pick the icon. */
    readonly network?: keyof VenueSocialNetworks;
    /** Whether the link leaves the site and must open in a new tab. */
    readonly external: boolean;
}

const clean = (value: string | null | undefined): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toTelHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * Builds the experience channels in display order: mobile phone, landline,
 * email, website. A value that is empty, whitespace, or an unsafe URL is
 * dropped, never rendered raw.
 */
export function buildExperienceChannels({
    contactInfo
}: {
    readonly contactInfo: ExperienceContactInfo | null;
}): readonly ListingChannel[] {
    if (!contactInfo) return [];
    const channels: ListingChannel[] = [];
    const seenPhoneHrefs = new Set<string>();
    for (const phone of [clean(contactInfo.mobilePhone), clean(contactInfo.workPhone)]) {
        if (!phone) continue;
        const href = toTelHref(phone);
        // The same number entered twice (or spelled differently) is one row, not two.
        if (seenPhoneHrefs.has(href)) continue;
        seenPhoneHrefs.add(href);
        channels.push({ kind: 'phone', href, text: phone, external: false });
    }
    const email = clean(contactInfo.workEmail);
    if (email) {
        channels.push({ kind: 'email', href: `mailto:${email}`, text: email, external: false });
    }
    const website = resolveSafeExternalUrl(contactInfo.website ?? undefined);
    if (website) {
        channels.push({
            kind: 'website',
            href: website,
            text: website.replace(/^https?:\/\//, ''),
            external: true
        });
    }
    return channels;
}

/** Social networks in the order the venue contact block lists them. */
const SOCIAL_NETWORKS: readonly {
    readonly key: keyof VenueSocialNetworks;
    readonly name: string;
}[] = [
    { key: 'instagram', name: 'Instagram' },
    { key: 'facebook', name: 'Facebook' },
    { key: 'twitter', name: 'Twitter / X' },
    { key: 'youtube', name: 'YouTube' },
    { key: 'tiktok', name: 'TikTok' },
    { key: 'website', name: 'Web' }
];

/**
 * Builds the venue's social channels. Spec §7.8 scopes the venue panel to the
 * social links, so the venue's phone and email stay in its in-page contact block.
 */
export function buildVenueChannels({
    socialNetworks
}: {
    readonly socialNetworks: VenueSocialNetworks | null | undefined;
}): readonly ListingChannel[] {
    if (!socialNetworks) return [];
    const channels: ListingChannel[] = [];
    for (const { key, name } of SOCIAL_NETWORKS) {
        const href = resolveSafeExternalUrl(socialNetworks[key]);
        if (href) {
            channels.push({ kind: 'social', href, text: name, network: key, external: true });
        }
    }
    return channels;
}

/** The venue's dock bar decision: a menu link wins; otherwise a panel with the socials. */
export type VenueContactMode =
    | { readonly kind: 'menu'; readonly href: string }
    | { readonly kind: 'panel' }
    | { readonly kind: 'none' };

/**
 * Decides what the venue bar's primary button does.
 *
 * @returns `menu` when the owner published a safe `menuUrl`, `panel` when only
 * social links and/or the WhatsApp button exist, `none` when the bar must not render at all.
 */
export function resolveVenueContactMode({
    menuUrl,
    channels,
    hasWhatsapp = false
}: {
    readonly menuUrl: string | null | undefined;
    readonly channels: readonly ListingChannel[];
    /** Whether the HOS-2256 gate shows the venue WhatsApp button (`venue.whatsapp` is set). */
    readonly hasWhatsapp?: boolean;
}): VenueContactMode {
    const href = resolveSafeExternalUrl(menuUrl);
    if (href) return { kind: 'menu', href };
    return channels.length > 0 || hasWhatsapp ? { kind: 'panel' } : { kind: 'none' };
}

const EXPERIENCE_UNIT_KEYS: Readonly<Record<string, string>> = {
    per_day: 'accommodations.detail.listingContact.units.perDay',
    per_hour: 'accommodations.detail.listingContact.units.perHour',
    per_person: 'accommodations.detail.listingContact.units.perPerson',
    per_group: 'accommodations.detail.listingContact.units.perGroup'
};

/**
 * Maps an experience's stored price (centavos) to the shared bar price shape
 * (major units). «Consultar precio» comes back as `onRequest` for the flag, a
 * missing price, or a legacy `0`, never as "$0".
 */
export function buildExperienceContactPrice({
    priceFrom,
    priceUnit,
    isPriceOnRequest
}: {
    readonly priceFrom: number | null;
    readonly priceUnit: string | null;
    readonly isPriceOnRequest: boolean;
}): NonNullable<ListingContactPrice> {
    const display = resolveExperiencePriceDisplay({ priceFrom, isPriceOnRequest });
    if (display.kind === 'on-request') {
        return { amount: null, currency: null, unitLabelKey: null, onRequest: true };
    }
    return {
        amount: display.cents / 100,
        currency: 'ARS',
        unitLabelKey: (priceUnit && EXPERIENCE_UNIT_KEYS[priceUnit]) || null,
        onRequest: false
    };
}
