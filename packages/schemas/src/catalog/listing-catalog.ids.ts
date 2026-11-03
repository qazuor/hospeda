import type { ListingVertical } from './listing-catalog.base-types.js';
import type { LISTING_SECTIONS } from './listing-sections.js';
/** Section id union derived from the section catalog for a vertical. */
export type ListingSectionId<V extends ListingVertical> =
    (typeof LISTING_SECTIONS)[V][number]['id'];
/** Feature id union derived from a section catalog entry. */
export type SectionTraitId<V extends ListingVertical, S extends ListingSectionId<V>> =
    Extract<(typeof LISTING_SECTIONS)[V][number], { readonly id: S }> extends {
        readonly traits: readonly (infer T)[];
    }
        ? T extends { readonly id: infer I }
            ? I
            : never
        : never;
