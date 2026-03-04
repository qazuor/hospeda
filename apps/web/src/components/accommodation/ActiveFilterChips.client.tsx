import { CloseIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import type { AccommodationFilters } from './filter-sidebar.types';
import { DESTINATIONS } from './filter-sidebar.types';

/**
 * Props for the ActiveFilterChips component
 */
export interface ActiveFilterChipsProps {
    /**
     * Current active filters
     */
    readonly filters: AccommodationFilters;

    /**
     * Callback to clear a specific type filter value
     */
    readonly onClearType: (value: string) => void;

    /**
     * Callback to clear the priceMin filter
     */
    readonly onClearPriceMin: () => void;

    /**
     * Callback to clear the priceMax filter
     */
    readonly onClearPriceMax: () => void;

    /**
     * Callback to clear the destination filter
     */
    readonly onClearDestination: () => void;

    /**
     * Callback to clear a specific amenity filter value
     */
    readonly onClearAmenity: (value: string) => void;

    /**
     * Callback to clear the minRating filter
     */
    readonly onClearRating: () => void;

    /**
     * Callback to clear all filters at once
     */
    readonly onClearAll: () => void;

    /**
     * Locale for UI text
     */
    readonly locale: string;
}

/**
 * ActiveFilterChips component
 *
 * Renders a container with removable badge chips for each active filter.
 * Returns null when no filters are active.
 * Includes a "clear all" button when any filter is active.
 *
 * @param props - Component props
 * @returns React component or null
 *
 * @example
 * ```tsx
 * <ActiveFilterChips
 *   filters={filters}
 *   onClearType={(type) => clearFilter('types', type)}
 *   onClearPriceMin={() => clearFilter('priceMin')}
 *   onClearPriceMax={() => clearFilter('priceMax')}
 *   onClearDestination={() => clearFilter('destination')}
 *   onClearAmenity={(amenity) => clearFilter('amenities', amenity)}
 *   onClearRating={() => clearFilter('minRating')}
 *   onClearAll={clearAllFilters}
 *   locale="es"
 * />
 * ```
 */
export function ActiveFilterChips({
    filters,
    onClearType,
    onClearPriceMin,
    onClearPriceMax,
    onClearDestination,
    onClearAmenity,
    onClearRating,
    onClearAll,
    locale
}: ActiveFilterChipsProps): JSX.Element | null {
    const { t } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'accommodations'
    });

    const activeFilterCount =
        filters.types.length +
        filters.amenities.length +
        (filters.priceMin !== null ? 1 : 0) +
        (filters.priceMax !== null ? 1 : 0) +
        (filters.destination ? 1 : 0) +
        (filters.minRating !== null ? 1 : 0);

    if (activeFilterCount === 0) return null;

    return (
        <div className="mb-6 rounded-lg bg-surface-alt p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-text-secondary">
                    {t('sidebar.activeFilters')}
                </h3>
                <button
                    type="button"
                    onClick={onClearAll}
                    className="rounded text-primary text-xs underline hover:text-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {t('sidebar.clearAll')}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {filters.types.map((type) => (
                    <span
                        key={type}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text"
                    >
                        {t(`types.${type}`)}
                        <button
                            type="button"
                            onClick={() => onClearType(type)}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t(`types.${type}`)
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                ))}
                {filters.priceMin !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text">
                        {t('sidebar.priceMin')}: ${filters.priceMin}
                        <button
                            type="button"
                            onClick={onClearPriceMin}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t('sidebar.priceMin')
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                )}
                {filters.priceMax !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text">
                        {t('sidebar.priceMax')}: ${filters.priceMax}
                        <button
                            type="button"
                            onClick={onClearPriceMax}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t('sidebar.priceMax')
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                )}
                {filters.destination && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text">
                        {DESTINATIONS.find((d) => d.value === filters.destination)?.label}
                        <button
                            type="button"
                            onClick={onClearDestination}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t('sidebar.destination')
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                )}
                {filters.amenities.map((amenity) => (
                    <span
                        key={amenity}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text"
                    >
                        {t(`sidebar.${amenity}`)}
                        <button
                            type="button"
                            onClick={() => onClearAmenity(amenity)}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t(`sidebar.${amenity}`)
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                ))}
                {filters.minRating !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text">
                        {filters.minRating}+ {t('sidebar.stars')}
                        <button
                            type="button"
                            onClick={onClearRating}
                            aria-label={t('sidebar.removeFilter', undefined, {
                                name: t('sidebar.rating')
                            })}
                            className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 dark:hover:text-red-400"
                        >
                            <CloseIcon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </button>
                    </span>
                )}
            </div>
        </div>
    );
}
