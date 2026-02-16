import { ChevronDownIcon, CloseIcon, StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';

/**
 * Accommodation filter configuration
 */
export interface AccommodationFilters {
    readonly types: string[];
    readonly priceMin: number | null;
    readonly priceMax: number | null;
    readonly destination: string;
    readonly amenities: string[];
    readonly minRating: number | null;
}

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
    readonly locale?: 'es' | 'en';

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * Destination option
 */
interface Destination {
    readonly value: string;
    readonly label: string;
}

/**
 * Collapsible section state
 */
interface SectionState {
    readonly type: boolean;
    readonly price: boolean;
    readonly destination: boolean;
    readonly amenities: boolean;
    readonly rating: boolean;
}

/**
 * Available accommodation types
 */
const ACCOMMODATION_TYPES = ['hotel', 'cabin', 'apartment', 'rural', 'hostel', 'boutique'] as const;

/**
 * Available amenities
 */
const AMENITIES = [
    'wifi',
    'pool',
    'parking',
    'breakfast',
    'airConditioning',
    'gym',
    'restaurant',
    'petFriendly'
] as const;

/**
 * Available destinations (mock data)
 */
const DESTINATIONS: Destination[] = [
    { value: 'concepcion-del-uruguay', label: 'Concepción del Uruguay' },
    { value: 'colon', label: 'Colón' },
    { value: 'gualeguaychu', label: 'Gualeguaychú' },
    { value: 'parana', label: 'Paraná' },
    { value: 'federacion', label: 'Federación' }
];

/**
 * Localized text strings
 */
const translations = {
    es: {
        filters: 'Filtros',
        type: 'Tipo de alojamiento',
        hotel: 'Hotel',
        cabin: 'Cabaña',
        apartment: 'Departamento',
        rural: 'Rural',
        hostel: 'Hostel',
        boutique: 'Boutique',
        priceRange: 'Rango de precio',
        priceMin: 'Mínimo',
        priceMax: 'Máximo',
        destination: 'Destino',
        allDestinations: 'Todos los destinos',
        amenities: 'Servicios',
        wifi: 'WiFi',
        pool: 'Piscina',
        parking: 'Estacionamiento',
        breakfast: 'Desayuno',
        airConditioning: 'Aire acondicionado',
        gym: 'Gimnasio',
        restaurant: 'Restaurante',
        petFriendly: 'Admite mascotas',
        rating: 'Calificación mínima',
        stars: 'estrellas',
        clearAll: 'Limpiar filtros',
        activeFilters: 'Filtros activos'
    },
    en: {
        filters: 'Filters',
        type: 'Accommodation type',
        hotel: 'Hotel',
        cabin: 'Cabin',
        apartment: 'Apartment',
        rural: 'Rural',
        hostel: 'Hostel',
        boutique: 'Boutique',
        priceRange: 'Price range',
        priceMin: 'Min',
        priceMax: 'Max',
        destination: 'Destination',
        allDestinations: 'All destinations',
        amenities: 'Amenities',
        wifi: 'WiFi',
        pool: 'Pool',
        parking: 'Parking',
        breakfast: 'Breakfast',
        airConditioning: 'Air conditioning',
        gym: 'Gym',
        restaurant: 'Restaurant',
        petFriendly: 'Pet friendly',
        rating: 'Minimum rating',
        stars: 'stars',
        clearAll: 'Clear filters',
        activeFilters: 'Active filters'
    }
};

/**
 * FilterSidebar component
 *
 * A comprehensive filter sidebar for accommodation search with URL synchronization.
 * Features collapsible sections for type, price, destination, amenities, and rating.
 * Active filters are displayed as removable badges. All filter changes sync to URL
 * query parameters without page reload.
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

    const t = translations[locale];

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
            ? filters.types.filter((t) => t !== type)
            : [...filters.types, type];
        updateFilters({ types: newTypes });
    };

    /**
     * Toggles amenity
     */
    const toggleAmenity = (amenity: string): void => {
        const newAmenities = filters.amenities.includes(amenity)
            ? filters.amenities.filter((a) => a !== amenity)
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
                if (value) {
                    updateFilters({ types: filters.types.filter((t) => t !== value) });
                } else {
                    updateFilters({ types: [] });
                }
                break;
            case 'amenities':
                if (value) {
                    updateFilters({ amenities: filters.amenities.filter((a) => a !== value) });
                } else {
                    updateFilters({ amenities: [] });
                }
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
     * Counts active filters
     */
    const activeFilterCount =
        filters.types.length +
        filters.amenities.length +
        (filters.priceMin !== null ? 1 : 0) +
        (filters.priceMax !== null ? 1 : 0) +
        (filters.destination ? 1 : 0) +
        (filters.minRating !== null ? 1 : 0);

    /**
     * Renders a star for rating selection
     */
    const renderStar = (index: number): JSX.Element => {
        const value = index + 1;
        const isFilled = filters.minRating !== null && value <= filters.minRating;

        return (
            <button
                key={index}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} ${t.stars}`}
                className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                <StarIcon
                    size={24}
                    weight={isFilled ? 'fill' : 'regular'}
                    className={isFilled ? 'text-yellow-400' : 'text-gray-300'}
                    aria-hidden="true"
                />
            </button>
        );
    };

    /**
     * Renders active filter badges
     */
    const renderActiveFilters = (): JSX.Element | null => {
        if (activeFilterCount === 0) return null;

        return (
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 text-sm">{t.activeFilters}</h3>
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="rounded text-primary text-xs underline hover:text-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.clearAll}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {filters.types.map((type) => (
                        <span
                            key={type}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm"
                        >
                            {t[type as keyof typeof t]}
                            <button
                                type="button"
                                onClick={() => clearFilter('types', type)}
                                aria-label={`Remove ${type} filter`}
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm">
                            {t.priceMin}: ${filters.priceMin}
                            <button
                                type="button"
                                onClick={() => clearFilter('priceMin')}
                                aria-label="Remove minimum price filter"
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm">
                            {t.priceMax}: ${filters.priceMax}
                            <button
                                type="button"
                                onClick={() => clearFilter('priceMax')}
                                aria-label="Remove maximum price filter"
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm">
                            {DESTINATIONS.find((d) => d.value === filters.destination)?.label}
                            <button
                                type="button"
                                onClick={() => clearFilter('destination')}
                                aria-label="Remove destination filter"
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                            className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm"
                        >
                            {t[amenity as keyof typeof t]}
                            <button
                                type="button"
                                onClick={() => clearFilter('amenities', amenity)}
                                aria-label={`Remove ${amenity} filter`}
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm">
                            {filters.minRating}+ {t.stars}
                            <button
                                type="button"
                                onClick={() => clearFilter('minRating')}
                                aria-label="Remove rating filter"
                                className="rounded hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
    };

    return (
        <aside
            className={`${className}`.trim()}
            aria-label={t.filters}
        >
            <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-6 font-bold text-gray-900 text-xl">{t.filters}</h2>

                {renderActiveFilters()}

                {/* Type Section */}
                <div className="mb-6 border-gray-200 border-b pb-6">
                    <button
                        type="button"
                        onClick={() => toggleSection('type')}
                        aria-expanded={expandedSections.type}
                        className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.type}
                        <ChevronDownIcon
                            size={20}
                            weight="bold"
                            className={`transition-transform ${expandedSections.type ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {expandedSections.type && (
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
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                                    />
                                    <span className="ml-3 text-gray-700 text-sm">{t[type]}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Price Range Section */}
                <div className="mb-6 border-gray-200 border-b pb-6">
                    <button
                        type="button"
                        onClick={() => toggleSection('price')}
                        aria-expanded={expandedSections.price}
                        className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.priceRange}
                        <ChevronDownIcon
                            size={20}
                            weight="bold"
                            className={`transition-transform ${expandedSections.price ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {expandedSections.price && (
                        <div className="space-y-3">
                            <div>
                                <label
                                    htmlFor="price-min"
                                    className="mb-1 block text-gray-700 text-sm"
                                >
                                    {t.priceMin}
                                </label>
                                <input
                                    type="number"
                                    id="price-min"
                                    value={filters.priceMin ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value
                                            ? Number.parseInt(e.target.value, 10)
                                            : null;
                                        updateFilters({ priceMin: value });
                                    }}
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
                                    {t.priceMax}
                                </label>
                                <input
                                    type="number"
                                    id="price-max"
                                    value={filters.priceMax ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value
                                            ? Number.parseInt(e.target.value, 10)
                                            : null;
                                        updateFilters({ priceMax: value });
                                    }}
                                    placeholder="0"
                                    min="0"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Destination Section */}
                <div className="mb-6 border-gray-200 border-b pb-6">
                    <button
                        type="button"
                        onClick={() => toggleSection('destination')}
                        aria-expanded={expandedSections.destination}
                        className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.destination}
                        <ChevronDownIcon
                            size={20}
                            weight="bold"
                            className={`transition-transform ${expandedSections.destination ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {expandedSections.destination && (
                        <select
                            id="destination"
                            value={filters.destination}
                            onChange={(e) => updateFilters({ destination: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">{t.allDestinations}</option>
                            {DESTINATIONS.map((dest) => (
                                <option
                                    key={dest.value}
                                    value={dest.value}
                                >
                                    {dest.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Amenities Section */}
                <div className="mb-6 border-gray-200 border-b pb-6">
                    <button
                        type="button"
                        onClick={() => toggleSection('amenities')}
                        aria-expanded={expandedSections.amenities}
                        className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.amenities}
                        <ChevronDownIcon
                            size={20}
                            weight="bold"
                            className={`transition-transform ${expandedSections.amenities ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {expandedSections.amenities && (
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
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                                    />
                                    <span className="ml-3 text-gray-700 text-sm">{t[amenity]}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rating Section */}
                <div>
                    <button
                        type="button"
                        onClick={() => toggleSection('rating')}
                        aria-expanded={expandedSections.rating}
                        className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.rating}
                        <ChevronDownIcon
                            size={20}
                            weight="bold"
                            className={`transition-transform ${expandedSections.rating ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {expandedSections.rating && (
                        <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => renderStar(i))}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
