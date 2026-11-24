/**
 * @file listing-detail-order.ts
 * @description The canonical section order of a public listing detail page
 * (HOS-2579 §6.1). Accommodation, venue and experience pages render their
 * blocks by iterating {@link LISTING_DETAIL_SLOTS}; a vertical skips a slot it
 * has no content for, and never lists blocks in an ad-hoc order.
 *
 * Each rendered slot is wrapped in an element whose `id` is
 * {@link LISTING_DETAIL_SLOT_IDS}`[slot]` (`listing-<kebab-slot>`), so every
 * slot is an anchored landmark (§6.1.2).
 */

/** Canonical slots of a public listing detail page, in render order (HOS-2579). */
export const LISTING_DETAIL_SLOTS = [
    'galleryHeader', // 1. gallery + videos + ListingHeader
    'summary', // 2. price / today's status / duration + Consultar
    'description', // 3. description with «Leer más»
    'offers', // 4. amenities+features / menu+daily specials+events+night info / what's included
    'hours', // 5. opening hours (venue, experience)
    'promotions', // 6. promotions
    'location', // 7. location + map (+ what's nearby)
    'reviews', // 8. reviews (+ external reputation, venue review form)
    'host', // 9. host (accommodation only)
    'contact', // 10. contact channels + socials (+ experience private groups)
    'policies', // 11. house rules / preparation + cancellation
    'faq', // 12. FAQ
    'related' // 13. related carousels (`after-content`)
] as const;

/** One canonical slot of a listing detail page. */
export type ListingDetailSlot = (typeof LISTING_DETAIL_SLOTS)[number];

/**
 * Anchor id of each slot's wrapper: `listing-<kebab-slot>`
 * (for example `listing-gallery-header` and `listing-offers`). Written out
 * rather than derived so a reader can grep for the id; the unit test checks
 * every value follows the rule.
 */
export const LISTING_DETAIL_SLOT_IDS = {
    galleryHeader: 'listing-gallery-header',
    summary: 'listing-summary',
    description: 'listing-description',
    offers: 'listing-offers',
    hours: 'listing-hours',
    promotions: 'listing-promotions',
    location: 'listing-location',
    reviews: 'listing-reviews',
    host: 'listing-host',
    contact: 'listing-contact',
    policies: 'listing-policies',
    faq: 'listing-faq',
    related: 'listing-related'
} as const satisfies Readonly<Record<ListingDetailSlot, `listing-${string}`>>;
