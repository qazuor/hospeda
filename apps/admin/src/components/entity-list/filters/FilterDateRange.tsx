/**
 * @file FilterDateRange component (SPEC-185 Phase 1)
 *
 * A date-range filter control with two independent date input fields (from/to).
 * Each bound is independently clearable via the 3-state sentinel model.
 * Values are serialized as ISO `YYYY-MM-DD` date strings (native HTML date input format).
 *
 * Used in entity list filter bars for temporal fields such as createdAt and event dates.
 */

import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import type { DateRangeFilterConfig } from './filter-types';

/**
 * Props for the FilterDateRange component.
 */
export interface FilterDateRangeProps {
    /** Configuration for this date-range filter (label, paramKeys) */
    readonly config: DateRangeFilterConfig;
    /** Current from-bound value as ISO YYYY-MM-DD, or undefined when not set */
    readonly valueFrom: string | undefined;
    /** Current to-bound value as ISO YYYY-MM-DD, or undefined when not set */
    readonly valueTo: string | undefined;
    /**
     * Called when the from-bound changes.
     * Pass undefined to clear the bound (removes the URL param).
     */
    readonly onChangeFrom: (value: string | undefined) => void;
    /**
     * Called when the to-bound changes.
     * Pass undefined to clear the bound (removes the URL param).
     */
    readonly onChangeTo: (value: string | undefined) => void;
}

/**
 * FilterDateRange
 *
 * Renders two compact date inputs for a from/to date-range filter.
 * Each input operates independently: setting one bound does not affect the other.
 * Clearing an input (emptying it) calls the onChange handler with `undefined`
 * to remove that bound from the URL.
 *
 * Values are ISO `YYYY-MM-DD` strings (the native format of `<input type="date">`).
 * The container border turns solid primary when at least one bound is active,
 * matching the visual convention of FilterSelect and FilterBoolean.
 *
 * @example
 * ```tsx
 * <FilterDateRange
 *   config={{ type: 'date-range', paramKey: 'createdAt', labelKey: 'filters.createdAt',
 *             paramKeyFrom: 'createdAfter', paramKeyTo: 'createdBefore' }}
 *   valueFrom={filters.createdAfter}
 *   valueTo={filters.createdBefore}
 *   onChangeFrom={(val) => onFilterChange('createdAfter', val)}
 *   onChangeTo={(val) => onFilterChange('createdBefore', val)}
 * />
 * ```
 */
export function FilterDateRange({
    config,
    valueFrom,
    valueTo,
    onChangeFrom,
    onChangeTo
}: FilterDateRangeProps) {
    const { t } = useTranslations();

    const isActive = valueFrom !== undefined || valueTo !== undefined;
    const label = t(config.labelKey as TranslationKey);

    const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeFrom(val === '' ? undefined : val);
    };

    const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeTo(val === '' ? undefined : val);
    };

    return (
        <fieldset
            className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-sm',
                isActive ? 'border-primary border-solid' : 'border-dashed'
            )}
            aria-label={label}
        >
            <span className="shrink-0 text-muted-foreground text-xs">{label}:</span>
            <Input
                type="date"
                value={valueFrom ?? ''}
                onChange={handleFromChange}
                className="h-6 w-36 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label={`${label} ${t('admin-filters.rangeFrom' as TranslationKey)}`}
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
                type="date"
                value={valueTo ?? ''}
                onChange={handleToChange}
                className="h-6 w-36 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label={`${label} ${t('admin-filters.rangeTo' as TranslationKey)}`}
            />
        </fieldset>
    );
}
