/**
 * @file PriceCompositeFilter.tsx
 * @description Composite price filter that bundles three sub-controls in one
 * collapsible filter group:
 *   1. `includeUnpriced` toggle (default ON) — include events without pricing data
 *   2. `isFree` toggle — only events flagged as free
 *   3. dual-range slider — min/max price (HIDDEN when `isFree` is ON)
 *
 * Designed for the eventos listing where the three concepts were previously
 * separate filters and confused users. The composite parent owns layout; each
 * sub-control reuses the existing `ToggleFilter` / `DualRangeFilter` primitives.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { DualRangeFilter } from './DualRangeFilter';
import styles from './PriceCompositeFilter.module.css';
import { ToggleFilter } from './ToggleFilter';
import type { PriceCompositeFilterConfig } from './filter.types';

interface PriceCompositeFilterProps {
    readonly config: PriceCompositeFilterConfig;
    /** Current isFree toggle value. */
    readonly isFree: boolean;
    /** Current includeUnpriced toggle value (defaults to TRUE upstream). */
    readonly includeUnpriced: boolean;
    /** Current dual-range value as string numbers. */
    readonly range: { readonly min: string; readonly max: string };
    readonly onIsFreeChange: (value: boolean) => void;
    readonly onIncludeUnpricedChange: (value: boolean) => void;
    readonly onMinChange: (value: string) => void;
    readonly onMaxChange: (value: string) => void;
    readonly locale: SupportedLocale;
}

/**
 * Composite price filter. The dual-range is only rendered when `isFree` is
 * OFF, since "only free events" makes the price-range section meaningless.
 */
export function PriceCompositeFilter({
    config,
    isFree,
    includeUnpriced,
    range,
    onIsFreeChange,
    onIncludeUnpricedChange,
    onMinChange,
    onMaxChange,
    locale
}: PriceCompositeFilterProps) {
    return (
        <div className={styles.root}>
            <ToggleFilter
                config={{
                    id: `${config.id}_includeUnpriced`,
                    label: config.includeUnpricedLabel,
                    type: 'toggle'
                }}
                value={includeUnpriced}
                onChange={onIncludeUnpricedChange}
                locale={locale}
            />
            <ToggleFilter
                config={{
                    id: `${config.id}_isFree`,
                    label: config.isFreeLabel,
                    type: 'toggle'
                }}
                value={isFree}
                onChange={onIsFreeChange}
                locale={locale}
            />
            {!isFree && (
                <div className={styles.rangeWrapper}>
                    <span className={styles.rangeLabel}>{config.rangeLabel}</span>
                    <DualRangeFilter
                        config={{
                            id: config.id,
                            label: config.rangeLabel,
                            type: 'dual-range',
                            min: config.min,
                            max: config.max,
                            step: config.step,
                            format: config.format
                        }}
                        value={range}
                        onMinChange={onMinChange}
                        onMaxChange={onMaxChange}
                        locale={locale}
                    />
                </div>
            )}
        </div>
    );
}
