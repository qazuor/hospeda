/**
 * @file FilterBar component
 *
 * Main container for the entity list filter bar.
 * Renders filter controls, active filter chips, and action buttons.
 */

import { useMemo } from 'react';
import { ActiveFilterChips } from './ActiveFilterChips';
import { FilterActions } from './FilterActions';
import { FilterBoolean } from './FilterBoolean';
import { FilterSelect } from './FilterSelect';
import type { ActiveFilters, FilterBarConfig, FilterChipData } from './filter-types';

type FilterBarProps = {
    readonly config: FilterBarConfig;
    readonly activeFilters: ActiveFilters;
    readonly onFilterChange: (paramKey: string, value: string | undefined) => void;
    readonly onClearAll: () => void;
    readonly onResetDefaults: () => void;
    readonly hasActiveFilters: boolean;
    readonly hasNonDefaultFilters: boolean;
    readonly chips: ReadonlyArray<FilterChipData>;
};

/**
 * FilterBar
 *
 * Main container for the entity list filter bar. Composes FilterSelect,
 * FilterBoolean, ActiveFilterChips, and FilterActions into a cohesive layout.
 *
 * Filter controls are sorted by their `order` field (ascending, default 0).
 * Unknown filter types are silently skipped without throwing.
 *
 * Layout:
 * - Controls row: flex-wrap with gap-2, filter dropdowns and action buttons inline.
 * - Chips row: rendered below the controls row when at least one chip is present.
 *
 * @param config - FilterBarConfig describing which controls to render
 * @param activeFilters - Current filter values keyed by paramKey
 * @param onFilterChange - Callback to set or clear a single filter value
 * @param onClearAll - Callback to remove all active filters
 * @param onResetDefaults - Callback to restore all filters to their defaults
 * @param hasActiveFilters - Whether any filter is currently active
 * @param hasNonDefaultFilters - Whether any filter differs from its default
 * @param chips - Precomputed chip data for active filters (from useFilterState)
 *
 * @example
 * ```tsx
 * <FilterBar
 *   config={filterBarConfig}
 *   activeFilters={activeFilters}
 *   onFilterChange={handleFilterChange}
 *   onClearAll={handleClearAll}
 *   onResetDefaults={handleResetDefaults}
 *   hasActiveFilters={hasActiveFilters}
 *   hasNonDefaultFilters={hasNonDefaultFilters}
 *   chips={chips}
 * />
 * ```
 */
export function FilterBar({
    config,
    activeFilters,
    onFilterChange,
    onClearAll,
    onResetDefaults,
    hasActiveFilters,
    hasNonDefaultFilters,
    chips
}: FilterBarProps) {
    const sortedFilters = useMemo(
        () => [...config.filters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [config]
    );

    return (
        <div className="mb-3 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
                {sortedFilters.map((filterConfig) => {
                    const value = activeFilters[filterConfig.paramKey];

                    if (filterConfig.type === 'select') {
                        return (
                            <FilterSelect
                                key={filterConfig.paramKey}
                                config={filterConfig}
                                value={value}
                                onChange={(val) => onFilterChange(filterConfig.paramKey, val)}
                            />
                        );
                    }

                    if (filterConfig.type === 'boolean') {
                        return (
                            <FilterBoolean
                                key={filterConfig.paramKey}
                                config={filterConfig}
                                value={value}
                                onChange={(val) => onFilterChange(filterConfig.paramKey, val)}
                            />
                        );
                    }

                    return null;
                })}

                <FilterActions
                    hasActiveFilters={hasActiveFilters}
                    hasNonDefaultFilters={hasNonDefaultFilters}
                    onClearAll={onClearAll}
                    onResetDefaults={onResetDefaults}
                />
            </div>

            {hasActiveFilters && (
                <div className="pt-2">
                    <ActiveFilterChips
                        chips={chips}
                        onRemove={(paramKey) => onFilterChange(paramKey, undefined)}
                    />
                </div>
            )}
        </div>
    );
}
