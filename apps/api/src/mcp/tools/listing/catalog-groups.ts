/**
 * @file catalog-groups.ts
 * @description The by-category view of a catalog that `get_listing_amenities`
 * returns and `update_listing_amenities` answers with (HOS-2327, spec HOS-2335
 * §6.2): rows grouped by category in wizard order, Spanish labels, and the
 * listing's current selection marked.
 */

import { amenityLabel, featureLabel } from '../../../services/ai-context/listing-labels';
import { type CatalogKind, categoriesOf, categoryLabel } from './catalog-categories';
import type { CatalogRow } from './catalog-reader';

/** Locale of the names: the assistant answers owners in Spanish. */
const NAME_LOCALE = 'es';

/** One catalog item of a group. */
export interface AmenityGroupItem {
    /** Catalog id; what `update_listing_amenities` takes in `add` / `remove`. */
    readonly id: string;
    /** Stable slug. */
    readonly slug: string;
    /** Spanish display name. */
    readonly name: string;
    /** Whether the listing currently has it. */
    readonly selected: boolean;
}

/** The items of one category, with its Spanish label. */
export interface AmenityGroup {
    /** `amenity` or `feature`. */
    readonly kind: CatalogKind;
    /** Category value (amenity `type` or feature `category`). */
    readonly category: string;
    /** Spanish category label. */
    readonly label: string;
    /** Items sorted by name. */
    readonly items: readonly AmenityGroupItem[];
}

/**
 * Builds the non-empty groups of one kind, in wizard order, items sorted by
 * Spanish name.
 *
 * @param args - The kind, its catalog rows, the listing's selected ids and an optional single category
 * @returns The groups; categories with no row are omitted
 */
export function buildCatalogGroups(args: {
    readonly kind: CatalogKind;
    readonly rows: readonly CatalogRow[];
    readonly selectedIds: ReadonlySet<string>;
    readonly onlyCategory?: string | undefined;
}): AmenityGroup[] {
    const { kind, rows, selectedIds, onlyCategory } = args;
    const name = (slug: string): string =>
        kind === 'amenity'
            ? amenityLabel({ slug, locale: NAME_LOCALE }).label
            : featureLabel({ slug, locale: NAME_LOCALE }).label;
    return categoriesOf({ kind })
        .filter((category) => onlyCategory === undefined || category === onlyCategory)
        .map((category) => ({
            kind,
            category,
            label: categoryLabel({ kind, category }),
            items: rows
                .filter((row) => row.category === category)
                .map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: name(row.slug),
                    selected: selectedIds.has(row.id)
                }))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        }))
        .filter((group) => group.items.length > 0);
}
