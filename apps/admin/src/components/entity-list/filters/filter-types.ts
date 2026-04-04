/**
 * Supported filter control types.
 * 'select' and 'boolean' are implemented in SPEC-054.
 * Additional types ('relation', 'number-range', 'date-range') will be
 * defined in future specs when implemented.
 */
type FilterControlType = 'select' | 'boolean';

/**
 * Configuration for a single filter control in the filter bar.
 * Uses a flat type with optional fields per filter type,
 * discriminated by the `type` field.
 */
export type FilterControlConfig = {
    /** Unique key matching the API query parameter name (e.g., 'destinationType', 'status') */
    readonly paramKey: string;
    /** i18n key for the filter label */
    readonly labelKey: string;
    /** Type of filter control to render */
    readonly type: FilterControlType;
    /** For select type: list of available options. Required when type is 'select'. */
    readonly options?: ReadonlyArray<{
        readonly value: string;
        readonly labelKey: string;
        /** Optional icon identifier for the option */
        readonly icon?: string;
    }>;
    /** For select type: i18n key for the "all" option. Defaults to "admin-filters.allOption" */
    readonly allLabelKey?: string;
    /** Default value applied when no user selection exists. If set, this filter is a "default filter". */
    readonly defaultValue?: string;
    /** Display order (lower = first). Defaults to 0. */
    readonly order?: number;
};

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
