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
 * Props for the FilterSidebar component
 */
export interface FilterSidebarProps {
    /**
     * Initial filter values
     */
    readonly initialFilters?: Partial<AccommodationFilters>;

    /**
     * Locale for UI text
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * FilterSidebar component
 *
 * A comprehensive filter sidebar for accommodation search with URL synchronization.
 * Features collapsible sections for type, price, destination, amenities, and rating.
 * Active filters are displayed as removable badges. All filter changes sync to URL
 * query parameters without page reload.
 *
 * Sub-components:
 * - {@link FilterSection} - Collapsible section wrapper
 * - {@link PriceRangeFilter} - Price min/max inputs
 * - {@link ActiveFilterChips} - Active filter badge chips
 *
 * @param props - Component props
 * @returns React component
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
     * Syncs filters to URL query parameters
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

        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.pushState({}, '', newUrl);
    };

    /**
     * Parses URL query parameters to initialize filters
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
     * Updates filters and syncs to URL
     */
    const updateFilters = (updates: Partial<AccommodationFilters>): void => {
        const newFilters = { ...filters, ...updates };
        setFilters(newFilters);
        syncToUrl(newFilters);
    };

    /**
     * Toggles accommodation type
     */
    const toggleType = (type: string): void => {
        const newTypes = filters.types.includes(type)
            ? filters.types.filter((item) => item !== type)
            : [...filters.types, type];
        updateFilters({ types: newTypes });
    };

    /**
     * Toggles amenity
     */
    const toggleAmenity = (amenity: string): void => {
        const newAmenities = filters.amenities.includes(amenity)
            ? filters.amenities.filter((item) => item !== amenity)
            : [...filters.amenities, amenity];
        updateFilters({ amenities: newAmenities });
    };

    /**
     * Sets minimum rating
     */
    const setRating = (rating: number): void => {
        updateFilters({ minRating: rating });
    };

    /**
     * Clears all filters
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
     * Clears a specific filter
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
     * Toggles section expansion
     */
    const toggleSection = (section: keyof SectionState): void => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    /**
     * Renders a star button for rating selection
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
            className={`${className}`.trim()}
            aria-label={t('sidebar.filters')}
        >
            <div className="rounded-lg border border-border bg-surface p-6">
                <h2 className="mb-6 font-bold text-text text-xl">{t('sidebar.filters')}</h2>

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

                {/* Type Section */}
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
                                <span className="ml-3 text-sm text-text">{t(`types.${type}`)}</span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Price Range Section */}
                <PriceRangeFilter
                    priceMin={filters.priceMin}
                    priceMax={filters.priceMax}
                    isExpanded={expandedSections.price}
                    onToggle={() => toggleSection('price')}
                    onPriceMinChange={(value) => updateFilters({ priceMin: value })}
                    onPriceMaxChange={(value) => updateFilters({ priceMax: value })}
                    locale={locale}
                />

                {/* Destination Section */}
                <FilterSection
                    title={t('sidebar.destination')}
                    isExpanded={expandedSections.destination}
                    onToggle={() => toggleSection('destination')}
                >
                    <select
                        id="destination"
                        value={filters.destination}
                        onChange={(e) => updateFilters({ destination: e.target.value })}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
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

                {/* Amenities Section */}
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
                                <span className="ml-3 text-sm text-text">
                                    {t(`sidebar.${amenity}`)}
                                </span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Rating Section */}
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
