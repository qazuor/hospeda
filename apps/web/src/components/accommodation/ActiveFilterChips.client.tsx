import { CloseIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import type { AccommodationFilters } from './filter-sidebar.types';
import { DESTINATIONS } from './filter-sidebar.types';

/**
 * Props for the ActiveFilterChips component.
 */
export interface ActiveFilterChipsProps {
    /**
     * Current active filter state.
     */
    readonly filters: AccommodationFilters;

    /**
     * Callback to remove a single accommodation type chip.
     * Receives the type value to remove.
     */
    readonly onClearType: (value: string) => void;

    /**
     * Callback to clear the priceMin filter.
     */
    readonly onClearPriceMin: () => void;

    /**
     * Callback to clear the priceMax filter.
     */
    readonly onClearPriceMax: () => void;

    /**
     * Callback to clear the destination filter.
     */
    readonly onClearDestination: () => void;

    /**
     * Callback to remove a single amenity chip.
     * Receives the amenity value to remove.
     */
    readonly onClearAmenity: (value: string) => void;

    /**
     * Callback to clear the minRating filter.
     */
    readonly onClearRating: () => void;

    /**
     * Callback to clear all active filters at once.
     */
    readonly onClearAll: () => void;

    /**
     * Locale used for UI text translations.
     */
    readonly locale: string;
}

/**
 * Chip component
 *
 * Internal helper that renders a single removable filter badge.
 */
interface ChipProps {
    readonly label: string;
    readonly ariaLabel: string;
    readonly onRemove: () => void;
}

function Chip({ label, ariaLabel, onRemove }: ChipProps): JSX.Element {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-primary/10 px-3 py-1 text-primary text-sm">
            {label}
            <button
                type="button"
                onClick={onRemove}
                aria-label={ariaLabel}
                className="rounded hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                <CloseIcon
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                />
            </button>
        </span>
    );
}

/**
 * ActiveFilterChips component
 *
 * Renders a container with removable badge chips for each currently active
 * filter. Returns null when no filters are active. Includes a "clear all"
 * button whenever at least one filter is set.
 *
 * @param props - Component props
 * @returns React element or null when no filters are active
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
        <div className="mb-6 rounded-lg bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-muted-foreground text-sm">
                    {t('sidebar.activeFilters')}
                </h3>
                <button
                    type="button"
                    onClick={onClearAll}
                    className="rounded text-primary text-xs underline hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {t('sidebar.clearAll')}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {filters.types.map((type) => (
                    <Chip
                        key={type}
                        label={t(`types.${type}`)}
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t(`types.${type}`)
                        })}
                        onRemove={() => onClearType(type)}
                    />
                ))}
                {filters.priceMin !== null && (
                    <Chip
                        label={`${t('sidebar.priceMin')}: $${filters.priceMin}`}
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t('sidebar.priceMin')
                        })}
                        onRemove={onClearPriceMin}
                    />
                )}
                {filters.priceMax !== null && (
                    <Chip
                        label={`${t('sidebar.priceMax')}: $${filters.priceMax}`}
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t('sidebar.priceMax')
                        })}
                        onRemove={onClearPriceMax}
                    />
                )}
                {filters.destination && (
                    <Chip
                        label={
                            DESTINATIONS.find((d) => d.value === filters.destination)?.label ??
                            filters.destination
                        }
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t('sidebar.destination')
                        })}
                        onRemove={onClearDestination}
                    />
                )}
                {filters.amenities.map((amenity) => (
                    <Chip
                        key={amenity}
                        label={t(`sidebar.${amenity}`)}
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t(`sidebar.${amenity}`)
                        })}
                        onRemove={() => onClearAmenity(amenity)}
                    />
                ))}
                {filters.minRating !== null && (
                    <Chip
                        label={`${filters.minRating}+ ${t('sidebar.stars')}`}
                        ariaLabel={t('sidebar.removeFilter', undefined, {
                            name: t('sidebar.rating')
                        })}
                        onRemove={onClearRating}
                    />
                )}
            </div>
        </div>
    );
}
