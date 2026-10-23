/**
 * @file featured-accommodations.ts
 * @description Pure selection for the homepage featured accommodations section (HOS-1764).
 * The API already forces `featuredFirst` and returns the real `isFeatured` value
 * for every item. This helper preserves that state, puts featured cards first,
 * and fills the remaining slots from the best-rated cards in API order.
 */

/** Maximum number of accommodation cards displayed in the homepage section. */
export const HOME_FEATURED_ACCOMMODATIONS_LIMIT = 8;

/** Minimum immutable fields needed to select a homepage accommodation card. */
export interface HomeFeaturedCandidate {
    /** Stable accommodation identifier used to remove duplicate results. */
    readonly id: string;
    /** Whether the public API marks this accommodation as featured. */
    readonly isFeatured: boolean;
}

/**
 * Selects distinct homepage cards, keeping featured cards first and filling
 * remaining slots with the other cards in their existing API order.
 *
 * The API response is already ordered by featured status and then by rating;
 * this function only partitions stably, removes repeated IDs (keeping the
 * first occurrence), and applies the requested limit. It never changes or
 * copies a card, including its `isFeatured` value.
 *
 * @param input - The API-ordered candidate cards and maximum output count.
 * @returns The selected original card references, with featured cards first.
 */
export function selectHomeAccommodationCards<T extends HomeFeaturedCandidate>(input: {
    readonly cards: readonly T[];
    readonly limit: number;
}): readonly T[] {
    if (input.limit <= 0) return [];

    const seenIds = new Set<string>();
    const featured: T[] = [];
    const other: T[] = [];

    for (const card of input.cards) {
        if (seenIds.has(card.id)) continue;
        seenIds.add(card.id);
        (card.isFeatured ? featured : other).push(card);
    }

    return [...featured, ...other].slice(0, input.limit);
}
