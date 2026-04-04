/**
 * @file FilterActions component
 *
 * Action buttons for the filter bar: "Clear all" and "Reset to defaults".
 * Buttons are conditionally visible based on the current filter state.
 */

import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import { CloseIcon, RotateCcwIcon } from '@repo/icons';

/**
 * Props for the FilterActions component.
 */
export interface FilterActionsProps {
    /** Whether any filter is currently active (controls visibility of "Clear all") */
    readonly hasActiveFilters: boolean;
    /** Whether any filter differs from its default value (controls visibility of "Reset to defaults") */
    readonly hasNonDefaultFilters: boolean;
    /** Called when the user clicks "Clear all" */
    readonly onClearAll: () => void;
    /** Called when the user clicks "Reset to defaults" */
    readonly onResetDefaults: () => void;
}

/**
 * FilterActions
 *
 * Renders up to two action buttons at the end of a filter bar:
 * - "Clear all": visible when any filter is active. Resets everything to undefined.
 * - "Reset to defaults": visible when any filter differs from its configured default.
 *   Restores every filter to the value defined in its FilterControlConfig.defaultValue.
 *
 * Both buttons use `variant="ghost"` and `size="sm"` for a low-profile appearance
 * that does not compete visually with the filter dropdowns.
 *
 * @example
 * ```tsx
 * <FilterActions
 *   hasActiveFilters={Object.keys(activeFilters).length > 0}
 *   hasNonDefaultFilters={hasNonDefaultFilters}
 *   onClearAll={clearAllFilters}
 *   onResetDefaults={resetToDefaults}
 * />
 * ```
 */
export function FilterActions({
    hasActiveFilters,
    hasNonDefaultFilters,
    onClearAll,
    onResetDefaults
}: FilterActionsProps) {
    const { t } = useTranslations();

    return (
        <div className="flex items-center gap-1">
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    leftIcon={<CloseIcon className="h-3.5 w-3.5" />}
                >
                    {t('admin-filters.clearAll')}
                </Button>
            )}
            {hasNonDefaultFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetDefaults}
                    leftIcon={<RotateCcwIcon className="h-3.5 w-3.5" />}
                >
                    {t('admin-filters.resetDefaults')}
                </Button>
            )}
        </div>
    );
}
