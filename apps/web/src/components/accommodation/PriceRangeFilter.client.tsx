import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { FilterSection } from './FilterSection.client';

/**
 * Props for the PriceRangeFilter component.
 */
export interface PriceRangeFilterProps {
    /**
     * Current minimum price value. Null means no lower bound is set.
     */
    readonly priceMin: number | null;

    /**
     * Current maximum price value. Null means no upper bound is set.
     */
    readonly priceMax: number | null;

    /**
     * Whether the price range section is currently expanded.
     */
    readonly isExpanded: boolean;

    /**
     * Callback invoked when the section toggle button is clicked.
     */
    readonly onToggle: () => void;

    /**
     * Callback invoked when the minimum price input value changes.
     * Receives the parsed integer value, or null if the input is empty.
     */
    readonly onPriceMinChange: (value: number | null) => void;

    /**
     * Callback invoked when the maximum price input value changes.
     * Receives the parsed integer value, or null if the input is empty.
     */
    readonly onPriceMaxChange: (value: number | null) => void;

    /**
     * Locale used for UI text translations.
     */
    readonly locale: string;
}

/**
 * PriceRangeFilter component
 *
 * Renders a collapsible price range filter section with min and max
 * number inputs. Input values are parsed to integers before being passed
 * to the callbacks; empty inputs yield null.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * <PriceRangeFilter
 *   priceMin={filters.priceMin}
 *   priceMax={filters.priceMax}
 *   isExpanded={expandedSections.price}
 *   onToggle={() => toggleSection('price')}
 *   onPriceMinChange={(value) => updateFilters({ priceMin: value })}
 *   onPriceMaxChange={(value) => updateFilters({ priceMax: value })}
 *   locale="es"
 * />
 * ```
 */
export function PriceRangeFilter({
    priceMin,
    priceMax,
    isExpanded,
    onToggle,
    onPriceMinChange,
    onPriceMaxChange,
    locale
}: PriceRangeFilterProps): JSX.Element {
    const { t } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'accommodations'
    });

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.value ? Number.parseInt(e.target.value, 10) : null;
        onPriceMinChange(value);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.value ? Number.parseInt(e.target.value, 10) : null;
        onPriceMaxChange(value);
    };

    return (
        <FilterSection
            title={t('sidebar.priceRange')}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            <div className="space-y-3">
                <div>
                    <label
                        htmlFor="price-min"
                        className="mb-1 block text-muted-foreground text-sm"
                    >
                        {t('sidebar.priceMin')}
                    </label>
                    <input
                        type="number"
                        id="price-min"
                        value={priceMin ?? ''}
                        onChange={handleMinChange}
                        placeholder="0"
                        min="0"
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div>
                    <label
                        htmlFor="price-max"
                        className="mb-1 block text-muted-foreground text-sm"
                    >
                        {t('sidebar.priceMax')}
                    </label>
                    <input
                        type="number"
                        id="price-max"
                        value={priceMax ?? ''}
                        onChange={handleMaxChange}
                        placeholder="0"
                        min="0"
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>
        </FilterSection>
    );
}
