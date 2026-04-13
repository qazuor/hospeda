/**
 * Type definitions for the accommodation listing summary builder.
 *
 * This module transforms applied filters, counts, and sort options into
 * human-readable summary phrases.
 */

/** Supported locales for summary generation. */
export type SummaryLocale = 'es' | 'en';

/** How multiple values in a filter are combined. */
export type MatchMode = 'any' | 'all';

/** Whether a numeric filter means "at least N" or "exactly N". */
export type QuantityMode = 'atLeast' | 'exact';

/** Sort order direction. */
export type SortDirection = 'asc' | 'desc';

/** Semantic type of a sort key for phrase selection. */
export type SortType = 'alpha' | 'numeric' | 'date' | 'boolean';

/**
 * Filters applied to an accommodation listing.
 * All fields are optional — only active filters contribute to the summary.
 */
export interface AccommodationSummaryFilters {
    /** Accommodation type keys (e.g. 'HOTEL', 'CABIN'). */
    readonly types?: readonly string[];
    /** Free-text search string. */
    readonly text?: string | null;
    /** Price range filter. */
    readonly price?: {
        readonly min?: number | string | null;
        readonly max?: number | string | null;
        /** Whether results without a defined price are included. */
        readonly includeWithoutPrice?: boolean | null;
    } | null;
    /** Destination keys (e.g. 'colon', 'concordia'). */
    readonly destinations?: readonly string[];
    /** Minimum guest count. */
    readonly guests?: number | string | null;
    /** Service keys (e.g. 'desayuno', 'limpieza'). */
    readonly services?: readonly string[];
    /** Amenity keys (e.g. 'wifi', 'pileta'). */
    readonly amenities?: readonly string[];
    /** Minimum average rating. */
    readonly minRating?: number | string | null;
    /** Whether results without a rating are included. */
    readonly includeWithoutRating?: boolean | null;
    /** Minimum bedroom count. */
    readonly bedrooms?: number | string | null;
    /** Minimum bathroom count. */
    readonly bathrooms?: number | string | null;
    /** Featured-only filter. `true` = only featured, `false` = only non-featured. */
    readonly featured?: boolean | null;
}

/** Sort configuration applied to the listing. */
export interface AccommodationSort {
    /** Sort key identifier (e.g. 'name', 'price', 'averageRating'). */
    readonly key: string;
    /** Sort direction. */
    readonly direction: SortDirection;
}

/**
 * Grammar entry for a single accommodation type.
 * Provides singular/plural labels in each supported locale.
 */
export interface TypeGrammarEntry {
    /** Type key matching the filter value (e.g. 'HOTEL', 'CABIN'). */
    readonly key: string;
    /** Singular label per locale. */
    readonly singular: Record<SummaryLocale, string>;
    /** Plural label per locale. */
    readonly plural: Record<SummaryLocale, string>;
}

/**
 * Configuration for a single sort key, including directional phrase labels.
 */
export interface SortKeyEntry {
    /** Sort key identifier. */
    readonly key: string;
    /** Semantic type controlling phrase selection. */
    readonly type: SortType;
    /** Human-readable label for the sort field per locale. */
    readonly label: Record<SummaryLocale, string>;
    /** Phrase describing ascending order per locale. */
    readonly asc: Record<SummaryLocale, string>;
    /** Phrase describing descending order per locale. */
    readonly desc: Record<SummaryLocale, string>;
}

/** A single catalog entry mapping a key to a human-readable label. */
export interface CatalogEntry {
    readonly key: string;
    readonly label: Record<SummaryLocale, string>;
}

/**
 * Optional catalogs for resolving keys to human-readable labels.
 * When omitted, raw keys are used as fallback labels.
 */
export interface SummaryCatalogs {
    /** Type grammar entries for subject resolution. */
    readonly types?: readonly TypeGrammarEntry[];
    /** Destination label entries. */
    readonly destinations?: readonly CatalogEntry[];
    /** Service label entries. */
    readonly services?: readonly CatalogEntry[];
    /** Amenity label entries. */
    readonly amenities?: readonly CatalogEntry[];
    /** Sort key entries for sort phrase generation. */
    readonly sortKeys?: readonly SortKeyEntry[];
}

/**
 * Behavioral options controlling how the summary is built.
 */
export interface SummaryOptions {
    /** ISO 4217 currency code for price formatting (default: ARS for 'es', USD for 'en'). */
    readonly currency?: string;
    /** BCP 47 locale string override for number/currency formatting. */
    readonly numberLocale?: string;
    /** How multi-value filters are combined in prose. */
    readonly matchMode?: {
        readonly services?: MatchMode;
        readonly amenities?: MatchMode;
        readonly destinations?: MatchMode;
    };
    /** Whether numeric filters mean "at least" or "exactly". */
    readonly quantityMode?: {
        readonly guests?: QuantityMode;
        readonly bedrooms?: QuantityMode;
        readonly bathrooms?: QuantityMode;
    };
    /**
     * Maximum number of types to list individually in the subject.
     * When the selected type count exceeds this value the subject degrades to
     * the generic "hospedajes" / "accommodations" phrase.
     * Default: 3.
     */
    readonly maxTypesInSubjectList?: number;
}

/** Result and total counts for the listing. */
export interface SummaryCounts {
    /** Number of results shown in the current page/view. */
    readonly shown: number;
    /** Total number of results across ALL accommodation types (global). */
    readonly globalTotal: number;
    /**
     * Total number of results matching only the selected types.
     * Required for specific-subject summaries; when absent the subject
     * degrades to generic "hospedajes" to avoid misleading counts.
     */
    readonly subjectTotal?: number | null;
}

/** Input for the main summary builder function. */
export interface BuildAccommodationListingSummaryInput {
    /** Output locale. Defaults to 'es'. */
    readonly locale?: SummaryLocale;
    /** Active filters to describe. */
    readonly filters: AccommodationSummaryFilters;
    /** Shown and total counts. */
    readonly counts: SummaryCounts;
    /** Active sort configuration. */
    readonly sort?: AccommodationSort | null;
    /** Label catalogs for resolving filter keys to human-readable text. */
    readonly catalogs?: SummaryCatalogs;
    /** Behavioral options. */
    readonly options?: SummaryOptions;
}

/**
 * Resolved context passed to each `FilterDescriptor.build` call.
 * All defaults have been applied at this point.
 */
export interface FilterDescriptorContext {
    readonly locale: SummaryLocale;
    /** BCP 47 locale resolved for Intl formatting. */
    readonly intlLocale: string;
    readonly filters: AccommodationSummaryFilters;
    readonly catalogs: SummaryCatalogs;
    readonly options: Required<Pick<SummaryOptions, 'matchMode' | 'quantityMode'>> & SummaryOptions;
}

/**
 * Describes a single filter as an isolated, composable unit.
 * Each descriptor is responsible for detecting whether its filter is active
 * and for building the corresponding prose fragment.
 */
export interface FilterDescriptor {
    /** Unique identifier for this descriptor. */
    readonly key: string;
    /**
     * Returns `true` when this filter contributes to the summary.
     * @param input - Object containing the current filters.
     */
    readonly isActive: (input: { readonly filters: AccommodationSummaryFilters }) => boolean;
    /**
     * Builds the prose fragment for this filter.
     * Only called when `isActive` returns `true`.
     * @param input - Object containing the resolved descriptor context.
     */
    readonly build: (input: { readonly context: FilterDescriptorContext }) => string;
}
