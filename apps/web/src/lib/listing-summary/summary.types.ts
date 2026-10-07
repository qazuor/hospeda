/**
 * Type definitions for the listing summary builder.
 *
 * Shared by the gastronomy and experience listing pages (BETA-119). Both
 * entities have near-identical filter shapes (text, single type/category,
 * destination, minRating) and IDENTICAL sort options
 * (ratingDesc | newest | nameAsc) — only the subject noun
 * (with its grammatical gender) and the optional `priceRange` facet
 * (gastronomy-only) differ. Rather than duplicating the full
 * types/catalogs/descriptors/builder set twice (as `post-listing-summary`
 * and `event-listing-summary` do per-entity), this module parametrizes a
 * single builder via {@link ListingEntityConfig} and exposes thin
 * per-entity wrappers from `index.ts`.
 */

/** Supported locales for summary generation. Portuguese falls back to `es` at the call site, mirroring `post-listing-summary` / `event-listing-summary`. */
export type SummaryLocale = 'es' | 'en';

/** Grammatical gender of the entity's subject noun, driving "ordenados/ordenadas" and "solo destacados/destacadas" agreement in Spanish. */
export type EntityGender = 'masculine' | 'feminine';

/** A catalog entry mapping a key to a localized label. */
export interface CatalogEntry {
    readonly key: string;
    readonly label: Record<SummaryLocale, string>;
}

/** Catalogs for resolving filter keys to human-readable labels. */
export interface SummaryCatalogs {
    /** Destination label entries keyed by UUID. */
    readonly destinations?: readonly CatalogEntry[];
    /** Entity type/category label entries keyed by enum value. */
    readonly types?: readonly CatalogEntry[];
    /** Price-range label entries keyed by enum value (gastronomy only). */
    readonly priceRanges?: readonly CatalogEntry[];
}

/**
 * Filters applied to a listing. All fields are optional — only
 * active filters contribute to the summary. Both gastronomy and experience
 * pages read these as single (non-multi) URL query params.
 */
export interface ListingSummaryFilters {
    /** Free-text search string (matches against name + description). */
    readonly text?: string | null;
    /** Single type/category key (e.g. 'RESTAURANT', 'TOUR_GUIDE'). */
    readonly type?: string | null;
    /** Destination UUID — resolved to a label via the destinations catalog. */
    readonly destinationId?: string | null;
    /** Categorical price range (e.g. 'BUDGET', 'PREMIUM'). Gastronomy only. */
    readonly priceRange?: string | null;
    /** Minimum star rating (1-5, may include a decimal). */
    readonly minRating?: number | null;
}

/** Encoded sort key from the URL (`ratingDesc` | `newest` | `nameAsc`). */
export interface ListingSort {
    readonly sortKey: string;
}

/** Shown / total counts for the listing. */
export interface SummaryCounts {
    readonly shown: number;
    readonly total: number;
}

/**
 * Fixed per-entity configuration: the subject noun (singular/plural, in both
 * locales), its grammatical gender, and whether the `priceRange` facet
 * applies. Supplied by the thin per-entity wrapper functions in `index.ts` —
 * page authors never construct this directly.
 */
export interface ListingEntityConfig {
    readonly gender: EntityGender;
    readonly subjectSingular: Record<SummaryLocale, string>;
    readonly subjectPlural: Record<SummaryLocale, string>;
    readonly hasPriceRange: boolean;
}

/** Input for {@link buildListingSummary}. */
export interface BuildListingSummaryInput {
    readonly locale?: SummaryLocale;
    readonly entity: ListingEntityConfig;
    readonly filters: ListingSummaryFilters;
    readonly counts: SummaryCounts;
    readonly sort?: ListingSort | null;
    readonly catalogs?: SummaryCatalogs;
}

/** Resolved context handed to every descriptor's `build` call. */
export interface FilterDescriptorContext {
    readonly locale: SummaryLocale;
    readonly filters: ListingSummaryFilters;
    readonly catalogs: SummaryCatalogs;
    readonly entity: ListingEntityConfig;
}

/** One composable filter description unit. */
export interface FilterDescriptor {
    readonly key: string;
    readonly isActive: (input: {
        readonly filters: ListingSummaryFilters;
        readonly entity: ListingEntityConfig;
    }) => boolean;
    readonly build: (input: { readonly context: FilterDescriptorContext }) => string;
}
