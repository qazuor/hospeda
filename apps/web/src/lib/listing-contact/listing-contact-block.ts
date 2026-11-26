/**
 * @file listing-contact-block.ts
 * @description Pure builders of the shared contact block (HOS-2579 §6.4):
 * `buildAccommodationContactBlock`, `buildVenueContactBlock` and
 * `buildExperienceContactBlock` map each vertical's public data to the props of
 * `ListingContactBlock.astro`.
 *
 * They replace the data half of the three old wrappers
 * (`AccommodationContactBlock`, `VenueContactBlock`, `ExperienceContactBlock`)
 * and the social half of `ExperienceInfo`, and keep every rule those applied:
 *
 * - **Every outbound URL goes through `resolveSafeExternalUrl`.** The website,
 *   the menu and the social profiles are owner-authored and published with no
 *   review, and `z.string().url()` accepts `javascript:` (HOS-592 / F-02). A
 *   refused value drops its link; it is never rendered raw.
 * - **The landline follows the main phone (HOS-2042).**
 * - **Allowed networks per vertical.** Accommodation: Facebook and Instagram
 *   only (owner decision, H-118). Venue and experience: website, Instagram,
 *   Facebook, X, YouTube and TikTok when present.
 * - **No WhatsApp, ever.** The number is gated per viewer on a separate
 *   endpoint (HOS-19, HOS-2256) and the page is shared-cached. `whatsapp` is
 *   not in any allow-list below, even though `ExperienceSocialNetworks` still
 *   declares the key (HOS-1076, HOS-363).
 * - **Owner-panel counters.** Venue phones carry `PHONE_CLICK`, the venue
 *   website `WEBSITE_CLICK`, and the venue's website and Instagram profiles
 *   `WEBSITE_CLICK` / `INSTAGRAM_CLICK` (HOS-2256). Nothing else is counted.
 * - **Umami block marker.** Venue and experience blocks carry
 *   `UMAMI_BLOCK_PROPS` (D-6).
 *
 * A builder returns `null` when there is nothing to show, and the page then
 * renders no block (H-118: several listings have no contact data at all).
 */

import {
    FacebookIcon,
    GlobeIcon,
    InstagramIcon,
    TiktokIcon,
    XIcon,
    YoutubeIcon
} from '@repo/icons';
import type {
    ListingContactChannel,
    ListingContactMenuLink,
    ListingContactShell,
    ListingContactSocialLink
} from '@/components/listing/contact/listing-contact.types';
import type {
    AccommodationContactInfo,
    AccommodationSocialNetworks,
    ExperienceContactInfo,
    ExperienceSocialNetworks,
    VenueContactInfo,
    VenueSocialNetworks
} from '@/data/types';
import { UMAMI_BLOCK_PROPS } from '@/lib/analytics/recording-block';
import { EXPERIENCE_CONTACT_ANCHOR_ID } from '@/lib/experience-contact';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ContactOrigin } from '@/lib/listing-contact/listing-contact-events';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { hasVenuePublicContact, VENUE_CONTACT_ANCHOR_ID } from '@/lib/venue-contact';

/** Props of `ListingContactBlock.astro`, as the builders produce them. */
export interface ListingContactBlockModel {
    readonly heading?: string;
    readonly socialHeading?: string;
    readonly channels: readonly ListingContactChannel[];
    readonly socialLinks: readonly ListingContactSocialLink[];
    /** `data-*` read by `initContactLinkTracking` (keys without the prefix). */
    readonly trackingData: Readonly<Record<string, string>>;
    readonly shell: ListingContactShell;
    /** Anchor id of the block (in-page CTAs point at it). */
    readonly id?: string;
    readonly blockProps?: Readonly<Record<string, string>>;
    /** The venue's «Ver menú» link, between channels and socials. */
    readonly menuLink?: ListingContactMenuLink;
}

/** Social networks a venue or an experience may publish. Never `whatsapp`. */
type PublicSocialKey = 'website' | 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'tiktok';

/**
 * Display order and brand logo of each allowed network. The accessible name of
 * each button is `accommodations.detail.listingContact.social.<key>` in the
 * page locale, so /en/ and /pt/ get their own («Website», «Site»).
 */
const PUBLIC_SOCIAL_LINKS: readonly {
    readonly key: PublicSocialKey;
    readonly Icon: ListingContactSocialLink['Icon'];
}[] = [
    { key: 'website', Icon: GlobeIcon },
    { key: 'instagram', Icon: InstagramIcon },
    { key: 'facebook', Icon: FacebookIcon },
    { key: 'twitter', Icon: XIcon },
    { key: 'youtube', Icon: YoutubeIcon },
    { key: 'tiktok', Icon: TiktokIcon }
];

/** The venue profiles the owner panel counts (HOS-2256). */
const VENUE_SOCIAL_INTERACTION_KINDS: Partial<Record<PublicSocialKey, string>> = {
    website: 'WEBSITE_CLICK',
    instagram: 'INSTAGRAM_CLICK'
};

/**
 * A stored value as a non-empty trimmed string, or `undefined`. `contact_info`
 * is an unbounded JSONB blob, so a key can hold `null`, `''` or whitespace.
 */
function clean(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** `tel:` hrefs carry digits and `+` only; the visible text keeps its spaces. */
export function toTelHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** The visible label of a website button: the URL without its scheme. */
function websiteLabel(href: string): string {
    return href.replace(/^https?:\/\//, '');
}

/** Tracking data every link of a block carries. */
function trackingDataFor(input: {
    readonly listingId: string;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
}): Readonly<Record<string, string>> {
    const origin: ContactOrigin = 'contact_block';
    return { 'listing-id': input.listingId, vertical: input.vertical, 'contact-origin': origin };
}

/** Allowed social profiles of a venue or an experience, in display order. */
function publicSocialLinks(input: {
    readonly socialNetworks: Partial<Record<PublicSocialKey, string | null | undefined>> | null;
    readonly interactionKinds?: Partial<Record<PublicSocialKey, string>>;
    readonly locale: SupportedLocale;
}): ListingContactSocialLink[] {
    const { t } = createTranslations(input.locale);
    return PUBLIC_SOCIAL_LINKS.flatMap(({ key, Icon }) => {
        const label = t(`accommodations.detail.listingContact.social.${key}`);
        const href = resolveSafeExternalUrl(input.socialNetworks?.[key] ?? undefined);
        if (!href) return [];
        const interactionKind = input.interactionKinds?.[key];
        return [{ href, ariaLabel: label, Icon, ...(interactionKind ? { interactionKind } : {}) }];
    });
}

/**
 * Contact block of an accommodation: phone, landline, email, website,
 * Facebook and Instagram (H-118, HOS-2042).
 *
 * @param input - Listing id, its public contact info and social networks, locale.
 * @returns The block props, or `null` when nothing is publishable.
 */
export function buildAccommodationContactBlock(input: {
    readonly listingId: string;
    readonly contactInfo?: AccommodationContactInfo;
    readonly socialNetworks?: AccommodationSocialNetworks;
    readonly locale: SupportedLocale;
}): ListingContactBlockModel | null {
    const { contactInfo, socialNetworks } = input;
    const { t } = createTranslations(input.locale);

    const phone = clean(contactInfo?.phone);
    const landline = clean(contactInfo?.landlinePhone);
    const email = clean(contactInfo?.email);
    const websiteHref = resolveSafeExternalUrl(contactInfo?.website);
    const facebookHref = resolveSafeExternalUrl(socialNetworks?.facebook);
    const instagramHref = resolveSafeExternalUrl(socialNetworks?.instagram);

    const channels: ListingContactChannel[] = [];
    if (phone) {
        channels.push({
            kind: 'phone',
            href: `tel:${phone}`,
            label: phone,
            srHint: `, ${t('accommodations.detail.contact.phoneAriaLabel', 'Llamar al alojamiento')}`
        });
    }
    if (landline) {
        channels.push({
            kind: 'phone',
            href: `tel:${landline}`,
            label: landline,
            srHint: `, ${t('accommodations.detail.contact.landlineAriaLabel', 'Llamar al teléfono fijo del alojamiento')}`
        });
    }
    if (email) {
        channels.push({
            kind: 'email',
            href: `mailto:${email}`,
            label: email,
            srHint: `, ${t('accommodations.detail.contact.emailAriaLabel', 'Enviar email al alojamiento')}`
        });
    }
    if (websiteHref) {
        channels.push({
            kind: 'website',
            href: websiteHref,
            label: websiteLabel(websiteHref),
            srHint: `, ${t('accommodations.detail.contact.websiteAriaLabel', 'Visitar sitio web del alojamiento')}`
        });
    }

    const socialLinks: ListingContactSocialLink[] = [];
    if (facebookHref) {
        socialLinks.push({
            href: facebookHref,
            ariaLabel: t(
                'accommodations.detail.contact.facebookAriaLabel',
                'Facebook del alojamiento'
            ),
            Icon: FacebookIcon
        });
    }
    if (instagramHref) {
        socialLinks.push({
            href: instagramHref,
            ariaLabel: t(
                'accommodations.detail.contact.instagramAriaLabel',
                'Instagram del alojamiento'
            ),
            Icon: InstagramIcon
        });
    }

    if (channels.length === 0 && socialLinks.length === 0) return null;

    return {
        heading: t('accommodations.detail.contact.title', 'Contacto'),
        channels,
        socialLinks,
        trackingData: trackingDataFor({ listingId: input.listingId, vertical: 'accommodation' }),
        shell: 'card'
    };
}

/**
 * Contact block of a venue: mobile phone, landline, email, website, the menu
 * link and the allowed social profiles, with the owner-panel counters.
 *
 * The render decision is `hasVenuePublicContact`, the SAME predicate the page's
 * events CTA uses (HOS-1055, HOS-2042): the CTA anchors into this block, so the
 * two must agree on whether it exists.
 *
 * @param input - Listing id, public contact info, social networks, menu URL, locale.
 * @returns The block props, or `null` when nothing is publishable.
 */
export function buildVenueContactBlock(input: {
    readonly listingId: string;
    readonly contactInfo?: VenueContactInfo | null;
    readonly socialNetworks: VenueSocialNetworks | null;
    readonly menuUrl?: string | null;
    readonly locale: SupportedLocale;
}): ListingContactBlockModel | null {
    const { contactInfo, socialNetworks, menuUrl } = input;
    if (!hasVenuePublicContact({ contactInfo, socialNetworks, menuUrl })) return null;
    const { t } = createTranslations(input.locale);
    const trackingData = trackingDataFor({ listingId: input.listingId, vertical: 'venue' });

    const phones = [
        {
            value: clean(contactInfo?.mobilePhone),
            ariaLabel: t('venue.detail.contactPhoneAriaLabel', 'Llamar al comercio')
        },
        {
            value: clean(contactInfo?.workPhone),
            ariaLabel: t(
                'venue.detail.contactLandlineAriaLabel',
                'Llamar al teléfono fijo del comercio'
            )
        }
    ];
    const channels: ListingContactChannel[] = phones.flatMap(({ value, ariaLabel }) =>
        value
            ? [
                  {
                      kind: 'phone' as const,
                      href: toTelHref(value),
                      label: value.replace(
                          /^\+54(9?)344([26])(\d{6})$/,
                          (_, mobile: string, area: string, local: string) =>
                              `+54 ${mobile ? `${mobile} ` : ''}344${area} ${local}`
                      ),
                      srHint: `, ${ariaLabel}`,
                      interactionKind: 'PHONE_CLICK'
                  }
              ]
            : []
    );
    const workEmail = clean(contactInfo?.workEmail);
    if (workEmail) {
        channels.push({
            kind: 'email',
            href: `mailto:${workEmail}`,
            label: workEmail,
            srHint: `, ${t('venue.detail.contactEmailAriaLabel', 'Enviar email al comercio')}`
        });
    }
    const websiteHref = resolveSafeExternalUrl(contactInfo?.website ?? undefined);
    if (websiteHref) {
        channels.push({
            kind: 'website',
            href: websiteHref,
            label: websiteLabel(websiteHref),
            srHint: `, ${t('venue.detail.contactWebsiteAriaLabel', 'Visitar el sitio web del comercio')}`,
            interactionKind: 'WEBSITE_CLICK'
        });
    }

    if (
        channels.length === 0 &&
        !Object.values(socialNetworks ?? {}).some((url) => resolveSafeExternalUrl(url))
    )
        return null;

    return {
        ...(channels.length > 0 ? { heading: t('venue.detail.contactTitle', 'Contacto') } : {}),
        socialHeading: t('venue.detail.social', 'Redes sociales'),
        channels,
        socialLinks: publicSocialLinks({
            socialNetworks,
            interactionKinds: VENUE_SOCIAL_INTERACTION_KINDS,
            locale: input.locale
        }),
        trackingData,
        shell: 'plain',
        id: VENUE_CONTACT_ANCHOR_ID,
        blockProps: UMAMI_BLOCK_PROPS
    };
}

/**
 * Contact block of an experience: mobile phone, landline, email, website
 * (HOS-815, HOS-2042) and the allowed social profiles, which used to render
 * as emoji pills inside `ExperienceInfo`.
 *
 * Mobiles render as plain `tel:` links: a WhatsApp deep link would invent a
 * channel the provider never opted into (HOS-363).
 *
 * @param input - Listing id, public contact info, social networks, locale.
 * @returns The block props, or `null` when nothing is publishable.
 */
export function buildExperienceContactBlock(input: {
    readonly listingId: string;
    readonly contactInfo: ExperienceContactInfo | null;
    readonly socialNetworks: ExperienceSocialNetworks | null;
    readonly locale: SupportedLocale;
}): ListingContactBlockModel | null {
    const { contactInfo } = input;
    const { t } = createTranslations(input.locale);

    const phones = [
        {
            value: clean(contactInfo?.mobilePhone),
            ariaLabel: t('experience.detail.contactPhoneAriaLabel', 'Llamar al prestador')
        },
        {
            value: clean(contactInfo?.workPhone),
            ariaLabel: t(
                'experience.detail.contactLandlineAriaLabel',
                'Llamar al teléfono fijo del prestador'
            )
        }
    ];
    const channels: ListingContactChannel[] = phones.flatMap(({ value, ariaLabel }) =>
        value
            ? [
                  {
                      kind: 'phone' as const,
                      href: toTelHref(value),
                      label: value,
                      srHint: `, ${ariaLabel}`
                  }
              ]
            : []
    );
    const workEmail = clean(contactInfo?.workEmail);
    if (workEmail) {
        channels.push({
            kind: 'email',
            href: `mailto:${workEmail}`,
            label: workEmail,
            srHint: `, ${t('experience.detail.contactEmailAriaLabel', 'Enviar un email al prestador')}`
        });
    }
    const websiteHref = resolveSafeExternalUrl(contactInfo?.website ?? undefined);
    if (websiteHref) {
        channels.push({
            kind: 'website',
            href: websiteHref,
            label: websiteLabel(websiteHref),
            srHint: `, ${t('experience.detail.contactWebsiteAriaLabel', 'Visitar el sitio web del prestador')}`
        });
    }

    const socialLinks = publicSocialLinks({
        socialNetworks: input.socialNetworks,
        locale: input.locale
    });
    if (channels.length === 0 && socialLinks.length === 0) return null;

    return {
        heading: t('experience.detail.contact', 'Contacto'),
        socialHeading: t('experience.detail.social', 'Redes sociales'),
        channels,
        socialLinks,
        trackingData: trackingDataFor({ listingId: input.listingId, vertical: 'experience' }),
        shell: 'card',
        id: EXPERIENCE_CONTACT_ANCHOR_ID,
        blockProps: UMAMI_BLOCK_PROPS
    };
}
