import { z } from 'zod';

/**
 * Sections a listing detail page can expose as sticky tabs, in page order.
 *
 * The order follows the 13 canonical slots of `listing-detail-order.ts`
 * (HOS-2579 §6.2): photos (slot 1), details (3), amenities (4, «Lo que
 * ofrece» on a venue), hours (5), location (7), reviews (8), host (9) and
 * contact (10).
 */
export const LISTING_SECTION_KEYS = [
    'photos',
    'details',
    'amenities',
    'hours',
    'location',
    'reviews',
    'host',
    'contact'
] as const;

/** A tab-able listing section. */
export type ListingSectionKey = (typeof LISTING_SECTION_KEYS)[number];

/** Zod schema for {@link ListingSectionKey}. */
export const listingSectionKeySchema = z.enum(LISTING_SECTION_KEYS);

/**
 * Stable anchor id of each section. The page owns the element, the tab links to it.
 *
 * These are aliases of the slot wrapper ids (`LISTING_DETAIL_SLOT_IDS`):
 * `hours`, `location`, `reviews`, `host` and `contact` ARE the slot wrapper
 * ids; `photos` sits on the gallery inside slot 1, `details` inside slot 3 and
 * `amenities` inside slot 4 (HOS-2579 §6.1.2).
 */
export const LISTING_SECTION_IDS: Readonly<Record<ListingSectionKey, string>> = {
    photos: 'listing-photos',
    details: 'listing-details',
    amenities: 'listing-amenities',
    hours: 'listing-hours',
    location: 'listing-location',
    reviews: 'listing-reviews',
    host: 'listing-host',
    contact: 'listing-contact'
};

/**
 * The i18n key (under `accommodations.detail.sectionTabs.`) of a tab's label.
 *
 * On a venue the slot-4 tab also holds the menu and the agenda (owner decision
 * D-3), so it reads «Lo que ofrece» (`offers`) instead of the amenities label.
 * There is no separate events tab.
 *
 * @param input.key - The tab.
 * @param input.vertical - The listing's vertical.
 * @returns The label key suffix.
 */
export function getListingSectionTabLabelKey({
    key,
    vertical
}: {
    readonly key: ListingSectionKey;
    readonly vertical: 'accommodation' | 'experience' | 'venue';
}): ListingSectionKey | 'offers' {
    return vertical === 'venue' && key === 'amenities' ? 'offers' : key;
}

/** One tab of the sticky section navigation. */
export interface ListingSectionTab {
    readonly key: ListingSectionKey;
    /** Anchor id of the section element, without the leading `#`. */
    readonly id: string;
    /**
     * The target only exists in the narrow layout (e.g. the host summary), so the
     * tab is hidden on desktop instead of pointing at an element that is not shown.
     */
    readonly hideOnDesktop: boolean;
}

/**
 * Builds the tab list for the sections that actually exist on the page, in page order.
 * A section that is absent never produces a tab, so a tab can never lead nowhere.
 *
 * @param input.present - Which sections the page renders.
 * @param input.hideOnDesktop - Sections whose anchor is only visible in the narrow layout.
 * @returns The ordered tabs.
 */
export function buildListingSectionTabs({
    present,
    hideOnDesktop = []
}: {
    readonly present: Readonly<Partial<Record<ListingSectionKey, boolean>>>;
    readonly hideOnDesktop?: readonly ListingSectionKey[];
}): readonly ListingSectionTab[] {
    return LISTING_SECTION_KEYS.filter((key) => present[key] === true).map((key) => ({
        key,
        id: LISTING_SECTION_IDS[key],
        hideOnDesktop: hideOnDesktop.includes(key)
    }));
}
