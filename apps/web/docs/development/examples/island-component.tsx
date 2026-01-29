/**
 * Interactive Island Component Example
 *
 * This component demonstrates:
 * - React island with client-side interactivity
 * - Local state management with useState
 * - Shared state with Nanostores
 * - Form handling and validation
 * - Debounced search
 * - Loading states
 * - Client-side data fetching
 * - Different hydration strategies
 *
 * Usage in Astro pages:
 * ```astro
 * ---
 * import { SearchForm } from '../components/SearchForm';
 * ---
 *
 * <!-- Hydrate immediately (above fold, critical) -->
 * <SearchForm client:load />
 *
 * <!-- Hydrate when idle (below fold, non-critical) -->
 * <SearchForm client:idle />
 *
 * <!-- Hydrate when visible (far below fold) -->
 * <SearchForm client:visible />
 *
 * <!-- Only on mobile -->
 * <SearchForm client:media="(max-width: 768px)" />
 *
 * <!-- Only client-side (skip SSR) -->
 * <SearchForm client:only="react" />
 * ```
 */

import { useStore } from '@nanostores/react';
import { atom, map } from 'nanostores';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

// ============================================================================
// SHARED STATE (Nanostores)
// ============================================================================

/**
 * Search filters shared across islands
 * Multiple islands can read/write to this store
 */
export const searchFilters = map({
    query: '',
    destination: '',
    priceMin: 0,
    priceMax: 10000,
    stars: 0
});

/**
 * Search results shared state
 */
export const searchResults = atom<Accommodation[]>([]);

/**
 * Loading state shared across islands
 */
export const isSearching = atom(false);

// ============================================================================
// TYPES
// ============================================================================

interface Accommodation {
    id: string;
    name: string;
    slug: string;
    destination: string;
    pricePerNight: number;
    stars: number;
    imageUrl: string;
}

interface SearchFormProps {
    /**
     * Initial search query (from URL or server)
     */
    initialQuery?: string;

    /**
     * Show advanced filters
     */
    showFilters?: boolean;

    /**
     * Callback when search is performed
     */
    onSearch?: (query: string) => void;
}

// ============================================================================
// SEARCH FORM COMPONENT
// ============================================================================

export function SearchForm({ initialQuery = '', showFilters = true, onSearch }: SearchFormProps) {
    // --------------------------------------------------------------------------
    // LOCAL STATE (component-specific)
    // --------------------------------------------------------------------------

    const [localQuery, setLocalQuery] = useState(initialQuery);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // --------------------------------------------------------------------------
    // SHARED STATE (from Nanostores)
    // --------------------------------------------------------------------------

    const filters = useStore(searchFilters);
    const results = useStore(searchResults);
    const loading = useStore(isSearching);

    // --------------------------------------------------------------------------
    // DEBOUNCED SEARCH
    // --------------------------------------------------------------------------

    /**
     * Debounce search to avoid excessive API calls
     * Only triggers after user stops typing for 300ms
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localQuery !== filters.query) {
                searchFilters.setKey('query', localQuery);
                performSearch(localQuery);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [localQuery, filters.query]);

    // --------------------------------------------------------------------------
    // SEARCH LOGIC
    // --------------------------------------------------------------------------

    const performSearch = useCallback(
        async (query: string) => {
            if (!query.trim()) {
                searchResults.set([]);
                return;
            }

            try {
                isSearching.set(true);
                setErrors({});

                // Build query params
                const params = new URLSearchParams({
                    q: query,
                    destination: filters.destination,
                    priceMin: filters.priceMin.toString(),
                    priceMax: filters.priceMax.toString(),
                    stars: filters.stars.toString()
                });

                // Client-side fetch
                const response = await fetch(`/api/accommodations/search?${params}`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.success) {
                    searchResults.set(data.data.items);
                    onSearch?.(query);
                } else {
                    setErrors({ general: data.error || 'Error al buscar' });
                }
            } catch (error) {
                console.error('Search error:', error);
                setErrors({
                    general: error instanceof Error ? error.message : 'Error al buscar'
                });
            } finally {
                isSearching.set(false);
            }
        },
        [filters, onSearch]
    );

    // --------------------------------------------------------------------------
    // FORM HANDLERS
    // --------------------------------------------------------------------------

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        performSearch(localQuery);
    };

    const handleReset = () => {
        setLocalQuery('');
        searchFilters.set({
            query: '',
            destination: '',
            priceMin: 0,
            priceMax: 10000,
            stars: 0
        });
        searchResults.set([]);
        setErrors({});
    };

    // --------------------------------------------------------------------------
    // RENDER
    // --------------------------------------------------------------------------

    return (
        <div className="search-form">
            <form
                onSubmit={handleSubmit}
                className="space-y-4"
            >
                {/* Search Input */}
                <div className="form-group">
                    <label
                        htmlFor="search-query"
                        className="mb-1 block font-medium text-sm"
                    >
                        Buscar alojamientos
                    </label>
                    <input
                        id="search-query"
                        type="text"
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        placeholder="Hotel, cabaña, departamento..."
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        aria-label="Buscar alojamientos"
                        aria-describedby={errors.general ? 'search-error' : undefined}
                    />
                </div>

                {/* Advanced Filters (Optional) */}
                {showFilters && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Destination Filter */}
                        <div className="form-group">
                            <label
                                htmlFor="destination"
                                className="mb-1 block font-medium text-sm"
                            >
                                Destino
                            </label>
                            <select
                                id="destination"
                                value={filters.destination}
                                onChange={(e) =>
                                    searchFilters.setKey('destination', e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Todos los destinos</option>
                                <option value="concepcion-del-uruguay">
                                    Concepción del Uruguay
                                </option>
                                <option value="colon">Colón</option>
                                <option value="gualeguaychu">Gualeguaychú</option>
                                <option value="federacion">Federación</option>
                            </select>
                        </div>

                        {/* Stars Filter */}
                        <div className="form-group">
                            <label
                                htmlFor="stars"
                                className="mb-1 block font-medium text-sm"
                            >
                                Estrellas
                            </label>
                            <select
                                id="stars"
                                value={filters.stars}
                                onChange={(e) =>
                                    searchFilters.setKey('stars', Number(e.target.value))
                                }
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                            >
                                <option value="0">Todas</option>
                                <option value="1">1 estrella</option>
                                <option value="2">2 estrellas</option>
                                <option value="3">3 estrellas</option>
                                <option value="4">4 estrellas</option>
                                <option value="5">5 estrellas</option>
                            </select>
                        </div>

                        {/* Price Range */}
                        <div className="form-group md:col-span-2">
                            <label
                                htmlFor="price-range"
                                className="mb-1 block font-medium text-sm"
                            >
                                Precio por noche: ${filters.priceMin} - ${filters.priceMax}
                            </label>
                            <div className="flex gap-4">
                                <input
                                    id="price-range"
                                    type="range"
                                    min="0"
                                    max="10000"
                                    step="500"
                                    value={filters.priceMin}
                                    onChange={(e) =>
                                        searchFilters.setKey('priceMin', Number(e.target.value))
                                    }
                                    className="flex-1"
                                    aria-label="Precio mínimo"
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="10000"
                                    step="500"
                                    value={filters.priceMax}
                                    onChange={(e) =>
                                        searchFilters.setKey('priceMax', Number(e.target.value))
                                    }
                                    className="flex-1"
                                    aria-label="Precio máximo"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {errors.general && (
                    <div
                        id="search-error"
                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm"
                        role="alert"
                    >
                        {errors.general}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={loading || !localQuery.trim()}
                        className="rounded-lg bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>

                    <button
                        type="button"
                        onClick={handleReset}
                        className="rounded-lg border border-gray-300 px-6 py-2 font-medium transition-colors hover:bg-gray-50"
                    >
                        Limpiar
                    </button>
                </div>
            </form>

            {/* Results Count */}
            {results.length > 0 && (
                <div className="mt-6 text-gray-600 text-sm">
                    {results.length} {results.length === 1 ? 'resultado' : 'resultados'} encontrados
                </div>
            )}
        </div>
    );
}

// ============================================================================
// SEARCH RESULTS COMPONENT (Separate Island)
// ============================================================================

/**
 * Results display component
 * Can be a separate island that reads from shared state
 *
 * Usage:
 * ```astro
 * <SearchResults client:idle />
 * ```
 */
export function SearchResults() {
    const results = useStore(searchResults);
    const loading = useStore(isSearching);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                <span className="ml-3 text-gray-600">Buscando...</span>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="py-12 text-center text-gray-500">
                <p>No se encontraron resultados.</p>
                <p className="mt-2 text-sm">Intenta con otros términos de búsqueda.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map((accommodation) => (
                <a
                    key={accommodation.id}
                    href={`/alojamientos/${accommodation.slug}`}
                    className="block overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-xl"
                >
                    <img
                        src={accommodation.imageUrl}
                        alt={accommodation.name}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                    />
                    <div className="p-4">
                        <h3 className="mb-1 font-semibold text-lg">{accommodation.name}</h3>
                        <p className="mb-2 text-gray-600 text-sm">{accommodation.destination}</p>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center text-yellow-500">
                                {Array.from({ length: accommodation.stars }).map((_, i) => (
                                    <span key={`star-${i.toString()}`}>★</span>
                                ))}
                            </div>
                            <p className="font-medium text-primary">
                                ${accommodation.pricePerNight} / noche
                            </p>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}

// ============================================================================
// USAGE EXAMPLE IN ASTRO
// ============================================================================

/**
 * Example Astro page integrating both islands:
 *
 * ```astro
 * ---
 * // src/pages/buscar.astro
 * import MainLayout from '../layouts/MainLayout.astro';
 * import { SearchForm, SearchResults } from '../components/SearchForm';
 *
 * // Get query from URL (SSR)
 * const url = new URL(Astro.request.url);
 * const initialQuery = url.searchParams.get('q') || '';
 * ---
 *
 * <MainLayout title="Buscar Alojamientos">
 *   <div class="container mx-auto px-4 py-12">
 *     <h1 class="text-4xl font-bold mb-8">Buscar Alojamientos</h1>
 *
 *     <!-- Search form island (loads immediately) -->
 *     <SearchForm
 *       client:load
 *       initialQuery={initialQuery}
 *       showFilters={true}
 *     />
 *
 *     <!-- Results island (loads when idle) -->
 *     <div class="mt-12">
 *       <SearchResults client:idle />
 *     </div>
 *   </div>
 * </MainLayout>
 * ```
 */

// ============================================================================
// TESTING EXAMPLE
// ============================================================================

/**
 * Vitest test example:
 *
 * ```tsx
 * import { describe, it, expect, vi } from 'vitest';
 * import { render, screen, fireEvent, waitFor } from '@testing-library/react';
 * import { SearchForm } from './SearchForm';
 *
 * describe('SearchForm', () => {
 *   it('renders search input', () => {
 *     render(<SearchForm />);
 *     expect(screen.getByLabelText('Buscar alojamientos')).toBeInTheDocument();
 *   });
 *
 *   it('debounces search input', async () => {
 *     const onSearch = vi.fn();
 *     render(<SearchForm onSearch={onSearch} />);
 *
 *     const input = screen.getByLabelText('Buscar alojamientos');
 *     fireEvent.change(input, { target: { value: 'hotel' } });
 *
 *     // Should not call immediately
 *     expect(onSearch).not.toHaveBeenCalled();
 *
 *     // Should call after debounce delay
 *     await waitFor(() => expect(onSearch).toHaveBeenCalledWith('hotel'), {
 *       timeout: 500
 *     });
 *   });
 *
 *   it('shows loading state', async () => {
 *     render(<SearchForm />);
 *
 *     const input = screen.getByLabelText('Buscar alojamientos');
 *     fireEvent.change(input, { target: { value: 'hotel' } });
 *
 *     const button = screen.getByRole('button', { name: /buscar/i });
 *     fireEvent.click(button);
 *
 *     await waitFor(() => {
 *       expect(screen.getByText('Buscando...')).toBeInTheDocument();
 *     });
 *   });
 * });
 * ```
 */
