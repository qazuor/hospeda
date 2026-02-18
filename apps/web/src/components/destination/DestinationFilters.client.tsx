import { SearchIcon } from '@repo/icons';
/**
 * Client-side destination search and filter island.
 *
 * Provides text search, destination type filter, and cascading parent filter.
 * When any filter is active, fetches filtered results from the API and renders
 * its own results grid, hiding the server-rendered default grid.
 *
 * URL params are managed via history.pushState for bookmarkability.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DestinationCardClient, type DestinationItem } from './DestinationCardClient';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Props passed from Astro frontmatter */
interface DestinationFiltersProps {
    readonly initialQuery?: string;
    readonly initialType?: string;
    readonly initialParentId?: string;
    readonly locale: string;
}

/** API paginated response shape */
interface PaginationInfo {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DESTINATION_TYPES = [
    'COUNTRY',
    'REGION',
    'PROVINCE',
    'DEPARTMENT',
    'CITY',
    'TOWN',
    'NEIGHBORHOOD'
] as const;

const PAGE_SIZE = 12;

/** Label shape for localized filter UI strings */
interface FilterLabels {
    searchPlaceholder: string;
    searchButton: string;
    typeLabel: string;
    allTypes: string;
    parentLabel: string;
    allParents: string;
    clearFilters: string;
    noResults: string;
    noResultsMessage: string;
    resultsAnnouncement: (count: number) => string;
    loadingParents: string;
    noParentsAvailable: string;
    errorLoading: string;
    accommodations: string;
    accommodation: string;
    featured: string;
    loading: string;
}

/** Localized labels for the filter UI */
const LABELS: Record<string, FilterLabels> = {
    es: {
        searchPlaceholder: 'Buscar destinos...',
        searchButton: 'Buscar',
        typeLabel: 'Tipo de destino',
        allTypes: 'Todos los tipos',
        parentLabel: 'Dentro de',
        allParents: 'Todos',
        clearFilters: 'Limpiar filtros',
        noResults: 'No se encontraron destinos',
        noResultsMessage: 'Intenta ajustar los filtros o limpiar la busqueda.',
        resultsAnnouncement: (count: number) => `${count} destinos encontrados`,
        loadingParents: 'Cargando opciones...',
        noParentsAvailable: 'Sin opciones disponibles',
        errorLoading: 'Error al cargar',
        accommodations: 'alojamientos',
        accommodation: 'alojamiento',
        featured: 'Destacado',
        loading: 'Cargando...'
    },
    en: {
        searchPlaceholder: 'Search destinations...',
        searchButton: 'Search',
        typeLabel: 'Destination type',
        allTypes: 'All types',
        parentLabel: 'Within',
        allParents: 'All',
        clearFilters: 'Clear filters',
        noResults: 'No destinations found',
        noResultsMessage: 'Try adjusting your filters or clearing the search.',
        resultsAnnouncement: (count: number) => `${count} destinations found`,
        loadingParents: 'Loading options...',
        noParentsAvailable: 'No options available',
        errorLoading: 'Error loading',
        accommodations: 'accommodations',
        accommodation: 'accommodation',
        featured: 'Featured',
        loading: 'Loading...'
    },
    pt: {
        searchPlaceholder: 'Pesquisar destinos...',
        searchButton: 'Pesquisar',
        typeLabel: 'Tipo de destino',
        allTypes: 'Todos os tipos',
        parentLabel: 'Dentro de',
        allParents: 'Todos',
        clearFilters: 'Limpar filtros',
        noResults: 'Nenhum destino encontrado',
        noResultsMessage: 'Tente ajustar os filtros ou limpar a pesquisa.',
        resultsAnnouncement: (count: number) => `${count} destinos encontrados`,
        loadingParents: 'Carregando opções...',
        noParentsAvailable: 'Sem opções disponíveis',
        errorLoading: 'Erro ao carregar',
        accommodations: 'acomodações',
        accommodation: 'acomodação',
        featured: 'Destaque',
        loading: 'Carregando...'
    }
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/public`;

/** Fetch destinations with optional filters */
async function fetchDestinations(params: {
    q?: string;
    destinationType?: string;
    parentDestinationId?: string;
    page?: number;
    pageSize?: number;
}): Promise<{ items: DestinationItem[]; pagination: PaginationInfo | null }> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
        }
    }
    const url = `${API_BASE}/destinations?${searchParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    const body = (await response.json()) as {
        data: { items: DestinationItem[]; pagination: PaginationInfo };
    };
    return { items: body.data.items, pagination: body.data.pagination };
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Destination search and filter panel with client-side results rendering. */
export function DestinationFilters({
    initialQuery = '',
    initialType = '',
    initialParentId = '',
    locale
}: DestinationFiltersProps) {
    const t = (LABELS[locale] ?? LABELS.es) as FilterLabels;

    // ── Filter state ──
    const [query, setQuery] = useState(initialQuery);
    const [selectedType, setSelectedType] = useState(initialType);
    const [selectedParentId, setSelectedParentId] = useState(initialParentId);

    // ── Results state ──
    const [results, setResults] = useState<DestinationItem[] | null>(null);
    const [_pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Parent options state ──
    const [parentOptions, setParentOptions] = useState<DestinationItem[]>([]);
    const [isLoadingParents, setIsLoadingParents] = useState(false);
    const [parentError, setParentError] = useState(false);

    const liveRegionRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const hasActiveFilters = query !== '' || selectedType !== '' || selectedParentId !== '';

    // ── URL param sync ──
    const updateUrlParams = useCallback(
        (params: { q?: string; type?: string; parentId?: string }) => {
            const url = new URL(window.location.href);
            for (const [key, value] of Object.entries(params)) {
                if (value) {
                    url.searchParams.set(key, value);
                } else {
                    url.searchParams.delete(key);
                }
            }
            // Reset page when filters change
            url.searchParams.delete('page');
            window.history.pushState({}, '', url.toString());
        },
        []
    );

    // ── Fetch filtered results ──
    const fetchResults = useCallback(
        async (params: { q: string; type: string; parentId: string }) => {
            const { q, type, parentId } = params;
            if (!q && !type && !parentId) {
                setResults(null);
                setPagination(null);
                setError(null);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchDestinations({
                    q: q || undefined,
                    destinationType: type || undefined,
                    parentDestinationId: parentId || undefined,
                    page: 1,
                    pageSize: PAGE_SIZE
                });
                setResults(data.items);
                setPagination(data.pagination);
            } catch {
                setError(t.errorLoading);
                setResults([]);
                setPagination(null);
            } finally {
                setIsLoading(false);
            }
        },
        [t.errorLoading]
    );

    // ── Toggle server grid visibility ──
    useEffect(() => {
        const serverGrid = document.getElementById('featured-destinations');
        const serverPagination = document.getElementById('pagination');
        if (hasActiveFilters || isLoading) {
            serverGrid?.classList.add('hidden');
            serverPagination?.classList.add('hidden');
        } else {
            serverGrid?.classList.remove('hidden');
            serverPagination?.classList.remove('hidden');
        }
    }, [hasActiveFilters, isLoading]);

    // ── Announce results to screen readers ──
    useEffect(() => {
        if (results !== null && liveRegionRef.current) {
            liveRegionRef.current.textContent = t.resultsAnnouncement(results.length);
        }
    }, [results, t]);

    // ── Fetch parent options when type changes ──
    useEffect(() => {
        if (!selectedType) {
            setParentOptions([]);
            setParentError(false);
            return;
        }

        // Determine the parent type level
        const typeIndex = DESTINATION_TYPES.indexOf(
            selectedType as (typeof DESTINATION_TYPES)[number]
        );
        if (typeIndex <= 0) {
            setParentOptions([]);
            return;
        }

        const parentType = DESTINATION_TYPES[typeIndex - 1];
        setIsLoadingParents(true);
        setParentError(false);

        fetchDestinations({ destinationType: parentType, pageSize: 100 })
            .then((data) => {
                setParentOptions(data.items);
            })
            .catch(() => {
                setParentError(true);
                setParentOptions([]);
            })
            .finally(() => {
                setIsLoadingParents(false);
            });
    }, [selectedType]);

    // ── Initial fetch if URL has params ──
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect with initial URL params
    useEffect(() => {
        if (initialQuery || initialType || initialParentId) {
            fetchResults({ q: initialQuery, type: initialType, parentId: initialParentId });
        }
    }, []);

    // ── Handlers ──

    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            updateUrlParams({ q: query, type: selectedType, parentId: selectedParentId });
            fetchResults({ q: query, type: selectedType, parentId: selectedParentId });
        },
        [query, selectedType, selectedParentId, updateUrlParams, fetchResults]
    );

    const handleTypeChange = useCallback(
        (newType: string) => {
            setSelectedType(newType);
            setSelectedParentId('');
            updateUrlParams({ q: query, type: newType, parentId: '' });
            fetchResults({ q: query, type: newType, parentId: '' });
        },
        [query, updateUrlParams, fetchResults]
    );

    const handleParentChange = useCallback(
        (newParentId: string) => {
            setSelectedParentId(newParentId);
            updateUrlParams({ q: query, type: selectedType, parentId: newParentId });
            fetchResults({ q: query, type: selectedType, parentId: newParentId });
        },
        [query, selectedType, updateUrlParams, fetchResults]
    );

    const handleClearFilters = useCallback(() => {
        setQuery('');
        setSelectedType('');
        setSelectedParentId('');
        setResults(null);
        setPagination(null);
        setError(null);
        updateUrlParams({ q: '', type: '', parentId: '' });
        searchInputRef.current?.focus();
    }, [updateUrlParams]);

    // ── Determine parent dropdown visibility ──
    const showParentFilter =
        selectedType !== '' &&
        DESTINATION_TYPES.indexOf(selectedType as (typeof DESTINATION_TYPES)[number]) > 0;

    // ── Render ──
    return (
        <div className="space-y-4">
            {/* Search + Filters Panel */}
            <div className="mx-auto max-w-4xl rounded-xl border border-border bg-surface p-4 shadow-md">
                {/* Search Form */}
                <form
                    onSubmit={handleSearch}
                    className="flex gap-2"
                >
                    <label
                        htmlFor="destination-search"
                        className="sr-only"
                    >
                        {t.searchPlaceholder}
                    </label>
                    <div className="relative flex-1">
                        <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3">
                            <SearchIcon
                                size={18}
                                className="text-text-tertiary"
                                aria-hidden="true"
                            />
                        </div>
                        <input
                            ref={searchInputRef}
                            id="destination-search"
                            type="text"
                            name="q"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full rounded-lg border border-border bg-bg py-2.5 pr-3 pl-10 text-text-primary placeholder-text-tertiary"
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-white transition-colors hover:bg-primary-dark"
                        aria-label={t.searchButton}
                    >
                        <SearchIcon
                            size={20}
                            aria-hidden="true"
                        />
                    </button>
                </form>

                {/* Filter Controls */}
                <div className="mt-4 flex flex-wrap items-end gap-4">
                    {/* Type Filter */}
                    <div className="min-w-[180px] flex-1">
                        <label
                            htmlFor="destination-type-filter"
                            className="mb-1 block font-medium text-sm text-text-secondary"
                        >
                            {t.typeLabel}
                        </label>
                        <select
                            id="destination-type-filter"
                            value={selectedType}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text-primary"
                        >
                            <option value="">{t.allTypes}</option>
                            {DESTINATION_TYPES.map((type) => (
                                <option
                                    key={type}
                                    value={type}
                                >
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Parent Filter (conditional) */}
                    {showParentFilter && (
                        <div className="min-w-[180px] flex-1">
                            <label
                                htmlFor="destination-parent-filter"
                                className="mb-1 block font-medium text-sm text-text-secondary"
                            >
                                {t.parentLabel}
                            </label>
                            <select
                                id="destination-parent-filter"
                                value={selectedParentId}
                                onChange={(e) => handleParentChange(e.target.value)}
                                disabled={isLoadingParents || parentError}
                                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">
                                    {isLoadingParents
                                        ? t.loadingParents
                                        : parentError
                                          ? t.noParentsAvailable
                                          : t.allParents}
                                </option>
                                {parentOptions.map((parent) => (
                                    <option
                                        key={parent.id}
                                        value={parent.id}
                                    >
                                        {parent.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="rounded-lg border border-border bg-bg px-4 py-2.5 font-medium text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                        >
                            {t.clearFilters}
                        </button>
                    )}
                </div>
            </div>

            {/* Screen reader live region */}
            <div
                ref={liveRegionRef}
                aria-live="polite"
                className="sr-only"
            />

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="ml-3 text-text-secondary">{t.loading}</span>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-12 text-center">
                    <h3 className="mb-3 font-semibold text-text text-xl">{t.errorLoading}</h3>
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-4 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark"
                    >
                        {t.clearFilters}
                    </button>
                </div>
            )}

            {/* Filtered Results Grid */}
            {results !== null && !isLoading && !error ? (
                results.length > 0 ? (
                    <section
                        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                        aria-label={t.resultsAnnouncement(results.length)}
                    >
                        {results.map((dest) => (
                            <DestinationCardClient
                                key={dest.id}
                                destination={dest}
                                locale={locale}
                            />
                        ))}
                    </section>
                ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-12 text-center">
                        <h3 className="mb-3 font-semibold text-text text-xl">{t.noResults}</h3>
                        <p className="mb-6 text-base text-text-secondary">{t.noResultsMessage}</p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark"
                        >
                            {t.clearFilters}
                        </button>
                    </div>
                )
            ) : null}
        </div>
    );
}
