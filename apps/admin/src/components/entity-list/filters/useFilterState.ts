import { useTranslations } from '@/hooks/use-translations';
import { useCallback, useMemo } from 'react';
import type { ActiveFilters, FilterBarConfig, FilterChipData } from './filter-types';
import {
    FILTER_CLEARED_SENTINEL,
    buildFilterChips,
    buildFilterParamUpdate,
    computeDefaultFilters,
    extractActiveFilters,
    filtersEqual
} from './filter-utils';

/**
 * Parameters for the useFilterState hook.
 */
type UseFilterStateParams = {
    /** Configuration for the filter bar, including filter definitions and defaults. */
    readonly filterBarConfig: FilterBarConfig | undefined;
    /** Current URL search params as a plain record. */
    readonly searchParams: Record<string, unknown>;
    /**
     * Callback to update search params.
     * Receives an updater function that takes previous params and returns new params.
     */
    readonly onUpdateSearch: (
        updater: (prev: Record<string, unknown>) => Record<string, unknown>
    ) => void;
};

/**
 * Return value of the useFilterState hook.
 */
type UseFilterStateReturn = {
    /** Active filters derived from URL params and defaults. */
    readonly activeFilters: ActiveFilters;
    /** Pre-computed default filter values from config. */
    readonly computedDefaults: ActiveFilters;
    /** True when at least one filter key is present in activeFilters. */
    readonly hasActiveFilters: boolean;
    /** True when activeFilters differ from computedDefaults. */
    readonly hasNonDefaultFilters: boolean;
    /** Chip data ready to render, sorted by filter order. */
    readonly chips: ReadonlyArray<FilterChipData>;
    /**
     * Handle a single filter change.
     * Always resets pagination to page 1.
     *
     * @param paramKey - The URL param key of the filter being changed.
     * @param value - New value, or undefined to clear.
     */
    readonly handleFilterChange: (paramKey: string, value: string | undefined) => void;
    /**
     * Clear all filters, including default-valued ones (uses sentinels for defaults).
     * Resets pagination to page 1.
     */
    readonly handleClearAll: () => void;
    /**
     * Reset all filters back to their default values.
     * Filters without defaults are removed. Resets pagination to page 1.
     */
    readonly handleResetDefaults: () => void;
};

const EMPTY_FILTERS: ActiveFilters = {};
const EMPTY_CHIPS: readonly FilterChipData[] = [];

/**
 * Manages filter state for an entity list page.
 *
 * Derives active filters from URL search params, builds chip data for rendering,
 * and provides stable callbacks for filter interactions. All changes reset
 * the pagination page to 1.
 *
 * Three-state semantics per filter:
 * - Missing/undefined param → apply `defaultValue` if declared in config
 * - `FILTER_CLEARED_SENTINEL` → user explicitly cleared; skip default
 * - Any other string → user-selected value
 *
 * @param params - Hook parameters (filterBarConfig, searchParams, onUpdateSearch)
 * @returns Derived filter state and interaction handlers
 *
 * @example
 * ```tsx
 * const {
 *   activeFilters,
 *   chips,
 *   hasNonDefaultFilters,
 *   handleFilterChange,
 *   handleClearAll,
 *   handleResetDefaults,
 * } = useFilterState({
 *   filterBarConfig,
 *   searchParams,
 *   onUpdateSearch: (updater) => navigate({ search: updater }),
 * });
 * ```
 */
export const useFilterState = ({
    filterBarConfig,
    searchParams,
    onUpdateSearch
}: UseFilterStateParams): UseFilterStateReturn => {
    const { t } = useTranslations();

    // Compute default filter values from config (stable unless config reference changes)
    const computedDefaults = useMemo(
        () => computeDefaultFilters({ filterBarConfig }),
        [filterBarConfig]
    );

    // Extract active filters from URL params + defaults
    const activeFilters = useMemo(() => {
        if (!filterBarConfig) return EMPTY_FILTERS;
        return extractActiveFilters({ searchParams, filterBarConfig });
    }, [searchParams, filterBarConfig]);

    // Build chip data for rendering
    const chips = useMemo(() => {
        if (!filterBarConfig) return EMPTY_CHIPS;
        return buildFilterChips({
            activeFilters,
            filterBarConfig,
            defaultFilters: computedDefaults,
            // Filter labelKeys are arbitrary config strings, not compile-time TranslationKeys
            // biome-ignore lint/suspicious/noExplicitAny: config keys are not in the TranslationKey union
            t: (key: string) => t(key as any)
        });
    }, [activeFilters, filterBarConfig, computedDefaults, t]);

    // Derived booleans
    const hasActiveFilters = Object.keys(activeFilters).length > 0;

    const hasNonDefaultFilters = useMemo(
        () => !filtersEqual(activeFilters, computedDefaults),
        [activeFilters, computedDefaults]
    );

    // Handle individual filter change - ALWAYS resets page to 1
    const handleFilterChange = useCallback(
        (paramKey: string, value: string | undefined) => {
            const filterConfig = filterBarConfig?.filters.find((f) => f.paramKey === paramKey);
            const hasDefault = filterConfig?.defaultValue !== undefined;
            const paramUpdate = buildFilterParamUpdate({ paramKey, value, hasDefault });

            onUpdateSearch((prev) => ({
                ...prev,
                ...paramUpdate,
                page: 1
            }));
        },
        [filterBarConfig, onUpdateSearch]
    );

    // Clear ALL filters (including defaults) - use sentinels for filters that have defaults
    const handleClearAll = useCallback(() => {
        if (!filterBarConfig) return;

        onUpdateSearch((prev) => {
            const updates: Record<string, string | number | undefined> = { page: 1 };

            for (const filter of filterBarConfig.filters) {
                if (filter.defaultValue !== undefined) {
                    updates[filter.paramKey] = FILTER_CLEARED_SENTINEL;
                } else {
                    updates[filter.paramKey] = undefined;
                }
            }

            return { ...prev, ...updates };
        });
    }, [filterBarConfig, onUpdateSearch]);

    // Reset to default values - restores each filter to its declared defaultValue
    const handleResetDefaults = useCallback(() => {
        if (!filterBarConfig) return;

        onUpdateSearch((prev) => {
            const updates: Record<string, string | number | undefined> = { page: 1 };

            for (const filter of filterBarConfig.filters) {
                if (filter.defaultValue !== undefined) {
                    updates[filter.paramKey] = filter.defaultValue;
                } else {
                    updates[filter.paramKey] = undefined;
                }
            }

            return { ...prev, ...updates };
        });
    }, [filterBarConfig, onUpdateSearch]);

    return {
        activeFilters,
        computedDefaults,
        hasActiveFilters,
        hasNonDefaultFilters,
        chips,
        handleFilterChange,
        handleClearAll,
        handleResetDefaults
    };
};
