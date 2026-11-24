/**
 * @file listing-header.types.ts
 * @description Prop types of `ListingHeader.astro`, the one header frame of the
 * accommodation, venue and experience detail pages (HOS-2579 §6.3).
 *
 * The page never builds these by hand: `buildAccommodationHeader`,
 * `buildVenueHeader` and `buildExperienceHeader`
 * (`@/lib/listing-header/build-listing-header`) map each vertical's detail data
 * to {@link ListingHeaderProps}. Everything here is public listing data, so the
 * cached page stays session-blind.
 */

import type { ShareCampaign } from '@repo/analytics';
import type { VenueOpeningHoursEntry } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';

/** The three verticals that share the header. */
export type ListingHeaderVertical = 'accommodation' | 'venue' | 'experience';

/**
 * One badge of the header row. Every badge is sized by the shared
 * `.listing-header-badge` contract (`styles/components.css`).
 *
 * - `type`: the listing type. `accommodationType` makes the row render the
 *   shared `AccommodationTypeBadge` (its icon and colour are the single source
 *   of truth for accommodation types); without it the label renders as a
 *   tinted pill.
 * - `featured` / `verified` / `new`: status pills.
 * - `openNow`: the venue's today status. A cached page cannot know «today», so
 *   it renders the `VenueOpenNowBadge` island in a reserved, CLS-free slot.
 */
export type ListingHeaderBadge =
    | {
          readonly kind: 'type';
          readonly label: string;
          readonly accommodationType?: string;
      }
    | { readonly kind: 'featured' | 'verified' | 'new'; readonly label: string }
    | {
          readonly kind: 'openNow';
          readonly openingHours: Readonly<Record<string, VenueOpeningHoursEntry>>;
      };

/** The rating summary. `null` (or a zero count) renders no rating at all. */
export interface ListingHeaderRating {
    readonly average: number;
    readonly count: number;
}

/**
 * The location line. `href` is the destination page when the data carries the
 * destination slug, and `null` otherwise (plain text, never an invented URL).
 */
export interface ListingHeaderLocation {
    readonly name: string;
    readonly href: string | null;
}

/** What the desktop share button shares. */
export interface ListingHeaderShare {
    /** Canonical URL (UTMs are added per share action by `ShareButtons`). */
    readonly url: string;
    readonly title: string;
    readonly campaign: ShareCampaign;
}

/**
 * The compare control. Accommodation only: the compare page exists only for
 * accommodations (HOS-2579 NG-6), so the venue and experience builders always
 * return `null`.
 */
export interface ListingHeaderCompare {
    readonly thumbnailUrl: string | undefined;
}

/** Props of `ListingHeader.astro` (RO-RO, built by the per-vertical builders). */
export interface ListingHeaderProps {
    readonly vertical: ListingHeaderVertical;
    readonly locale: SupportedLocale;
    /** UUID of the listing (favorite and compare islands). */
    readonly entityId: string;
    /** The page `<h1>`. */
    readonly title: string;
    /** Target of the history-aware back button (the vertical's listing page). */
    readonly backHref: string;
    readonly badges: readonly ListingHeaderBadge[];
    readonly rating: ListingHeaderRating | null;
    readonly location: ListingHeaderLocation | null;
    readonly share: ListingHeaderShare;
    readonly compare: ListingHeaderCompare | null;
    /** Public bookmark count. `undefined` renders no counter. */
    readonly bookmarkCount?: number;
    /**
     * Whether the gallery overlay already carries back, favorite and share on
     * mobile. Below 768px the header then hides its own copies.
     */
    readonly hasMobileGalleryControls: boolean;
}
