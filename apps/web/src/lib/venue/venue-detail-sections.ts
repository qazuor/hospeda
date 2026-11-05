/**
 * @file venue-detail-sections.ts
 * @description The catalog sections the venue detail page renders as its body,
 * and the order it renders them in (HOS-1787 leaf 6.1, sub-spec 6 § «Ficha»).
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
 * - `price` is painted by `VenueDetailHeader` (the page's frame, above the
 *   body).
 * - `media` is the fixed gallery at the top of the page (the listing's cover),
 *   not an in-flow section.
 * - `translations` is management metadata and never renders publicly.
 *
 * A section that is not `available` still resolves here: the public projector
 * removed its fields, and each component self-hides on empty props. "Only the
 * `available` sections" is therefore not a second gate in this module.
 */

import { LISTING_SECTIONS, type ListingSectionId } from '@repo/schemas';

/**
 * Whether the venue detail BODY paints each catalog section.
 *
 * `true` means the section is rendered in catalog order by the page;
 * `false` means the page paints it somewhere fixed (or not at all).
 */
export const VENUE_DETAIL_SECTION_BODY = {
    basicInfo: true,
    openingHours: true,
    price: false,
    amenities: true,
    media: false,
    contact: true,
    menu: true,
    dailySpecials: true,
    venueEvents: true,
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

/** The catalog facts this module needs from one section (a narrow view). */
export interface VenueDetailSectionSource {
    readonly id: ListingSectionId<'venue'>;
    readonly order: number;
}

/**
 * Body section ids in catalog order.
 *
 * Filtering and ordering are deliberately separate steps: the input may be in
 * any order (the test passes the real catalog reversed), and only the
 * catalog's own `order` decides the output. Filtering by the registry is what
 * keeps `price`, `media` and `translations` out even though they are catalog
 * members.
 *
 * @param params.sections - Sections to order. Defaults to the venue catalog.
 * @returns The ids the body renders, sorted by `order`.
 */
export function orderVenueDetailSections({
    sections = LISTING_SECTIONS.venue
}: {
    readonly sections?: readonly VenueDetailSectionSource[];
} = {}): readonly VenueDetailBodySectionId[] {
    return sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => section.id)
        .filter((id): id is VenueDetailBodySectionId => VENUE_DETAIL_SECTION_BODY[id]);
}
