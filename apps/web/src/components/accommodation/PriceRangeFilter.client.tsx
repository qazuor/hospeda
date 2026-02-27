import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { FilterSection } from './FilterSection.client';

/**
 * Props for the PriceRangeFilter component
 */
export interface PriceRangeFilterProps {
    /**
     * Current minimum price value
     */
    readonly priceMin: number | null;

    /**
     * Current maximum price value
     */
    readonly priceMax: number | null;

    /**
     * Whether the section is expanded
     */
    readonly isExpanded: boolean;

    /**
     * Callback to toggle section expansion
     */
    readonly onToggle: () => void;

    /**
     * Callback when minimum price changes
     */
    readonly onPriceMinChange: (value: number | null) => void;

    /**
     * Callback when maximum price changes
     */
    readonly onPriceMaxChange: (value: number | null) => void;

    /**
     * Locale for UI text
     */
    readonly locale: string;
}

/**
 * PriceRangeFilter component
 *
 * Renders a collapsible price range filter section with min/max number inputs.
 * Parses input values to integers and passes null for empty inputs.
 *
 * @param props - Component props
 * @returns React component
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
                        className="mb-1 block text-gray-700 text-sm"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div>
                    <label
                        htmlFor="price-max"
                        className="mb-1 block text-gray-700 text-sm"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>
        </FilterSection>
    );
}
