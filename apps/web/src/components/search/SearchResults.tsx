'use client';

import { useCallback, useEffect, useState } from 'react';

interface SearchResultsProps {
    initialQuery: string;
    initialLocation: string;
    apiBaseUrl: string;
}

interface AccommodationResult {
    id: string;
    name: string;
    slug: string;
    description?: string;
    type?: string;
    averageRating?: number;
    reviewsCount?: number;
    location?: {
        city?: string;
        state?: string;
    };
    media?: {
        featuredImage?: { url: string };
        gallery?: Array<{ url: string }>;
    };
}

interface SearchState {
    results: AccommodationResult[];
    loading: boolean;
    error: string;
    total: number;
    page: number;
    totalPages: number;
}

/**
 * SearchResults React island for searching accommodations via the API.
 * Handles filtering, pagination, loading, and empty states.
 */
export const SearchResults = ({
    initialQuery,
    initialLocation,
    apiBaseUrl
}: SearchResultsProps) => {
    const [location, setLocation] = useState(initialLocation);
    const [checkin, setCheckin] = useState('');
    const [checkout, setCheckout] = useState('');
    const [state, setState] = useState<SearchState>({
        results: [],
        loading: false,
        error: '',
        total: 0,
        page: 1,
        totalPages: 0
    });

    const fetchResults = useCallback(
        async ({ page = 1 }: { page?: number } = {}) => {
            setState((prev) => ({ ...prev, loading: true, error: '' }));

            try {
                const params = new URLSearchParams();
                if (location) params.set('search', location);
                if (initialQuery) params.set('search', initialQuery);
                params.set('page', String(page));
                params.set('pageSize', '12');

                const response = await fetch(
                    `${apiBaseUrl}/api/v1/public/accommodations?${params.toString()}`
                );

                if (!response.ok) {
                    throw new Error('Error al buscar alojamientos');
                }

                const data = await response.json();
                const items = data?.data || data?.items || [];
                const pagination = data?.pagination || {};

                setState({
                    results: items,
                    loading: false,
                    error: '',
                    total: pagination.total || items.length,
                    page: pagination.page || page,
                    totalPages: pagination.totalPages || 1
                });
            } catch {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: 'Error al buscar. Intenta de nuevo.'
                }));
            }
        },
        [location, initialQuery, apiBaseUrl]
    );

    useEffect(() => {
        if (initialQuery || initialLocation) {
            fetchResults();
        }
    }, [initialQuery, initialLocation, fetchResults]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchResults({ page: 1 });
    };

    const getImageUrl = (acc: AccommodationResult): string | undefined => {
        return acc.media?.featuredImage?.url || acc.media?.gallery?.[0]?.url;
    };

    return (
        <div>
            {/* Search Form */}
            <div className="border-gray-200 border-b bg-gray-50 py-8 dark:border-gray-700 dark:bg-gray-800">
                <div className="container mx-auto px-4">
                    <form
                        onSubmit={handleSearch}
                        className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label
                                    htmlFor="search-location"
                                    className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                                >
                                    Destino
                                </label>
                                <input
                                    type="text"
                                    id="search-location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                    placeholder="Ciudad o destino..."
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="search-checkin"
                                    className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                                >
                                    Check-in
                                </label>
                                <input
                                    type="date"
                                    id="search-checkin"
                                    value={checkin}
                                    onChange={(e) => setCheckin(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="search-checkout"
                                    className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                                >
                                    Check-out
                                </label>
                                <input
                                    type="date"
                                    id="search-checkout"
                                    value={checkout}
                                    onChange={(e) => setCheckout(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    className="w-full rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-orange-700"
                                >
                                    Buscar
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Results */}
            <div className="py-12">
                <div className="container mx-auto px-4">
                    {state.loading && (
                        <div className="space-y-6">
                            {Array.from({ length: 3 }, (_, i) => (
                                <div
                                    key={`skeleton-${String(i)}`}
                                    className="animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
                                >
                                    <div className="md:flex">
                                        <div className="h-48 bg-gray-200 md:w-1/3 dark:bg-gray-700" />
                                        <div className="space-y-4 p-6 md:w-2/3">
                                            <div className="h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                                            <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                                            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {state.error && (
                        <div className="py-12 text-center">
                            <p className="text-red-600 dark:text-red-400">{state.error}</p>
                            <button
                                type="button"
                                onClick={() => fetchResults()}
                                className="mt-4 text-orange-600 underline hover:text-orange-700"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}

                    {!state.loading &&
                        !state.error &&
                        state.results.length === 0 &&
                        (initialQuery || initialLocation || location) && (
                            <div className="py-12 text-center">
                                <svg
                                    className="mx-auto mb-4 h-16 w-16 text-gray-400 dark:text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <h3 className="mb-2 font-medium text-gray-900 text-lg dark:text-white">
                                    No se encontraron resultados
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Intenta con otros criterios de busqueda
                                </p>
                            </div>
                        )}

                    {!state.loading &&
                        !state.error &&
                        state.results.length === 0 &&
                        !initialQuery &&
                        !initialLocation &&
                        !location && (
                            <div className="py-12 text-center">
                                <svg
                                    className="mx-auto mb-4 h-16 w-16 text-gray-400 dark:text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <h3 className="mb-2 font-medium text-gray-900 text-lg dark:text-white">
                                    Ingresa tu busqueda
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Usa el formulario para buscar alojamientos
                                </p>
                            </div>
                        )}

                    {!state.loading && state.results.length > 0 && (
                        <>
                            <div className="mb-6">
                                <p className="text-gray-600 dark:text-gray-400">
                                    {state.total} alojamiento{state.total !== 1 ? 's' : ''}{' '}
                                    encontrado{state.total !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="space-y-6">
                                {state.results.map((acc) => (
                                    <div
                                        key={acc.id}
                                        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        <div className="md:flex">
                                            <div className="md:w-1/3">
                                                {getImageUrl(acc) ? (
                                                    <img
                                                        src={getImageUrl(acc)}
                                                        alt={acc.name}
                                                        className="h-48 w-full object-cover md:h-full"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="h-48 w-full bg-gradient-to-br from-orange-400 to-red-500 md:h-full" />
                                                )}
                                            </div>
                                            <div className="p-6 md:w-2/3">
                                                <div className="mb-2 flex items-start justify-between">
                                                    <h3 className="font-semibold text-gray-900 text-lg dark:text-white">
                                                        {acc.name}
                                                    </h3>
                                                    {acc.type && (
                                                        <span className="rounded bg-orange-100 px-2 py-1 text-orange-800 text-xs dark:bg-orange-900/30 dark:text-orange-300">
                                                            {acc.type}
                                                        </span>
                                                    )}
                                                </div>
                                                {acc.description && (
                                                    <p className="mb-4 line-clamp-2 text-gray-600 dark:text-gray-400">
                                                        {acc.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center text-gray-500 text-sm dark:text-gray-400">
                                                        <svg
                                                            className="mr-1 h-4 w-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                            aria-hidden="true"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                        {acc.location?.city ||
                                                            acc.location?.state ||
                                                            'Sin ubicacion'}
                                                    </div>
                                                    <a
                                                        href={`/alojamientos/${acc.slug}/`}
                                                        className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-orange-700"
                                                    >
                                                        Ver detalles
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {state.totalPages > 1 && (
                                <div className="mt-8 flex justify-center space-x-2">
                                    {state.page > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => fetchResults({ page: state.page - 1 })}
                                            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                        >
                                            Anterior
                                        </button>
                                    )}
                                    <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                        Pagina {state.page} de {state.totalPages}
                                    </span>
                                    {state.page < state.totalPages && (
                                        <button
                                            type="button"
                                            onClick={() => fetchResults({ page: state.page + 1 })}
                                            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                        >
                                            Siguiente
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
