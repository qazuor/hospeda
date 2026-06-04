/**
 * Supported filter control types.
 * - 'select' and 'boolean' were implemented in SPEC-054.
 * - 'number-range' and 'date-range' were added in SPEC-185 Phase 1.
 * - 'relation' remains deferred to a future spec.
 */
export type FilterControlType = 'select' | 'boolean' | 'number-range' | 'date-range';

/**
 * Base configuration shared by all filter control types.
 */
type BaseFilterConfig = {
    /** Unique key matching the API query parameter name (e.g., 'destinationType', 'status') */
    readonly paramKey: string;
    /** i18n key for the filter label */
    readonly labelKey: string;
    /** Default value applied when no user selection exists. If set, this filter is a "default filter". */
    readonly defaultValue?: string;
    /** Display order (lower = first). Defaults to 0. */
    readonly order?: number;
};

/**
 * Configuration for a select filter control with enumerable options.
 */
export type SelectFilterConfig = BaseFilterConfig & {
    /** Discriminant: select filter type */
    readonly type: 'select';
    /** List of available options. Required for select filters. */
    readonly options: ReadonlyArray<{
        readonly value: string;
        readonly labelKey: string;
        /** Optional icon identifier for the option */
        readonly icon?: string;
    }>;
    /** i18n key for the "all" option. Defaults to "admin-filters.allOption" */
    readonly allLabelKey?: string;
};

/**
 * Configuration for a boolean filter control (Yes/No/All).
 */
export type BooleanFilterConfig = BaseFilterConfig & {
    /** Discriminant: boolean filter type */
    readonly type: 'boolean';
};

/**
 * Configuration for a number-range filter control (SPEC-185).
 *
 * Each range serializes as two independent URL params (`paramKeyMin` / `paramKeyMax`),
 * each independently clearable via the existing `FILTER_CLEARED_SENTINEL` 3-state model.
 * An absent bound is omitted from the API request.
 *
 * @example
 * ```ts
 * const priceRange: NumberRangeFilterConfig = {
 *   type: 'number-range',
 *   paramKey: 'price',       // Used for the label and order lookup
 *   labelKey: 'admin-filters.price.label',
 *   paramKeyMin: 'minPrice', // Backend param name for the lower bound
 *   paramKeyMax: 'maxPrice', // Backend param name for the upper bound
 *   min: 0,
 *   step: 100,
 *   unitLabelKey: 'admin-filters.unit.ars',
 * };
 * ```
 */
export type NumberRangeFilterConfig = Omit<BaseFilterConfig, 'paramKey'> & {
    /** Discriminant: number-range filter type */
    readonly type: 'number-range';
    /**
     * Logical key used for label, ordering, and active-filter tracking.
     * Does NOT correspond to a single URL param (the range uses two params).
     */
    readonly paramKey: string;
    /** URL param name for the lower bound (e.g. 'minPrice'). Aligns with backend schema. */
    readonly paramKeyMin: string;
    /** URL param name for the upper bound (e.g. 'maxPrice'). Aligns with backend schema. */
    readonly paramKeyMax: string;
    /** Optional HTML min attribute for the number inputs */
    readonly min?: number;
    /** Optional HTML max attribute for the number inputs */
    readonly max?: number;
    /** Optional HTML step attribute for the number inputs (default 1) */
    readonly step?: number;
    /**
     * Optional i18n key for the unit label displayed alongside the inputs
     * (e.g. 'admin-filters.unit.ars' → "ARS"). Useful for money columns
     * stored as integer centavos.
     */
    readonly unitLabelKey?: string;
};

/**
 * Configuration for a date-range filter control (SPEC-185).
 *
 * Each range serializes as two independent URL params (`paramKeyFrom` / `paramKeyTo`)
 * using ISO `YYYY-MM-DD` date strings, each independently clearable.
 *
 * @example
 * ```ts
 * const createdAtRange: DateRangeFilterConfig = {
 *   type: 'date-range',
 *   paramKey: 'createdAt',
 *   labelKey: 'admin-filters.createdAt.label',
 *   paramKeyFrom: 'createdAfter',  // Backend param name for the lower bound
 *   paramKeyTo: 'createdBefore',   // Backend param name for the upper bound
 * };
 * ```
 */
export type DateRangeFilterConfig = Omit<BaseFilterConfig, 'paramKey'> & {
    /** Discriminant: date-range filter type */
    readonly type: 'date-range';
    /**
     * Logical key used for label, ordering, and active-filter tracking.
     * Does NOT correspond to a single URL param (the range uses two params).
     */
    readonly paramKey: string;
    /** URL param name for the start/from bound (ISO YYYY-MM-DD). Aligns with backend schema. */
    readonly paramKeyFrom: string;
    /** URL param name for the end/to bound (ISO YYYY-MM-DD). Aligns with backend schema. */
    readonly paramKeyTo: string;
};

/**
 * Configuration for a single filter control in the filter bar.
 * Discriminated union on the `type` field.
 */
export type FilterControlConfig =
    | SelectFilterConfig
    | BooleanFilterConfig
    | NumberRangeFilterConfig
    | DateRangeFilterConfig;

/** Sentinel value used for the "All" option in Radix Select, which does not support empty strings. */
export const FILTER_ALL_VALUE = '__all__' as const;

/**
 * Configuration for the entire filter bar of an entity.
 */
export type FilterBarConfig = {
    /** List of filter controls to render */
    readonly filters: ReadonlyArray<FilterControlConfig>;
};

/**
 * Active filter values, keyed by paramKey.
 * Values are always strings (URL-serializable).
 * Boolean filters use 'true'/'false' strings.
 */
export type ActiveFilters = Readonly<Record<string, string>>;

/**
 * Computed filter state with metadata for rendering.
 */
export type FilterChipData = {
    readonly paramKey: string;
    readonly labelKey: string;
    readonly value: string;
    /** Translated display value for the chip */
    readonly displayValue: string;
    /** Whether this filter value originated from a default */
    readonly isDefault: boolean;
};
