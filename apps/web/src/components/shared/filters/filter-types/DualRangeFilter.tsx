/**
 * @file DualRangeFilter.tsx
 * @description Dual-thumb range slider with a single track and a colored
 * segment between the two thumbs. Both `<input type="range">` are overlaid
 * on the same row so the control fits a single line.
 *
 * Semantics: when a thumb is dragged to its extreme boundary the upstream
 * URL emitter drops the corresponding param — i.e. min at `config.min` means
 * "no lower bound applied" and max at `config.max` means "no upper bound
 * applied". The labels swap to "Sin límite" to make this visible.
 *
 * Accepts a `format` string ('currency' | 'number') instead of a function
 * to remain serializable for SSR/hydration.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './DualRangeFilter.module.css';

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
    /**
     * Whether the include-null toggle starts checked. When true, the URL only
     * carries `<includeNullParam>=false` after the user explicitly unchecks it
     * (absent param = checked). When false (default), absent = unchecked and
     * `<includeNullParam>=true` is emitted when toggled on.
     */
    readonly defaultIncludeNull?: boolean;
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

/** Clamps a percentage into the [0, 100] range. */
function pct(value: number, min: number, max: number): number {
    const span = max - min;
    if (span <= 0) return 0;
    const raw = ((value - min) / span) * 100;
    return Math.max(0, Math.min(100, raw));
}

/**
 * Dual-thumb range slider. The two native inputs share the same absolute
 * position so the user can grab either thumb on a single line; the colored
 * segment between them highlights the active range.
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

    const startPct = pct(currentMin, config.min, config.max);
    const endPct = pct(currentMax, config.min, config.max);

    const minAtFloor = currentMin <= config.min;
    const maxAtCeiling = currentMax >= config.max;

    const minLabel = minAtFloor
        ? t('ui.filter.dualRange.noMin', 'Sin mínimo')
        : formatValue(currentMin, config.format);
    const maxLabel = maxAtCeiling
        ? t('ui.filter.dualRange.noMax', 'Sin máximo')
        : formatValue(currentMax, config.format);

    // When the min thumb is past the midpoint, raise it above the max thumb
    // so users can still grab and drag it back toward the lower bound.
    const midpoint = (config.min + config.max) / 2;
    const minAboveMid = currentMin > midpoint;

    const labelMinClass = minAtFloor ? styles.unboundedLabel : undefined;
    const labelMaxClass = maxAtCeiling ? styles.unboundedLabel : undefined;

    return (
        <div className={styles.dualRange}>
            <div className={styles.dualRangeTrack}>
                <span
                    className={styles.trackRail}
                    aria-hidden="true"
                />
                <span
                    className={styles.trackActive}
                    aria-hidden="true"
                    style={
                        {
                            '--start': `${startPct}%`,
                            '--end': `${endPct}%`
                        } as React.CSSProperties
                    }
                />
                <input
                    type="range"
                    className={`${styles.dualRangeInput} ${styles.dualRangeInputMin}`}
                    min={config.min}
                    max={config.max}
                    step={config.step ?? 1}
                    value={currentMin}
                    onChange={handleMinChange}
                    data-above-mid={minAboveMid ? 'true' : undefined}
                    aria-label={`${config.label} ${t('ui.filter.min', 'mínimo')}`}
                    aria-valuemin={config.min}
                    aria-valuemax={config.max}
                    aria-valuenow={currentMin}
                    aria-valuetext={minLabel}
                />
                <input
                    type="range"
                    className={`${styles.dualRangeInput} ${styles.dualRangeInputMax}`}
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
                <span className={labelMinClass}>{minLabel}</span>
                <span className={labelMaxClass}>{maxLabel}</span>
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
