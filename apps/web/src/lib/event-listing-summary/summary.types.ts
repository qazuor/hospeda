/**
 * Type definitions for the event listing summary builder.
 *
 * Mirrors `accommodation-listing-summary/summary.types` but with the
 * event-specific filter shape. See sibling builder file for usage.
 */

/** Supported locales for summary generation. */
export type SummaryLocale = 'es' | 'en';

/** Sort order direction. */
export type SortDirection = 'asc' | 'desc';

/**
 * Filters applied to an event listing. All fields are optional — only active
 * filters contribute to the summary.
 */
export interface EventSummaryFilters {
    /** Free-text search string. */
    readonly text?: string | null;
    /** Single category key (e.g. 'MUSIC', 'CULTURE'). */
    readonly category?: string | null;
    /** Destination UUID — resolved to a label via the destinations catalog. */
    readonly destinationId?: string | null;
    /** ISO yyyy-mm-dd lower bound on event start date. */
    readonly startDateAfter?: string | null;
    /** ISO yyyy-mm-dd upper bound on event start date. */
    readonly startDateBefore?: string | null;
    /** Temporal quick-filter chip (today / week / month / next60 / past). */
    readonly when?: 'today' | 'week' | 'month' | 'next60' | 'past' | 'all' | null;
    /** Free-only toggle. */
    readonly isFree?: boolean | null;
    /** Price range. */
    readonly price?: {
        readonly min?: number | null;
        readonly max?: number | null;
    } | null;
    /**
     * Whether events with NULL pricing are included. Default is `true` for
     * events, so we only describe it when the user explicitly turned it OFF.
     */
    readonly includeUnpriced?: boolean | null;
    /** Featured-only toggle. */
    readonly isFeatured?: boolean | null;
}

/** Encoded sort key from the URL (e.g. 'upcoming', 'newest', 'nameAsc'). */
export interface EventSort {
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
    /** Event category label entries keyed by enum value. */
    readonly categories?: readonly CatalogEntry[];
}

/** Shown / total counts for the listing. */
export interface SummaryCounts {
    readonly shown: number;
    readonly total: number;
}

/** Behavioral options. */
export interface SummaryOptions {
    /** ISO 4217 currency override (default ARS / USD per locale). */
    readonly currency?: string;
}

/** Input for {@link buildEventListingSummary}. */
export interface BuildEventListingSummaryInput {
    readonly locale?: SummaryLocale;
    readonly filters: EventSummaryFilters;
    readonly counts: SummaryCounts;
    readonly sort?: EventSort | null;
    readonly catalogs?: SummaryCatalogs;
    readonly options?: SummaryOptions;
}

/** Resolved context handed to every descriptor's `build` call. */
export interface FilterDescriptorContext {
    readonly locale: SummaryLocale;
    readonly intlLocale: string;
    readonly filters: EventSummaryFilters;
    readonly catalogs: SummaryCatalogs;
    readonly options: SummaryOptions;
}

/** One composable filter description unit. */
export interface FilterDescriptor {
    readonly key: string;
    readonly isActive: (input: { readonly filters: EventSummaryFilters }) => boolean;
    readonly build: (input: { readonly context: FilterDescriptorContext }) => string;
}
