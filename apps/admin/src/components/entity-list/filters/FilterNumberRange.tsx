/**
 * @file FilterNumberRange component (SPEC-185 Phase 1)
 *
 * A number-range filter control with two independent input fields (min/max).
 * Each bound is independently clearable via the 3-state sentinel model.
 *
 * Used in entity list filter bars for numeric fields such as price (centavos),
 * rating, and capacity.
 */

import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import type { NumberRangeFilterConfig } from './filter-types';

/**
 * Props for the FilterNumberRange component.
 */
export interface FilterNumberRangeProps {
    /** Configuration for this number-range filter (label, paramKeys, bounds, unit) */
    readonly config: NumberRangeFilterConfig;
    /** Current min bound value, or undefined when not set */
    readonly valueMin: string | undefined;
    /** Current max bound value, or undefined when not set */
    readonly valueMax: string | undefined;
    /**
     * Called when the min bound changes.
     * Pass undefined to clear the bound (removes the URL param).
     */
    readonly onChangeMin: (value: string | undefined) => void;
    /**
     * Called when the max bound changes.
     * Pass undefined to clear the bound (removes the URL param).
     */
    readonly onChangeMax: (value: string | undefined) => void;
}

/**
 * FilterNumberRange
 *
 * Renders two compact number inputs for a min/max range filter.
 * Each input operates independently: setting one bound does not affect the other.
 * Clearing an input (emptying it) calls the onChange handler with `undefined`
 * to remove that bound from the URL.
 *
 * The container border turns solid primary when at least one bound is active,
 * matching the visual convention of FilterSelect and FilterBoolean.
 *
 * @example
 * ```tsx
 * <FilterNumberRange
 *   config={{ type: 'number-range', paramKey: 'price', labelKey: 'filters.price',
 *             paramKeyMin: 'minPrice', paramKeyMax: 'maxPrice', min: 0, step: 100,
 *             unitLabelKey: 'filters.unit.ars' }}
 *   valueMin={filters.minPrice}
 *   valueMax={filters.maxPrice}
 *   onChangeMin={(val) => onFilterChange('minPrice', val)}
 *   onChangeMax={(val) => onFilterChange('maxPrice', val)}
 * />
 * ```
 */
export function FilterNumberRange({
    config,
    valueMin,
    valueMax,
    onChangeMin,
    onChangeMax
}: FilterNumberRangeProps) {
    const { t } = useTranslations();

    const isActive = valueMin !== undefined || valueMax !== undefined;
    const label = t(config.labelKey as TranslationKey);
    const unitLabel = config.unitLabelKey ? t(config.unitLabelKey as TranslationKey) : undefined;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeMin(val === '' ? undefined : val);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeMax(val === '' ? undefined : val);
    };

    return (
        <fieldset
            className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-sm',
                isActive ? 'border-primary border-solid' : 'border-dashed'
            )}
        >
            <legend className="sr-only">{label}</legend>
            <span
                aria-hidden="true"
                className="shrink-0 text-muted-foreground text-xs"
            >
                {label}:
            </span>
            {unitLabel && (
                <span className="shrink-0 text-muted-foreground text-xs">{unitLabel}</span>
            )}
            <Input
                type="number"
                value={valueMin ?? ''}
                onChange={handleMinChange}
                min={config.min}
                max={config.max}
                step={config.step ?? 1}
                className="h-6 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
                placeholder={t('admin-filters.rangeMin' as TranslationKey)}
                aria-label={`${label} ${t('admin-filters.rangeMin' as TranslationKey)}`}
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
                type="number"
                value={valueMax ?? ''}
                onChange={handleMaxChange}
                min={config.min}
                max={config.max}
                step={config.step ?? 1}
                className="h-6 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
                placeholder={t('admin-filters.rangeMax' as TranslationKey)}
                aria-label={`${label} ${t('admin-filters.rangeMax' as TranslationKey)}`}
            />
        </fieldset>
    );
}
