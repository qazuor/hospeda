import { z } from 'zod';

/** Sections a listing detail page can expose as sticky tabs, in page order. */
export const LISTING_SECTION_KEYS = [
    'photos',
    'details',
    'amenities',
    'location',
    'reviews',
    'host'
] as const;

/** A tab-able listing section. */
export type ListingSectionKey = (typeof LISTING_SECTION_KEYS)[number];

/** Zod schema for {@link ListingSectionKey}. */
export const listingSectionKeySchema = z.enum(LISTING_SECTION_KEYS);

/** Stable anchor id of each section. The page owns the element, the tab links to it. */
export const LISTING_SECTION_IDS: Readonly<Record<ListingSectionKey, string>> = {
    photos: 'listing-photos',
    details: 'listing-details',
    amenities: 'listing-amenities',
    location: 'listing-location',
    reviews: 'listing-reviews',
    host: 'listing-host'
};

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
