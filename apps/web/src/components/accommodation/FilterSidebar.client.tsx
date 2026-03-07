import { StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { ActiveFilterChips } from './ActiveFilterChips.client';
import { FilterSection } from './FilterSection.client';
import { PriceRangeFilter } from './PriceRangeFilter.client';
import type { AccommodationFilters, SectionState } from './filter-sidebar.types';
import { ACCOMMODATION_TYPES, AMENITIES, DESTINATIONS } from './filter-sidebar.types';

export type { AccommodationFilters } from './filter-sidebar.types';

/**
 * Props for the FilterSidebar component.
 */
export interface FilterSidebarProps {
    /**
     * Initial filter values to populate the sidebar state on first render.
     * URL query parameters take precedence when present.
     */
    readonly initialFilters?: Partial<AccommodationFilters>;

    /**
     * Locale used for all UI text translations.
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Additional CSS class names to apply to the root `<aside>` element.
     * Useful for passing layout utilities such as `lg:sticky lg:top-4`.
     */
    readonly className?: string;
}

/**
 * FilterSidebar component
 *
 * A comprehensive filter sidebar for accommodation search with URL synchronization.
 * Renders collapsible sections for accommodation type, price range, destination,
 * amenities, and minimum star rating. Active filters are displayed as removable
 * badge chips via {@link ActiveFilterChips}. All filter changes are pushed to
 * URL query parameters via `window.history.pushState` without triggering a page
 * reload. On mount the component reads any existing URL parameters to restore
 * previous filter state.
 *
 * Sub-components composed internally:
 * - {@link FilterSection} - Collapsible section wrapper with animated chevron
 * - {@link PriceRangeFilter} - Min/max price number inputs inside a FilterSection
 * - {@link ActiveFilterChips} - Removable badge chips for each active filter
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * <FilterSidebar
 *   initialFilters={{ types: ['hotel'], destination: 'colon' }}
 *   locale="es"
 *   className="lg:sticky lg:top-4"
 * />
 * ```
 */
export function FilterSidebar({
    initialFilters = {},
    locale = 'es',
    className = ''
}: FilterSidebarProps): JSX.Element {
    const [filters, setFilters] = useState<AccommodationFilters>({
        types: initialFilters.types ?? [],
        priceMin: initialFilters.priceMin ?? null,
        priceMax: initialFilters.priceMax ?? null,
        destination: initialFilters.destination ?? '',
        amenities: initialFilters.amenities ?? [],
        minRating: initialFilters.minRating ?? null
    });

    const [expandedSections, setExpandedSections] = useState<SectionState>({
        type: true,
        price: true,
        destination: true,
        amenities: true,
        rating: true
    });

    const { t } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'accommodations'
    });

    /**
     * Serializes the given filter state into URL query parameters and pushes
     * the resulting URL to the browser history without reloading the page.
     *
     * @param newFilters - The filter state to serialize
     */
    const syncToUrl = (newFilters: AccommodationFilters): void => {
        const params = new URLSearchParams();

        if (newFilters.types.length > 0) {
            params.set('types', newFilters.types.join(','));
        }
        if (newFilters.priceMin !== null) {
            params.set('priceMin', String(newFilters.priceMin));
        }
        if (newFilters.priceMax !== null) {
            params.set('priceMax', String(newFilters.priceMax));
        }
        if (newFilters.destination) {
            params.set('destination', newFilters.destination);
        }
        if (newFilters.amenities.length > 0) {
            params.set('amenities', newFilters.amenities.join(','));
        }
        if (newFilters.minRating !== null) {
            params.set('minRating', String(newFilters.minRating));
        }

        const query = params.toString();
        const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
        window.history.pushState({}, '', newUrl);
    };

    /**
     * On mount, reads URL query parameters and merges them into the local
     * filter state so that bookmarked or shared URLs restore the correct
     * sidebar selection.
     */
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);

        const typesParam = params.get('types');
        const types = typesParam ? typesParam.split(',').filter(Boolean) : undefined;

        const priceMinParam = params.get('priceMin');
        const priceMin = priceMinParam ? Number.parseInt(priceMinParam, 10) : undefined;

        const priceMaxParam = params.get('priceMax');
        const priceMax = priceMaxParam ? Number.parseInt(priceMaxParam, 10) : undefined;

        const destination = params.get('destination') ?? undefined;

        const amenitiesParam = params.get('amenities');
        const amenities = amenitiesParam ? amenitiesParam.split(',').filter(Boolean) : undefined;

        const minRatingParam = params.get('minRating');
        const minRating = minRatingParam ? Number.parseInt(minRatingParam, 10) : undefined;

        setFilters((prev) => ({
            types: types ?? prev.types,
            priceMin: priceMin !== undefined && !Number.isNaN(priceMin) ? priceMin : prev.priceMin,
            priceMax: priceMax !== undefined && !Number.isNaN(priceMax) ? priceMax : prev.priceMax,
            destination: destination ?? prev.destination,
            amenities: amenities ?? prev.amenities,
            minRating:
                minRating !== undefined && !Number.isNaN(minRating) ? minRating : prev.minRating
        }));
    }, []);

    /**
     * Merges the given partial update into the current filter state and
     * synchronizes the result to the URL.
     *
     * @param updates - Partial filter values to apply
     */
    const updateFilters = (updates: Partial<AccommodationFilters>): void => {
        const newFilters = { ...filters, ...updates };
        setFilters(newFilters);
        syncToUrl(newFilters);
    };

    /**
     * Toggles a single accommodation type in the `types` filter array.
     *
     * @param type - Accommodation type identifier to toggle
     */
    const toggleType = (type: string): void => {
        const newTypes = filters.types.includes(type)
            ? filters.types.filter((item) => item !== type)
            : [...filters.types, type];
        updateFilters({ types: newTypes });
    };

    /**
     * Toggles a single amenity in the `amenities` filter array.
     *
     * @param amenity - Amenity identifier to toggle
     */
    const toggleAmenity = (amenity: string): void => {
        const newAmenities = filters.amenities.includes(amenity)
            ? filters.amenities.filter((item) => item !== amenity)
            : [...filters.amenities, amenity];
        updateFilters({ amenities: newAmenities });
    };

    /**
     * Sets the minimum star rating filter.
     *
     * @param rating - Numeric rating value (1-5)
     */
    const setRating = (rating: number): void => {
        updateFilters({ minRating: rating });
    };

    /**
     * Resets all filters to their empty defaults and clears URL parameters.
     */
    const clearAllFilters = (): void => {
        const emptyFilters: AccommodationFilters = {
            types: [],
            priceMin: null,
            priceMax: null,
            destination: '',
            amenities: [],
            minRating: null
        };
        setFilters(emptyFilters);
        syncToUrl(emptyFilters);
    };

    /**
     * Clears a single filter field, optionally removing only a specific value
     * from array-based filters (types, amenities).
     *
     * @param filterType - The filter key to clear
     * @param value - For array filters, the specific value to remove; omit to clear all
     */
    const clearFilter = (filterType: keyof AccommodationFilters, value?: string): void => {
        switch (filterType) {
            case 'types':
                updateFilters({
                    types: value ? filters.types.filter((item) => item !== value) : []
                });
                break;
            case 'amenities':
                updateFilters({
                    amenities: value ? filters.amenities.filter((item) => item !== value) : []
                });
                break;
            case 'priceMin':
                updateFilters({ priceMin: null });
                break;
            case 'priceMax':
                updateFilters({ priceMax: null });
                break;
            case 'destination':
                updateFilters({ destination: '' });
                break;
            case 'minRating':
                updateFilters({ minRating: null });
                break;
        }
    };

    /**
     * Toggles the expanded/collapsed state of a given section panel.
     *
     * @param section - The section key to toggle
     */
    const toggleSection = (section: keyof SectionState): void => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    /**
     * Renders a single star button for the rating selection row.
     *
     * @param index - Zero-based star index (0-4)
     * @returns Star button element
     */
    const renderStar = (index: number): JSX.Element => {
        const value = index + 1;
        const isFilled = filters.minRating !== null && value <= filters.minRating;

        return (
            <button
                key={index}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} ${t('sidebar.stars')}`}
                className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                <StarIcon
                    size={24}
                    weight={isFilled ? 'fill' : 'regular'}
                    className={isFilled ? 'text-star' : 'text-star-empty'}
                    aria-hidden="true"
                />
            </button>
        );
    };

    return (
        <aside
            className={className.trim() || undefined}
            aria-label={t('sidebar.filters')}
        >
            <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-6 font-bold text-foreground text-xl">{t('sidebar.filters')}</h2>

                <ActiveFilterChips
                    filters={filters}
                    onClearType={(value) => clearFilter('types', value)}
                    onClearPriceMin={() => clearFilter('priceMin')}
                    onClearPriceMax={() => clearFilter('priceMax')}
                    onClearDestination={() => clearFilter('destination')}
                    onClearAmenity={(value) => clearFilter('amenities', value)}
                    onClearRating={() => clearFilter('minRating')}
                    onClearAll={clearAllFilters}
                    locale={locale}
                />

                {/* Accommodation type checkboxes */}
                <FilterSection
                    title={t('sidebar.type')}
                    isExpanded={expandedSections.type}
                    onToggle={() => toggleSection('type')}
                >
                    <div className="space-y-2">
                        {ACCOMMODATION_TYPES.map((type) => (
                            <label
                                key={type}
                                className="flex cursor-pointer items-center"
                            >
                                <input
                                    type="checkbox"
                                    checked={filters.types.includes(type)}
                                    onChange={() => toggleType(type)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                                />
                                <span className="ml-3 text-foreground text-sm">
                                    {t(`types.${type}`)}
                                </span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Price range min/max inputs */}
                <PriceRangeFilter
                    priceMin={filters.priceMin}
                    priceMax={filters.priceMax}
                    isExpanded={expandedSections.price}
                    onToggle={() => toggleSection('price')}
                    onPriceMinChange={(value) => updateFilters({ priceMin: value })}
                    onPriceMaxChange={(value) => updateFilters({ priceMax: value })}
                    locale={locale}
                />

                {/* Destination select dropdown */}
                <FilterSection
                    title={t('sidebar.destination')}
                    isExpanded={expandedSections.destination}
                    onToggle={() => toggleSection('destination')}
                >
                    <select
                        id="destination"
                        value={filters.destination}
                        onChange={(e) => updateFilters({ destination: e.target.value })}
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">{t('sidebar.allDestinations')}</option>
                        {DESTINATIONS.map((dest) => (
                            <option
                                key={dest.value}
                                value={dest.value}
                            >
                                {dest.label}
                            </option>
                        ))}
                    </select>
                </FilterSection>

                {/* Amenity checkboxes */}
                <FilterSection
                    title={t('sidebar.amenities')}
                    isExpanded={expandedSections.amenities}
                    onToggle={() => toggleSection('amenities')}
                >
                    <div className="space-y-2">
                        {AMENITIES.map((amenity) => (
                            <label
                                key={amenity}
                                className="flex cursor-pointer items-center"
                            >
                                <input
                                    type="checkbox"
                                    checked={filters.amenities.includes(amenity)}
                                    onChange={() => toggleAmenity(amenity)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                                />
                                <span className="ml-3 text-foreground text-sm">
                                    {t(`sidebar.${amenity}`)}
                                </span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Minimum rating star selector */}
                <FilterSection
                    title={t('sidebar.rating')}
                    isExpanded={expandedSections.rating}
                    onToggle={() => toggleSection('rating')}
                    withBorder={false}
                >
                    <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => renderStar(i))}
                    </div>
                </FilterSection>
            </div>
        </aside>
    );
}
