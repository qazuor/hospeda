/**
 * @file venue-detail-sections.ts
 * @description The catalog sections the venue detail page renders as its body,
 * and the order it renders them in (HOS-1787 leaf 6.1, sub-spec 6 § «Ficha»;
 * page order by slot since HOS-2579 §6.2.3).
 *
 * The domain (ids, order, fields) lives in `@repo/schemas`; this file adds the
 * one fact only the public page knows: which sections are BODY blocks. The
 * registry is a `satisfies Record<ListingSectionId<'venue'>, boolean>`, so a
 * section added to the catalog stops the build until this page declares
 * whether it paints it — the same exhaustiveness contract the editor's
 * presentation registry uses.
 *
 * Three sections are deliberately `false`:
 *
 * - `price` is painted by `VenueSummary` (slot 2, right under the gallery,
 *   HOS-2579), outside the catalog-ordered body.
 * - `media` is the fixed gallery at the top of the page (the listing's cover),
 *   not an in-flow section.
 * - `translations` is management metadata and never renders publicly.
 *
 * Since HOS-2579 the page order is NOT the catalog order. The catalog `order`
 * also drives the owner's listing editor and must not change (NG-8), so the
 * page maps every body section to one of the 13 canonical slots
 * ({@link VENUE_SECTION_SLOT}) and sorts by slot; the catalog `order` only
 * breaks ties inside one slot.
 *
 * A section that is not `available` still resolves here: the public projector
 * removed its fields, and each component self-hides on empty props. "Only the
 * `available` sections" is therefore not a second gate in this module.
 */

import { LISTING_SECTIONS, type ListingSectionId } from '@repo/schemas';
import {
    LISTING_DETAIL_SLOTS,
    type ListingDetailSlot
} from '@/lib/listing-detail/listing-detail-order';

/**
 * Whether the venue detail BODY paints each catalog section.
 *
 * `true` means the section is rendered in catalog order by the page;
 * `false` means the page paints it somewhere fixed (or not at all).
 */
export const VENUE_DETAIL_SECTION_BODY = {
    basicInfo: true,
    location: true,
    openingHours: true,
    price: false,
    amenities: true,
    media: false,
    contact: true,
    menu: true,
    dailySpecials: true,
    venueEvents: true,
    promotions: true,
    faqs: true,
    nightInfo: true,
    translations: false
} satisfies Record<ListingSectionId<'venue'>, boolean>;

/** The catalog section ids the body actually paints (the `true` entries). */
export type VenueDetailBodySectionId = {
    readonly [K in keyof typeof VENUE_DETAIL_SECTION_BODY]: (typeof VENUE_DETAIL_SECTION_BODY)[K] extends true
        ? K
        : never;
}[keyof typeof VENUE_DETAIL_SECTION_BODY];

/**
 * The canonical slot (HOS-2579 §6.1) each body section renders in.
 *
 * Typed with `satisfies` over every body section id, so a section added to
 * the catalog (and declared `true` above) breaks the build until it gets a
 * slot. Owner decision D-3: the agenda (`venueEvents`) sits in «Lo que
 * ofrece» (`offers`) with the menu, never in `promotions`.
 */
export const VENUE_SECTION_SLOT = {
    basicInfo: 'description',
    amenities: 'offers',
    menu: 'offers',
    dailySpecials: 'offers',
    venueEvents: 'offers',
    nightInfo: 'offers',
    openingHours: 'hours',
    promotions: 'promotions',
    location: 'location',
    contact: 'contact',
    faqs: 'faq'
} as const satisfies Record<VenueDetailBodySectionId, ListingDetailSlot>;

/** The catalog facts this module needs from one section (a narrow view). */
export interface VenueDetailSectionSource {
    readonly id: ListingSectionId<'venue'>;
    readonly order: number;
}

/**
 * Body section ids in PAGE order: by {@link VENUE_SECTION_SLOT} slot, in
 * {@link LISTING_DETAIL_SLOTS} order, with the catalog `order` breaking ties
 * inside one slot (HOS-2579 §6.2.3).
 *
 * The input may arrive in any order; only the slot and then the catalog
 * `order` decide the output. Filtering by the registry is what keeps `price`,
 * `media` and `translations` out even though they are catalog members.
 *
 * @param params.sections - Sections to order. Defaults to the venue catalog.
 * @returns The ids the body renders, in page order.
 */
export function orderVenueDetailSections({
    sections = LISTING_SECTIONS.venue
}: {
    readonly sections?: readonly VenueDetailSectionSource[];
} = {}): readonly VenueDetailBodySectionId[] {
    const slotIndex = (id: VenueDetailBodySectionId): number =>
        LISTING_DETAIL_SLOTS.indexOf(VENUE_SECTION_SLOT[id]);
    return sections
        .filter(
            (
                section
            ): section is VenueDetailSectionSource & { readonly id: VenueDetailBodySectionId } =>
                VENUE_DETAIL_SECTION_BODY[section.id]
        )
        .slice()
        .sort((a, b) => slotIndex(a.id) - slotIndex(b.id) || a.order - b.order)
        .map((section) => section.id);
}

/**
 * The body section ids that render inside one slot, in page order.
 *
 * The page paints one wrapper per slot (`ListingDetailSlot`) and asks this
 * helper what goes inside, so the slot a section lands in is decided here and
 * nowhere in the template.
 *
 * @param params.slot - The canonical slot.
 * @param params.sections - Sections to order. Defaults to the venue catalog.
 * @returns The ids of that slot, in page order (empty when the slot has none).
 */
export function venueDetailSectionsInSlot({
    slot,
    sections
}: {
    readonly slot: ListingDetailSlot;
    readonly sections?: readonly VenueDetailSectionSource[];
}): readonly VenueDetailBodySectionId[] {
    return orderVenueDetailSections({ sections }).filter((id) => VENUE_SECTION_SLOT[id] === slot);
}
