/**
 * @file ListingContactBar.page-props.test.tsx
 * @description HOS-2579 owner criterion (24/11/2026): the bar's Zod props parse
 * must never reject what a listing page really passes, because a rejected parse
 * renders `null`, leaves the `contact` dock slot empty and unpins the dock.
 *
 * Each case builds the props the way the page does (same producers, same
 * expressions, payload fields typed by `@repo/schemas`) and asserts the bar
 * renders a dock item. When a page changes how it builds a prop, mirror it here.
 */

import type { AccommodationPublic, VenuePublicWhatsapp } from '@repo/schemas';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ListingContactBarProps } from '@/components/listing/contact/ListingContactBar.client';
import { ListingContactBar } from '@/components/listing/contact/ListingContactBar.client';
import { EXPERIENCE_CONTACT_ANCHOR_ID } from '@/lib/experience-contact';
import { resolveListingBarPhoneHref } from '@/lib/listing-contact/listing-action-bar';
import {
    buildExperienceChannels,
    buildExperienceContactPrice,
    buildVenueChannels,
    resolveVenueContactMode
} from '@/lib/listing-contact/listing-channels';
import { VENUE_CONTACT_ANCHOR_ID } from '@/lib/venue-contact';

vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({
        isInList: () => false,
        isLoading: false,
        maxItems: 4,
        toggle: () => ({ action: 'added', reason: null })
    })
}));

/** `siteOrigin` as the pages compute it, without `Astro.site`. */
const siteOrigin = 'http://localhost:4321';
const shareUrlFor = (path: string) => `${siteOrigin}${path}`;

const renderInDock = (props: ListingContactBarProps) =>
    render(
        <div data-mobile-dock>
            <div data-mobile-dock-slot="contact" />
            <ListingContactBar {...props} />
        </div>
    );

const expectPinnedBar = (container: HTMLElement) => {
    expect(
        container.querySelector('[data-mobile-dock-slot="contact"] [data-dock-item]')
    ).not.toBeNull();
};

/** `alojamientos/[slug].astro`: payload shape from `@repo/schemas`. */
const accommodationProps = ({
    hasWhatsapp,
    price,
    featuredImage,
    phone
}: {
    readonly hasWhatsapp: AccommodationPublic['hasWhatsapp'];
    readonly price: { readonly price: number; readonly currency: string } | null;
    readonly featuredImage: string | null;
    readonly phone: string | undefined;
}): ListingContactBarProps => ({
    vertical: 'accommodation',
    listingId: 'acc-1',
    locale: 'es',
    listingName: 'Casa del Río',
    price: {
        amount: price?.price ?? null,
        currency: price?.currency ?? null,
        unitLabelKey: 'accommodations.detail.listingContact.units.perNight',
        onRequest: (price?.price ?? 0) <= 0
    },
    primary: { kind: 'inquire' },
    hasWhatsapp,
    phoneHref: resolveListingBarPhoneHref({ phones: [phone, undefined] }).href,
    shareUrl: shareUrlFor('/es/alojamientos/casa-del-rio/'),
    compare: { thumbnailUrl: featuredImage || undefined, gatePlanNames: [] },
    panelId: 'listing-contact-panel'
});

/** `comer-y-salir/[slug].astro`. */
const venueProps = ({
    menuUrl,
    whatsapp,
    instagram,
    mobilePhone
}: {
    readonly menuUrl: string | null;
    readonly whatsapp: VenuePublicWhatsapp | undefined;
    readonly instagram: string | undefined;
    readonly mobilePhone: string | undefined;
}): ListingContactBarProps => {
    const contactChannels = buildVenueChannels({
        socialNetworks: instagram ? { instagram } : null
    });
    const contactMode = resolveVenueContactMode({
        menuUrl,
        channels: contactChannels,
        hasWhatsapp: Boolean(whatsapp)
    });
    const barPrimary =
        contactMode.kind === 'menu'
            ? ({ kind: 'menu', href: contactMode.href } as const)
            : contactMode.kind === 'panel'
              ? ({ kind: 'inquire' } as const)
              : null;
    return {
        vertical: 'venue',
        listingId: 'ven-1',
        listingName: 'Bar del Puerto',
        locale: 'es',
        price: null,
        primary: barPrimary,
        hasWhatsapp: false,
        venueWhatsapp: whatsapp ?? null,
        phoneHref: resolveListingBarPhoneHref({ phones: [mobilePhone, undefined] }).href,
        shareUrl: shareUrlFor('/es/comer-y-salir/bar-del-puerto/'),
        panelId: 'listing-contact-panel',
        fallbackHref: `#${VENUE_CONTACT_ANCHOR_ID}`
    };
};

/** `experiencias/[slug].astro`. */
const experienceProps = ({
    contactInfo,
    priceFrom,
    isPriceOnRequest
}: {
    readonly contactInfo: { readonly mobilePhone?: string; readonly website?: string } | null;
    readonly priceFrom: number | null;
    readonly isPriceOnRequest: boolean;
}): ListingContactBarProps => {
    const contactChannels = contactInfo ? buildExperienceChannels({ contactInfo }) : [];
    return {
        vertical: 'experience',
        listingId: 'exp-1',
        listingName: 'Kayak al atardecer',
        locale: 'es',
        price: buildExperienceContactPrice({
            priceFrom,
            priceUnit: 'per_person',
            isPriceOnRequest
        }),
        primary: contactChannels.length > 0 ? { kind: 'inquire' } : null,
        hasWhatsapp: false,
        phoneHref: resolveListingBarPhoneHref({ phones: [contactInfo?.mobilePhone, undefined] })
            .href,
        shareUrl: shareUrlFor('/es/experiencias/kayak-al-atardecer/'),
        panelId: 'listing-contact-panel',
        fallbackHref: `#${EXPERIENCE_CONTACT_ANCHOR_ID}`
    };
};

describe('ListingContactBar: the props each page really passes always parse', () => {
    it.each([
        [
            'accommodation, full payload',
            accommodationProps({
                hasWhatsapp: true,
                price: { price: 155500, currency: 'ARS' },
                featuredImage: 'https://res.cloudinary.com/demo/image/upload/casa.jpg',
                phone: '+54 9 3442 555222'
            })
        ],
        [
            'accommodation, payload without hasWhatsapp, price or image',
            accommodationProps({
                hasWhatsapp: undefined,
                price: null,
                featuredImage: null,
                phone: undefined
            })
        ],
        [
            'accommodation, legacy zero price',
            accommodationProps({
                hasWhatsapp: false,
                price: { price: 0, currency: 'ARS' },
                featuredImage: '',
                phone: 'not a phone'
            })
        ]
    ])('%s', (_name, props) => {
        const { container } = renderInDock(props);
        expectPinnedBar(container);
    });

    it.each([
        [
            'venue with a menu and a PUBLIC WhatsApp',
            venueProps({
                menuUrl: 'https://bar.test/carta',
                whatsapp: { mode: 'PUBLIC', number: '+54 9 3442 111111' },
                instagram: 'https://instagram.com/bar',
                mobilePhone: '+54 9 3442 222222'
            })
        ],
        [
            'venue with an unsafe menu URL and a LOGGED_IN_ONLY WhatsApp',
            venueProps({
                menuUrl: 'javascript:alert(1)',
                whatsapp: { mode: 'LOGGED_IN_ONLY' },
                instagram: undefined,
                mobilePhone: undefined
            })
        ],
        [
            'venue with no menu, socials, WhatsApp or phone',
            venueProps({
                menuUrl: null,
                whatsapp: undefined,
                instagram: undefined,
                mobilePhone: undefined
            })
        ]
    ])('%s', (_name, props) => {
        const { container } = renderInDock(props);
        expectPinnedBar(container);
    });

    it.each([
        [
            'experience with channels and a price',
            experienceProps({
                contactInfo: { mobilePhone: '+54 9 3442 333333', website: 'https://kayak.test' },
                priceFrom: 1_500_000,
                isPriceOnRequest: false
            })
        ],
        [
            'experience with no contact info and price on request',
            experienceProps({ contactInfo: null, priceFrom: null, isPriceOnRequest: true })
        ]
    ])('%s', (_name, props) => {
        const { container } = renderInDock(props);
        expectPinnedBar(container);
    });
});
