import type { ActiveFilters, FilterBarConfig, FilterChipData } from './filter-types';

/** Sentinel value indicating a filter was explicitly cleared by the user */
export const FILTER_CLEARED_SENTINEL = '__cleared__' as const;

/**
 * Extract active filters from URL search params based on filterBarConfig.
 *
 * Handles three-state semantics per filter param:
 * - `undefined` / missing → apply `defaultValue` if the filter has one
 * - `FILTER_CLEARED_SENTINEL` → user explicitly cleared the filter; skip default
 * - any other string → user-selected value; use as-is
 *
 * @param input.searchParams - Raw URL search params (values may be any unknown type)
 * @param input.filterBarConfig - Filter bar configuration that declares all known filters
 * @returns Record of paramKey → active string value (only filters with a value are included)
 *
 * @example
 * ```ts
 * const active = extractActiveFilters({
 *   searchParams: { status: 'active', type: '__cleared__' },
 *   filterBarConfig: { filters: [
 *     { paramKey: 'status', type: 'select', labelKey: '...', options: [] },
 *     { paramKey: 'type', type: 'select', labelKey: '...', options: [], defaultValue: 'hotel' },
 *   ]},
 * });
 * // { status: 'active' }  — 'type' was cleared, no default applied
 * ```
 */
export const extractActiveFilters = ({
    searchParams,
    filterBarConfig
}: {
    readonly searchParams: Readonly<Record<string, unknown>>;
    readonly filterBarConfig: FilterBarConfig;
}): ActiveFilters => {
    const result: Record<string, string> = {};

    for (const filter of filterBarConfig.filters) {
        const rawValue = searchParams[filter.paramKey];

        if (rawValue === FILTER_CLEARED_SENTINEL) {
            // Explicitly cleared — do not apply default
            continue;
        }

        if (typeof rawValue === 'string' && rawValue !== '') {
            // User-selected value
            result[filter.paramKey] = rawValue;
        } else if (rawValue === undefined || rawValue === null || rawValue === '') {
            // No URL param — apply default if available
            if (filter.defaultValue !== undefined) {
                result[filter.paramKey] = filter.defaultValue;
            }
        }
    }

    return result;
};

/**
 * Compute default filter values from a FilterBarConfig.
 *
 * Returns only the filters that have a `defaultValue` defined.
 * Used to determine whether an active filter value matches its default
 * (e.g. for chip rendering decisions).
 *
 * @param input.filterBarConfig - Filter bar config; safe to pass `undefined` (returns `{}`)
 * @returns Record of paramKey → defaultValue for all filters that declare one
 *
 * @example
 * ```ts
 * const defaults = computeDefaultFilters({
 *   filterBarConfig: { filters: [
 *     { paramKey: 'status', type: 'select', labelKey: '...', defaultValue: 'active' },
 *     { paramKey: 'type',   type: 'select', labelKey: '...' },
 *   ]},
 * });
 * // { status: 'active' }
 * ```
 */
export const computeDefaultFilters = ({
    filterBarConfig
}: {
    readonly filterBarConfig?: FilterBarConfig;
}): ActiveFilters => {
    if (!filterBarConfig) return {};

    const result: Record<string, string> = {};
    for (const filter of filterBarConfig.filters) {
        if (filter.defaultValue !== undefined) {
            result[filter.paramKey] = filter.defaultValue;
        }
    }
    return result;
};

/**
 * Compare two ActiveFilters objects for shallow equality.
 *
 * Two filter maps are equal when they have the same set of keys and
 * every key maps to the same string value. Order of keys is irrelevant.
 *
 * @param a - First filter map
 * @param b - Second filter map
 * @returns `true` if both maps contain identical key-value pairs
 *
 * @example
 * ```ts
 * filtersEqual({ status: 'active' }, { status: 'active' }); // true
 * filtersEqual({ status: 'active' }, { status: 'draft' });  // false
 * filtersEqual({ status: 'active' }, {});                   // false
 * ```
 */
export const filtersEqual = (a: ActiveFilters, b: ActiveFilters): boolean => {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => a[key] === b[key]);
};

/**
 * Build a sorted array of FilterChipData from the current active filters.
 *
 * For each active filter:
 * - `select` filters look up the matching option and translate its label via `t`.
 * - `boolean` filters produce a translated "Yes" / "No" label.
 * - All other types use the raw string value as the display value.
 *
 * The result is sorted ascending by each filter's `order` field (defaulting to 0).
 * Filters present in `activeFilters` but absent from `filterBarConfig` are silently skipped.
 *
 * @param input.activeFilters - Current active filter values
 * @param input.filterBarConfig - Filter bar configuration (provides metadata and options)
 * @param input.defaultFilters - Pre-computed default values (see `computeDefaultFilters`)
 * @param input.t - Translation function that maps an i18n key to a display string
 * @returns Immutable, sorted array of chip data ready for rendering
 *
 * @example
 * ```ts
 * const chips = buildFilterChips({
 *   activeFilters: { status: 'active' },
 *   filterBarConfig: { filters: [
 *     { paramKey: 'status', type: 'select', labelKey: 'filters.status', order: 1,
 *       options: [{ value: 'active', labelKey: 'status.active' }] },
 *   ]},
 *   defaultFilters: { status: 'active' },
 *   t: (key) => key,
 * });
 * // [{ paramKey: 'status', labelKey: 'filters.status', value: 'active',
 * //    displayValue: 'status.active', isDefault: true }]
 * ```
 */
export const buildFilterChips = ({
    activeFilters,
    filterBarConfig,
    defaultFilters,
    t
}: {
    readonly activeFilters: ActiveFilters;
    readonly filterBarConfig: FilterBarConfig;
    readonly defaultFilters: ActiveFilters;
    readonly t: (key: string) => string;
}): readonly FilterChipData[] => {
    const chips: FilterChipData[] = [];

    for (const [paramKey, activeValue] of Object.entries(activeFilters)) {
        const config = filterBarConfig.filters.find((f) => f.paramKey === paramKey);
        if (!config) continue; // Unknown filter — skip

        let displayValue: string;

        if (config.type === 'select') {
            const option = config.options?.find((o) => o.value === activeValue);
            displayValue = option ? t(option.labelKey) : activeValue;
        } else if (config.type === 'boolean') {
            if (activeValue === 'true') {
                displayValue = t('admin-filters.booleanYes');
            } else if (activeValue === 'false') {
                displayValue = t('admin-filters.booleanNo');
            } else {
                displayValue = activeValue; // raw fallback for unexpected values
            }
        } else {
            displayValue = activeValue;
        }

        chips.push({
            paramKey,
            labelKey: config.labelKey,
            value: activeValue,
            displayValue,
            isDefault: defaultFilters[paramKey] === activeValue
        });
    }

    // Sort ascending by filter order (undefined order defaults to 0)
    chips.sort((a, b) => {
        const orderA = filterBarConfig.filters.find((f) => f.paramKey === a.paramKey)?.order ?? 0;
        const orderB = filterBarConfig.filters.find((f) => f.paramKey === b.paramKey)?.order ?? 0;
        return orderA - orderB;
    });

    return chips;
};

/**
 * Build URL search param updates for a single filter change.
 *
 * Three cases:
 * 1. `value` is a non-undefined string → set the param to that value.
 * 2. `value` is `undefined` and the filter has a default → set the param to
 *    `FILTER_CLEARED_SENTINEL` so the caller knows the user explicitly cleared it.
 * 3. `value` is `undefined` and the filter has no default → remove the param
 *    entirely (set to `undefined` in the returned object).
 *
 * The caller is responsible for merging the returned object into the existing
 * URL search params (removing keys whose value is `undefined`).
 *
 * @param input.paramKey - The URL search param key for this filter
 * @param input.value - The new value chosen by the user, or `undefined` to clear
 * @param input.hasDefault - Whether the filter declares a default value
 * @returns Partial param map to merge into the current URL params
 *
 * @example
 * ```ts
 * buildFilterParamUpdate({ paramKey: 'status', value: 'active', hasDefault: true });
 * // { status: 'active' }
 *
 * buildFilterParamUpdate({ paramKey: 'status', value: undefined, hasDefault: true });
 * // { status: '__cleared__' }
 *
 * buildFilterParamUpdate({ paramKey: 'type', value: undefined, hasDefault: false });
 * // { type: undefined }
 * ```
 */
export const buildFilterParamUpdate = ({
    paramKey,
    value,
    hasDefault
}: {
    readonly paramKey: string;
    readonly value: string | undefined;
    readonly hasDefault: boolean;
}): Record<string, string | undefined> => {
    if (value !== undefined) {
        return { [paramKey]: value };
    }

    // Clearing: use sentinel when a default exists, remove param otherwise
    if (hasDefault) {
        return { [paramKey]: FILTER_CLEARED_SENTINEL };
    }

    return { [paramKey]: undefined };
};
