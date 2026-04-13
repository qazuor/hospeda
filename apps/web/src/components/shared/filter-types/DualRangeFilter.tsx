/**
 * @file DualRangeFilter.tsx
 * @description Dual range slider filter with formatted value labels for price ranges etc.
 * Accepts a `format` string ('currency' | 'number') instead of a function
 * to remain serializable for SSR/hydration.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from '../FilterSidebar.module.css';

/** Configuration for a dual-range filter group. */
export interface DualRangeFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'dual-range';
    readonly min: number;
    readonly max: number;
    readonly step?: number;
    /** How to display slider values: 'currency' uses $N.NNN, 'number' is plain. */
    readonly format?: 'currency' | 'number';
    /** Label for the optional "include null" checkbox shown below the range. */
    readonly includeNullLabel?: string;
    /** URL param name for the include-null toggle (e.g. 'includeNoPrice'). */
    readonly includeNullParam?: string;
}

interface DualRangeFilterProps {
    readonly config: DualRangeFilterConfig;
    /** Current range stored as string numbers (same shape as existing `ranges` state). */
    readonly value: { readonly min: string; readonly max: string };
    readonly onMinChange: (value: string) => void;
    readonly onMaxChange: (value: string) => void;
    readonly locale: SupportedLocale;
    /** Whether to include items without a price value. */
    readonly includeNull?: boolean;
    /** Callback when the include-null checkbox changes. */
    readonly onIncludeNullChange?: (value: boolean) => void;
}

/** Formats a number value for display based on the format config. */
function formatValue(raw: number, format: DualRangeFilterConfig['format']): string {
    if (format === 'currency') {
        return `$${raw.toLocaleString('es-AR')}`;
    }
    return String(raw);
}

/**
 * Dual range slider filter. Renders two stacked range inputs.
 * The min thumb cannot exceed the max thumb value and vice-versa.
 */
export function DualRangeFilter({
    config,
    value,
    onMinChange,
    onMaxChange,
    locale,
    includeNull,
    onIncludeNullChange
}: DualRangeFilterProps) {
    const { t } = createTranslations(locale);

    const currentMin = value.min !== '' ? Number(value.min) : config.min;
    const currentMax = value.max !== '' ? Number(value.max) : config.max;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMin = Math.min(Number(e.target.value), currentMax - (config.step ?? 1));
        onMinChange(String(newMin));
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMax = Math.max(Number(e.target.value), currentMin + (config.step ?? 1));
        onMaxChange(String(newMax));
    };

    const minLabel = formatValue(currentMin, config.format);
    const maxLabel = formatValue(currentMax, config.format);

    return (
        <div className={styles.dualRange}>
            <div className={styles.dualRangeTrack}>
                <input
                    type="range"
                    className={styles.dualRangeInput}
                    min={config.min}
                    max={config.max}
                    step={config.step ?? 1}
                    value={currentMin}
                    onChange={handleMinChange}
                    aria-label={`${config.label} ${t('ui.filter.min', 'mínimo')}`}
                    aria-valuemin={config.min}
                    aria-valuemax={config.max}
                    aria-valuenow={currentMin}
                    aria-valuetext={minLabel}
                />
                <input
                    type="range"
                    className={styles.dualRangeInput}
                    min={config.min}
                    max={config.max}
                    step={config.step ?? 1}
                    value={currentMax}
                    onChange={handleMaxChange}
                    aria-label={`${config.label} ${t('ui.filter.max', 'máximo')}`}
                    aria-valuemin={config.min}
                    aria-valuemax={config.max}
                    aria-valuenow={currentMax}
                    aria-valuetext={maxLabel}
                />
            </div>
            <div
                className={styles.dualRangeLabels}
                aria-hidden="true"
            >
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
            {config.includeNullLabel && onIncludeNullChange && (
                <label className={styles.includeNullLabel}>
                    <input
                        type="checkbox"
                        className={styles.includeNullCheckbox}
                        checked={includeNull ?? false}
                        onChange={(e) => onIncludeNullChange(e.target.checked)}
                    />
                    {config.includeNullLabel}
                </label>
            )}
        </div>
    );
}
