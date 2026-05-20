/**
 * Type definitions for the post listing summary builder.
 *
 * Mirrors `event-listing-summary/summary.types` but with the post-specific
 * filter shape (text, category, destinationId, publishedAfter/Before,
 * isFeatured). Posts have no pricing or temporal "when" chip, so those
 * descriptors are absent here.
 */

/** Supported locales for summary generation. */
export type SummaryLocale = 'es' | 'en';

/** Sort order direction. */
export type SortDirection = 'asc' | 'desc';

/**
 * Filters applied to a post listing. All fields are optional — only active
 * filters contribute to the summary.
 */
export interface PostSummaryFilters {
    /** Free-text search string (matches against title + content). */
    readonly text?: string | null;
    /** Single category key (e.g. 'CULTURE', 'GASTRONOMY'). */
    readonly category?: string | null;
    /** Destination UUID — resolved to a label via the destinations catalog. */
    readonly destinationId?: string | null;
    /** ISO yyyy-mm-dd lower bound on `publishedAt`. */
    readonly publishedAfter?: string | null;
    /** ISO yyyy-mm-dd upper bound on `publishedAt`. */
    readonly publishedBefore?: string | null;
    /** Featured-only toggle. */
    readonly isFeatured?: boolean | null;
}

/** Encoded sort key from the URL (e.g. 'newest', 'mostSaved', 'titleAsc'). */
export interface PostSort {
    readonly sortKey: string;
}

/** A catalog entry mapping a key to a localized label. */
export interface CatalogEntry {
    readonly key: string;
    readonly label: Record<SummaryLocale, string>;
}

/** Catalogs for resolving filter keys to human-readable labels. */
export interface SummaryCatalogs {
    /** Destination label entries keyed by UUID. */
    readonly destinations?: readonly CatalogEntry[];
    /** Post category label entries keyed by enum value. */
    readonly categories?: readonly CatalogEntry[];
}

/** Shown / total counts for the listing. */
export interface SummaryCounts {
    readonly shown: number;
    readonly total: number;
}

/** Behavioral options. Reserved for future use; no-op today. */
export type SummaryOptions = Record<string, never>;

/** Input for {@link buildPostListingSummary}. */
export interface BuildPostListingSummaryInput {
    readonly locale?: SummaryLocale;
    readonly filters: PostSummaryFilters;
    readonly counts: SummaryCounts;
    readonly sort?: PostSort | null;
    readonly catalogs?: SummaryCatalogs;
    readonly options?: SummaryOptions;
}

/** Resolved context handed to every descriptor's `build` call. */
export interface FilterDescriptorContext {
    readonly locale: SummaryLocale;
    readonly intlLocale: string;
    readonly filters: PostSummaryFilters;
    readonly catalogs: SummaryCatalogs;
    readonly options: SummaryOptions;
}

/** One composable filter description unit. */
export interface FilterDescriptor {
    readonly key: string;
    readonly isActive: (input: { readonly filters: PostSummaryFilters }) => boolean;
    readonly build: (input: { readonly context: FilterDescriptorContext }) => string;
}
