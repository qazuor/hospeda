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
import { z } from 'zod';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { DestinationCardClient, type DestinationItem } from './DestinationCard.client';
import { DESTINATION_TYPES, DestinationFilterPanel } from './DestinationFilterPanel.client';

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

const PAGE_SIZE = 12;

// ─── API helpers ─────────────────────────────────────────────────────────────

import { getApiUrl } from '../../lib/env';

const API_BASE = `${getApiUrl()}/api/v1/public`;

/** Zod schema for validating the destinations API response */
const destinationsResponseSchema = z
    .object({
        data: z
            .object({
                items: z.array(
                    z
                        .object({
                            id: z.string(),
                            name: z.string()
                        })
                        .passthrough()
                ),
                pagination: z
                    .object({
                        page: z.number(),
                        pageSize: z.number(),
                        total: z.number(),
                        totalPages: z.number()
                    })
                    .passthrough()
            })
            .passthrough()
    })
    .passthrough();

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
    const json: unknown = await response.json();
    const parsed = destinationsResponseSchema.safeParse(json);
    if (!parsed.success) {
        throw new Error(`Invalid API response: ${parsed.error.message}`);
    }
    const body = parsed.data;
    return {
        items: body.data.items as unknown as DestinationItem[],
        pagination: body.data.pagination as PaginationInfo
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Destination search and filter panel with client-side results rendering. */
export function DestinationFilters({
    initialQuery = '',
    initialType = '',
    initialParentId = '',
    locale
}: DestinationFiltersProps) {
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'destinations' });

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
    const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                setError(t('search.errorLoading'));
                setResults([]);
                setPagination(null);
            } finally {
                setIsLoading(false);
            }
        },
        [t]
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
            liveRegionRef.current.textContent = t('search.resultsAnnouncement', undefined, {
                count: results.length
            });
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
            if (filterDebounceRef.current !== null) {
                clearTimeout(filterDebounceRef.current);
            }
            filterDebounceRef.current = setTimeout(() => {
                fetchResults({ q: query, type: newType, parentId: '' });
            }, 300);
        },
        [query, updateUrlParams, fetchResults]
    );

    const handleParentChange = useCallback(
        (newParentId: string) => {
            setSelectedParentId(newParentId);
            updateUrlParams({ q: query, type: selectedType, parentId: newParentId });
            if (filterDebounceRef.current !== null) {
                clearTimeout(filterDebounceRef.current);
            }
            filterDebounceRef.current = setTimeout(() => {
                fetchResults({ q: query, type: selectedType, parentId: newParentId });
            }, 300);
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
            <DestinationFilterPanel
                query={query}
                onQueryChange={setQuery}
                selectedType={selectedType}
                onTypeChange={handleTypeChange}
                selectedParentId={selectedParentId}
                onParentChange={handleParentChange}
                hasActiveFilters={hasActiveFilters}
                onSearch={handleSearch}
                onClearFilters={handleClearFilters}
                showParentFilter={showParentFilter}
                parentOptions={parentOptions}
                isLoadingParents={isLoadingParents}
                parentError={parentError}
                searchInputRef={searchInputRef}
                t={t}
            />

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
                    <span className="ml-3 text-text-secondary">{t('search.loading')}</span>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-12 text-center">
                    <h3 className="mb-3 font-semibold text-text text-xl">
                        {t('search.errorLoading')}
                    </h3>
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-4 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark"
                    >
                        {t('search.clearFilters')}
                    </button>
                </div>
            )}

            {/* Filtered Results Grid */}
            {results !== null && !isLoading && !error ? (
                results.length > 0 ? (
                    <section
                        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                        aria-label={t('search.resultsAnnouncement', undefined, {
                            count: results.length
                        })}
                    >
                        {results.map((dest) => (
                            <DestinationCardClient
                                key={dest.id}
                                destination={dest}
                                locale={locale}
                                labels={{
                                    accommodation: t('search.accommodation'),
                                    accommodations: t('search.accommodations'),
                                    featured: t('search.featured')
                                }}
                            />
                        ))}
                    </section>
                ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-12 text-center">
                        <h3 className="mb-3 font-semibold text-text text-xl">
                            {t('search.noResults')}
                        </h3>
                        <p className="mb-6 text-base text-text-secondary">
                            {t('search.noResultsMessage')}
                        </p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark"
                        >
                            {t('search.clearFilters')}
                        </button>
                    </div>
                )
            ) : null}
        </div>
    );
}
