/**
 * @file featured-accommodations.ts
 * @description Pure filter for the homepage "Destacados" section (HOS-929).
 *
 * `AccommodationModel.search()` never applies `params.isFeatured` as a WHERE
 * filter — only `featuredFirst` ordering is implemented (see
 * `packages/db/src/models/accommodation/accommodation.model.ts`). So the
 * `isFeatured: true` request param `FeaturedAccommodationsSection.astro`
 * sends is a no-op at the DB layer: without this filter, the section
 * silently backfilled with non-featured cards whenever fewer than `pageSize`
 * accommodations were genuinely featured.
 *
 * Extracted as a pure function (rather than inlined in the `.astro`
 * frontmatter) so it is unit-testable — Astro components in this app are
 * never typechecked and a source-text test on the whole file cannot
 * distinguish "the filter runs" from "the filter is declared".
 */

/** The subset of `AccommodationCardData` this filter needs. */
export interface FeaturedFilterable {
    readonly isFeatured: boolean;
}

/**
 * Keeps only genuinely featured cards.
 *
 * `card.isFeatured` here is the value the public API already ORs with
 * `featuredByEntitlement` (see `apps/api/src/utils/accommodation-featured.ts`),
 * so this filter needs no OR logic of its own — it only has to stop treating
 * "not featured" as "close enough".
 *
 * @param cards - Cards as returned by `toAccommodationCardProps`, in the
 *   order the API returned them (featured-first, per the forced
 *   `featuredFirst` sort).
 * @returns Only the cards whose `isFeatured` is `true`, order preserved. Can
 *   return fewer than `cards.length` — including zero — which the caller
 *   renders via `EmptyState`.
 */
export function filterFeaturedCards<T extends FeaturedFilterable>(
    cards: readonly T[]
): readonly T[] {
    return cards.filter((card) => card.isFeatured);
}
