/**
 * @file SearchResultsLive.client.tsx
 * @description Live search results React island. Accepts SSR-fetched initial
 * results and a pre-populated query. Re-fetches from the public search API on
 * input change with a 300ms debounce. Groups results by entity type:
 * Alojamientos, Destinos, Eventos, Publicaciones.
 *
 * Hydration: client:load (page needs to be interactive immediately).
 */

import { LoadingButton } from '@/components/shared/feedback/LoadingButton';
import type {
    PublicSearchGroup,
    PublicSearchResponse,
    PublicSearchResultItem
} from '@/lib/api/endpoints';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SearchResultsLive.module.css';

// ─── Props ───────────────────────────────────────────────────────────────────

interface SearchResultsLiveProps {
    /** Query populated server-side from ?q= URL param. */
    readonly initialQuery: string;
    /** Results fetched server-side (null when query was too short). */
    readonly initialResults: PublicSearchResponse | null;
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** Popular tag shortcuts shown when the query is empty. */
    readonly popularTags: readonly string[];
    /** Base URL for the search page (used to build tag shortcut hrefs). */
    readonly searchBaseUrl: string;
}

// ─── Group configuration ──────────────────────────────────────────────────────

interface GroupConfig {
    readonly key: keyof PublicSearchResponse;
    readonly label: string;
    readonly icon: string;
    readonly basePath: string;
    readonly entityLabel: string;
}

// ─── Helper hooks ─────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// ─── Sub-component: single result card ───────────────────────────────────────

interface ResultCardProps {
    readonly item: PublicSearchResultItem;
    readonly href: string;
}

function ResultCard({ item, href }: ResultCardProps) {
    return (
        <a
            href={href}
            className={styles.card}
        >
            {item.coverImage ? (
                <img
                    src={item.coverImage}
                    alt={item.name}
                    className={styles.cardImage}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                <div
                    className={styles.cardImagePlaceholder}
                    aria-hidden="true"
                >
                    🏠
                </div>
            )}
            <div className={styles.cardContent}>
                <p className={styles.cardName}>{item.name}</p>
                {item.category && <p className={styles.cardMeta}>{item.category}</p>}
            </div>
        </a>
    );
}

// ─── Sub-component: result group section ─────────────────────────────────────

interface ResultGroupProps {
    readonly config: GroupConfig;
    readonly group: PublicSearchGroup;
    readonly query: string;
    readonly locale: SupportedLocale;
}

function ResultGroup({ config, group, query, locale }: ResultGroupProps) {
    if (group.items.length === 0) return null;

    const viewAllHref = `/${locale}/${config.basePath}/?q=${encodeURIComponent(query)}`;

    return (
        <section className={styles.group}>
            <div className={styles.groupHeader}>
                <h2 className={styles.groupTitle}>
                    <span aria-hidden="true">{config.icon}</span>
                    {config.label}
                    <span className={styles.groupCount}>({group.total})</span>
                </h2>
                {group.total > group.items.length && (
                    <a
                        href={viewAllHref}
                        className={styles.viewAllLink}
                    >
                        Ver todos →
                    </a>
                )}
            </div>
            <div className={styles.grid}>
                {group.items.map((item) => (
                    <ResultCard
                        key={item.id}
                        item={item}
                        href={`/${locale}/${config.basePath}/${item.slug}/`}
                    />
                ))}
            </div>
        </section>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Live search results island. Handles the full search UX:
 * - Empty state with popular tags
 * - Debounced re-fetch on input (300ms)
 * - Grouped results by entity type
 * - "Ver todos" link to entity listing with pre-filled q
 */
export function SearchResultsLive({
    initialQuery,
    initialResults,
    locale,
    popularTags,
    searchBaseUrl
}: SearchResultsLiveProps) {
    const { t } = createTranslations(locale);
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<PublicSearchResponse | null>(initialResults);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    // Track the last query for which we already have results (SSR-populated).
    // Skip the initial fetch when results were pre-loaded server-side.
    const lastFetchedQuery = useRef(initialResults != null ? initialQuery : '');

    const debouncedQuery = useDebounce(query, 300);

    const groupConfigs = useCallback(
        (): readonly GroupConfig[] => [
            {
                key: 'accommodations',
                label: t('search.groups.accommodations', 'Alojamientos'),
                icon: '🏠',
                basePath: 'alojamientos',
                entityLabel: t('search.groups.accommodations', 'Alojamientos')
            },
            {
                key: 'destinations',
                label: t('search.groups.destinations', 'Destinos'),
                icon: '📍',
                basePath: 'destinos',
                entityLabel: t('search.groups.destinations', 'Destinos')
            },
            {
                key: 'events',
                label: t('search.groups.events', 'Eventos'),
                icon: '🎉',
                basePath: 'eventos',
                entityLabel: t('search.groups.events', 'Eventos')
            },
            {
                key: 'posts',
                label: t('search.groups.posts', 'Publicaciones'),
                icon: '📝',
                basePath: 'publicaciones',
                entityLabel: t('search.groups.posts', 'Publicaciones')
            }
        ],
        [t]
    );

    // Re-fetch when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults(null);
            return;
        }

        // Skip fetch when we already have SSR results for this exact query
        if (debouncedQuery === lastFetchedQuery.current) {
            return;
        }

        // Abort previous request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);

        const url = `/api/v1/public/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`;

        fetch(url, { signal: controller.signal })
            .then(async (res) => {
                if (!res.ok) throw new Error('Search failed');
                const json = (await res.json()) as { data: PublicSearchResponse };
                // API wraps in { success, data } envelope
                // TYPE-WORKAROUND: tolerate both wrapped and unwrapped responses while we migrate the public/search endpoint to the canonical envelope.
                setResults(json.data ?? (json as unknown as PublicSearchResponse));
                lastFetchedQuery.current = debouncedQuery;
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === 'AbortError') return;
                setResults(null);
            })
            .finally(() => {
                setIsLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [debouncedQuery]);

    const hasQuery = query.length >= 2;
    const configs = groupConfigs();
    const totalHits = results ? configs.reduce((sum, c) => sum + results[c.key].total, 0) : 0;

    return (
        <>
            {/* Search form */}
            <form
                className={styles.form}
                action={searchBaseUrl}
                method="get"
            >
                <label
                    htmlFor="search-input"
                    className="sr-only"
                >
                    {t('search.label', 'Buscar')}
                </label>
                <input
                    id="search-input"
                    type="search"
                    name="q"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    placeholder={t(
                        'search.placeholder',
                        'Buscar alojamientos, destinos, eventos...'
                    )}
                    className={styles.input}
                    aria-label={t('search.label', 'Buscar')}
                />
                <LoadingButton
                    type="submit"
                    className={styles.btn}
                    loading={isLoading}
                    loadingLabel={t('search.searching', 'Buscando…')}
                    aria-label={t('search.submit', 'Buscar')}
                >
                    {t('search.submit', 'Buscar')}
                </LoadingButton>
            </form>

            {/* Empty state: popular tags */}
            {!hasQuery && (
                <div className={styles.suggestions}>
                    <h2 className={styles.suggestionsTitle}>
                        {t('search.popular', 'Búsquedas populares')}
                    </h2>
                    <div className={styles.tags}>
                        {popularTags.map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                className={styles.tag}
                                onClick={() => setQuery(tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading state */}
            {hasQuery && isLoading && (
                <p
                    className={styles.loading}
                    aria-live="polite"
                >
                    {t('search.loading', 'Buscando...')}
                </p>
            )}

            {/* Results */}
            {hasQuery && !isLoading && results && (
                <>
                    <p
                        className={styles.resultsInfo}
                        aria-live="polite"
                    >
                        {t('search.resultsFor', 'Resultados para')}: <strong>{query}</strong> (
                        {totalHits})
                    </p>

                    {totalHits === 0 ? (
                        <div
                            className={styles.noResults}
                            role="alert"
                            aria-live="polite"
                        >
                            <p>
                                {t(
                                    'search.noResults',
                                    'No encontramos resultados para tu búsqueda.'
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className={styles.groups}>
                            {configs.map((config) => (
                                <ResultGroup
                                    key={config.key}
                                    config={config}
                                    group={results[config.key]}
                                    query={query}
                                    locale={locale}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Query too short */}
            {hasQuery && !isLoading && !results && query.length >= 2 && (
                <div
                    className={styles.noResults}
                    role="alert"
                    aria-live="polite"
                >
                    <p>
                        {t(
                            'search.errorFetching',
                            'No se pudo obtener resultados. Intentá de nuevo.'
                        )}
                    </p>
                </div>
            )}
        </>
    );
}
