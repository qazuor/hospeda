/**
 * Supported filter control types.
 * 'select' and 'boolean' are implemented in SPEC-054.
 * Additional types ('relation', 'number-range', 'date-range') will be
 * defined in future specs when implemented.
 */
export type FilterControlType = 'select' | 'boolean';

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
 * Configuration for a single filter control in the filter bar.
 * Discriminated union on the `type` field.
 */
export type FilterControlConfig = SelectFilterConfig | BooleanFilterConfig;

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
