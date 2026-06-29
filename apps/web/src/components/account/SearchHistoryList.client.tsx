/**
 * @file SearchHistoryList.client.tsx
 * @description React island for the search history page (SPEC-289 P3).
 *
 * Renders the authenticated user's past search entries with:
 *  - Query summary + compact filter chips
 *  - Relative timestamp
 *  - Result count badge
 *  - "Re-run" action (rebuilds the search URL and navigates)
 *  - Delete-one action (inline confirmation)
 *  - "Clear all" action (inline confirmation)
 *  - Opt-out preference toggle
 *
 * All API calls go to `/api/v1/protected/search-history/*`.
 * The initial `searchHistoryEnabled` state is provided by the Astro page
 * (fetched server-side) to avoid a flash on mount.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { formatRelativeTime } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrlWithParams } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import type { SearchHistoryFilters, UserSearchHistoryListItem } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SearchHistoryList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of each item returned by GET /api/v1/protected/search-history */
interface SearchHistoryApiItem {
    readonly id: string;
    readonly userId: string;
    readonly queryText: string | null;
    readonly filtersJson: SearchHistoryFilters | null;
    readonly resultCount: number | null;
    /** ISO timestamp string from JSON serialization */
    readonly createdAt: string;
}

/** List response envelope */
interface HistoryListResponse {
    readonly success: boolean;
    readonly data?: {
        readonly items?: SearchHistoryApiItem[];
    };
    readonly error?: { readonly message?: string };
}

/** Generic mutation response envelope */
interface MutationResponse {
    readonly success: boolean;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
    };
}

/** Props for the SearchHistoryList island */
export interface SearchHistoryListProps {
    /** Active locale for i18n and URL building */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
    /**
     * Authenticated user ID.
     * NOTE: not used for API calls — the session cookie is authoritative for
     * all protected endpoints. Reserved for future display purposes.
     */
    readonly userId: string;
    /**
     * Initial value of the `searchHistoryEnabled` preference.
     * Fetched server-side to avoid a flash on mount.
     */
    readonly initialHistoryEnabled: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the "re-run" URL from a stored search entry.
 *
 * Maps stored `SearchHistoryFilters` fields to the URL params accepted by
 * `/[lang]/alojamientos/`. Date fields are formatted as ISO date strings
 * (YYYY-MM-DD). For `minGuests`, we approximate with the `adults` param since
 * the original adults/children split is not stored.
 *
 * @param params - Entry data and locale for URL building
 * @returns A full URL path with query string
 */
function buildRerunUrl({
    locale,
    queryText,
    filtersJson
}: {
    readonly locale: SupportedLocale;
    readonly queryText: string | null;
    readonly filtersJson: SearchHistoryFilters | null;
}): string {
    const params: Record<string, string> = {};

    if (queryText) {
        params.q = queryText;
    }

    if (filtersJson) {
        if (filtersJson.destinationId) {
            params.destinationIds = filtersJson.destinationId;
        }
        if (filtersJson.minPrice != null) {
            params.minPrice = String(filtersJson.minPrice);
        }
        if (filtersJson.maxPrice != null) {
            params.maxPrice = String(filtersJson.maxPrice);
        }
        if (filtersJson.minGuests != null) {
            params.adults = String(filtersJson.minGuests);
        }
        if (filtersJson.minBedrooms != null) {
            params.minBedrooms = String(filtersJson.minBedrooms);
        }
        if (filtersJson.minBathrooms != null) {
            params.minBathrooms = String(filtersJson.minBathrooms);
        }
        if (filtersJson.minRating != null) {
            params.minRating = String(filtersJson.minRating);
        }
        if (filtersJson.hasPool) {
            params.hasPool = 'true';
        }
        if (filtersJson.hasWifi) {
            params.hasWifi = 'true';
        }
        if (filtersJson.hasParking) {
            params.hasParking = 'true';
        }
        if (filtersJson.allowsPets) {
            params.allowsPets = 'true';
        }
        if (filtersJson.isFeatured) {
            params.isFeatured = 'true';
        }
        // `type` (single) takes precedence; fall through to `types` (array) otherwise.
        if (filtersJson.type) {
            params.types = filtersJson.type;
        } else if (filtersJson.types?.length) {
            params.types = filtersJson.types.join(',');
        }
        if (filtersJson.amenities?.length) {
            params.amenities = filtersJson.amenities.join(',');
        }
        if (filtersJson.features?.length) {
            params.features = filtersJson.features.join(',');
        }
        if (filtersJson.checkIn) {
            const d =
                filtersJson.checkIn instanceof Date
                    ? filtersJson.checkIn
                    : new Date(filtersJson.checkIn as unknown as string);
            params.checkIn = d.toISOString().split('T')[0] ?? '';
        }
        if (filtersJson.checkOut) {
            const d =
                filtersJson.checkOut instanceof Date
                    ? filtersJson.checkOut
                    : new Date(filtersJson.checkOut as unknown as string);
            params.checkOut = d.toISOString().split('T')[0] ?? '';
        }
    }

    return buildUrlWithParams({ locale, path: 'alojamientos', params });
}

/**
 * Count the number of active filters in a `SearchHistoryFilters` object.
 *
 * Used to render a concise "N filters" badge on each entry.
 *
 * @param filtersJson - Stored filter object, or null
 * @returns Number of distinct active filters
 */
function countActiveFilters(filtersJson: SearchHistoryFilters | null): number {
    if (!filtersJson) return 0;
    let count = 0;
    if (filtersJson.destinationId) count++;
    if (filtersJson.minPrice != null || filtersJson.maxPrice != null) count++;
    if (filtersJson.minGuests != null || filtersJson.maxGuests != null) count++;
    if (filtersJson.minBedrooms != null) count++;
    if (filtersJson.minBathrooms != null) count++;
    if (filtersJson.minRating != null) count++;
    if (filtersJson.hasPool) count++;
    if (filtersJson.hasWifi) count++;
    if (filtersJson.hasParking) count++;
    if (filtersJson.allowsPets) count++;
    if (filtersJson.isFeatured) count++;
    if (filtersJson.type || filtersJson.types?.length) count++;
    if (filtersJson.amenities?.length) count++;
    if (filtersJson.features?.length) count++;
    if (filtersJson.checkIn || filtersJson.checkOut) count++;
    return count;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Search history list island.
 *
 * Lists the authenticated user's past searches, provides re-run, delete,
 * clear-all, and opt-out toggle actions.
 */
export function SearchHistoryList({
    locale,
    apiUrl,
    userId: _userId,
    initialHistoryEnabled
}: SearchHistoryListProps) {
    const { t, tPlural } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [entries, setEntries] = useState<SearchHistoryApiItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isHistoryEnabled, setIsHistoryEnabled] = useState(initialHistoryEnabled);
    const [isTogglingPreference, setIsTogglingPreference] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [confirmClearVisible, setConfirmClearVisible] = useState(false);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Pre-compute translated strings that appear in callbacks to avoid stale
    // deps on the `t` function (same pattern as PreferenceToggles).
    const fetchErrorMsg = t('account.searchHistory.errorFetch', 'No se pudo cargar el historial');
    const deleteErrorMsg = t(
        'account.searchHistory.deleteError',
        'No se pudo eliminar la búsqueda'
    );
    const clearErrorMsg = t('account.searchHistory.clearError', 'No se pudo borrar el historial');
    const optOutErrorMsg = t(
        'account.searchHistory.optOut.error',
        'No se pudo actualizar la preferencia'
    );
    const deleteSuccessMsg = t('account.searchHistory.deleteSuccess', 'Búsqueda eliminada');
    const clearSuccessMsg = t('account.searchHistory.clearSuccess', 'Historial borrado');

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchEntries = useCallback(async () => {
        if (!isMountedRef.current) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${base}/api/v1/protected/search-history`, {
                credentials: 'include'
            });
            if (!res.ok) {
                throw new Error(fetchErrorMsg);
            }
            const body = (await res.json()) as HistoryListResponse;
            if (!body.success) {
                throw new Error(body.error?.message ?? fetchErrorMsg);
            }
            if (isMountedRef.current) {
                setEntries(body.data?.items ?? []);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : fetchErrorMsg);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [base, fetchErrorMsg]);

    useEffect(() => {
        void fetchEntries();
    }, [fetchEntries]);

    // ── Delete one ────────────────────────────────────────────────────────────

    /**
     * Hard-delete a single history entry.
     * Shows inline confirmation before calling the API.
     */
    const handleDeleteConfirm = useCallback(
        async (id: string) => {
            setDeletingId(id);
            setConfirmDeleteId(null);
            try {
                const res = await fetch(`${base}/api/v1/protected/search-history/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const body = (await res.json()) as MutationResponse;
                if (!res.ok || !body.success) {
                    throw new Error(body.error?.message ?? deleteErrorMsg);
                }
                if (isMountedRef.current) {
                    setEntries((prev) => prev.filter((e) => e.id !== id));
                    addToast({ type: 'success', message: deleteSuccessMsg });
                }
            } catch (err) {
                addToast({
                    type: 'error',
                    message: err instanceof Error ? err.message : deleteErrorMsg
                });
            } finally {
                if (isMountedRef.current) {
                    setDeletingId(null);
                }
            }
        },
        [base, deleteErrorMsg, deleteSuccessMsg]
    );

    // ── Clear all ─────────────────────────────────────────────────────────────

    /**
     * Hard-delete all history entries for this user.
     * Requires inline confirmation before calling the API.
     */
    const handleClearAll = useCallback(async () => {
        setIsClearing(true);
        setConfirmClearVisible(false);
        try {
            const res = await fetch(`${base}/api/v1/protected/search-history`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const body = (await res.json()) as MutationResponse;
            if (!res.ok || !body.success) {
                throw new Error(body.error?.message ?? clearErrorMsg);
            }
            if (isMountedRef.current) {
                setEntries([]);
                addToast({ type: 'success', message: clearSuccessMsg });
            }
        } catch (err) {
            addToast({
                type: 'error',
                message: err instanceof Error ? err.message : clearErrorMsg
            });
        } finally {
            if (isMountedRef.current) {
                setIsClearing(false);
            }
        }
    }, [base, clearErrorMsg, clearSuccessMsg]);

    // ── Toggle opt-out ────────────────────────────────────────────────────────

    /**
     * Toggle the `searchHistoryEnabled` preference for the current user.
     * Optimistically updates local state; reverts on API error.
     */
    const handleTogglePreference = useCallback(async () => {
        const newEnabled = !isHistoryEnabled;
        setIsHistoryEnabled(newEnabled);
        setIsTogglingPreference(true);
        try {
            const res = await fetch(`${base}/api/v1/protected/search-history/preferences`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
            const body = (await res.json()) as MutationResponse;
            if (!res.ok || !body.success) {
                throw new Error(body.error?.message ?? optOutErrorMsg);
            }
        } catch (err) {
            // Revert on failure
            if (isMountedRef.current) {
                setIsHistoryEnabled(!newEnabled);
                addToast({
                    type: 'error',
                    message: err instanceof Error ? err.message : optOutErrorMsg
                });
            }
        } finally {
            if (isMountedRef.current) {
                setIsTogglingPreference(false);
            }
        }
    }, [base, isHistoryEnabled, optOutErrorMsg]);

    // ─────────────────────────────────────────────────────────────────────────

    // ── Render helpers ────────────────────────────────────────────────────────

    /** Format result count as a readable string. */
    function formatResultCount(count: number | null): string {
        if (count === null) return '';
        if (count === 0) return t('account.searchHistory.noResults', 'Sin resultados');
        return t('account.searchHistory.results', '{{count}} resultados', { count });
    }

    // ── Loading state ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div
                className={styles['search-history']}
                aria-busy="true"
            >
                <p
                    className={styles['search-history__loading']}
                    aria-live="polite"
                >
                    {t('account.searchHistory.loading', 'Cargando historial...')}
                </p>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (error) {
        return (
            <div className={styles['search-history']}>
                <p
                    className={styles['search-history__error']}
                    role="alert"
                >
                    {error}
                </p>
                <button
                    type="button"
                    className={styles['search-history__retry-btn']}
                    onClick={() => void fetchEntries()}
                >
                    {t('common.retry', 'Reintentar')}
                </button>
            </div>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    const isEmpty = entries.length === 0;

    return (
        <div className={styles['search-history']}>
            {/* ── Opt-out preference toggle ─────────────────────────────── */}
            <div className={styles['search-history__opt-out']}>
                <div className={styles['search-history__opt-out-text']}>
                    <span className={styles['search-history__opt-out-label']}>
                        {t('account.searchHistory.optOut.label', 'Historial de búsquedas')}
                    </span>
                    <span className={styles['search-history__opt-out-desc']}>
                        {t(
                            'account.searchHistory.optOut.description',
                            'Guardá tus búsquedas recientes para repetirlas con un clic.'
                        )}
                    </span>
                </div>

                <button
                    type="button"
                    role="switch"
                    aria-checked={isHistoryEnabled}
                    className={[
                        styles['search-history__toggle'],
                        isHistoryEnabled
                            ? styles['search-history__toggle--on']
                            : styles['search-history__toggle--off']
                    ].join(' ')}
                    onClick={() => void handleTogglePreference()}
                    disabled={isTogglingPreference}
                    aria-label={
                        isTogglingPreference
                            ? t('account.searchHistory.optOut.saving', 'Guardando...')
                            : isHistoryEnabled
                              ? t('account.searchHistory.optOut.enabled', 'Activado')
                              : t('account.searchHistory.optOut.disabled', 'Desactivado')
                    }
                >
                    <span
                        className={styles['search-history__toggle-thumb']}
                        aria-hidden="true"
                    />
                    <span className={styles['search-history__toggle-label-sr']}>
                        {isHistoryEnabled
                            ? t('account.searchHistory.optOut.enabled', 'Activado')
                            : t('account.searchHistory.optOut.disabled', 'Desactivado')}
                    </span>
                </button>
            </div>

            {/* ── Header with clear-all action ──────────────────────────── */}
            {!isEmpty && (
                <div className={styles['search-history__header']}>
                    {confirmClearVisible ? (
                        <div
                            className={styles['search-history__confirm-inline']}
                            // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the inline confirmation prompt with its action buttons; no native element fits (fieldset implies form fields, not an action confirmation)
                            role="group"
                            aria-label={t('account.searchHistory.clearAll', 'Borrar todo')}
                        >
                            <span className={styles['search-history__confirm-question']}>
                                {t('account.searchHistory.clearAll', 'Borrar todo')}?
                            </span>
                            <button
                                type="button"
                                className={styles['search-history__confirm-yes']}
                                onClick={() => void handleClearAll()}
                            >
                                {t('account.searchHistory.clearAllInline', 'Sí, borrar todo')}
                            </button>
                            <button
                                type="button"
                                className={styles['search-history__confirm-no']}
                                onClick={() => setConfirmClearVisible(false)}
                            >
                                {t('account.searchHistory.clearAllCancel', 'Cancelar')}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={styles['search-history__clear-btn']}
                            onClick={() => setConfirmClearVisible(true)}
                            disabled={isClearing}
                        >
                            {isClearing
                                ? t('common.deleting', 'Eliminando...')
                                : t('account.searchHistory.clearAll', 'Borrar todo')}
                        </button>
                    )}
                </div>
            )}

            {/* ── List ──────────────────────────────────────────────────── */}
            {isEmpty ? (
                <div
                    className={styles['search-history__empty']}
                    aria-live="polite"
                >
                    <p className={styles['search-history__empty-title']}>
                        {t('account.searchHistory.empty.title', 'Sin búsquedas guardadas')}
                    </p>
                    <p className={styles['search-history__empty-body']}>
                        {t(
                            'account.searchHistory.empty.body',
                            'Tus búsquedas aparecerán acá cuando tengas un plan Plus o VIP activo.'
                        )}
                    </p>
                </div>
            ) : (
                <ul
                    className={styles['search-history__list']}
                    aria-label={t('account.pages.searchHistory.title', 'Historial de búsquedas')}
                >
                    {entries.map((entry) => {
                        const rerunUrl = buildRerunUrl({
                            locale,
                            queryText: entry.queryText,
                            filtersJson: entry.filtersJson
                        });
                        const filterCount = countActiveFilters(entry.filtersJson);
                        const isDeleting = deletingId === entry.id;
                        const confirmingThis = confirmDeleteId === entry.id;

                        return (
                            <li
                                key={entry.id}
                                className={[
                                    styles['search-history__item'],
                                    isDeleting ? styles['search-history__item--deleting'] : ''
                                ].join(' ')}
                                aria-busy={isDeleting}
                            >
                                {/* Query + filter summary */}
                                <div className={styles['search-history__item-content']}>
                                    <p className={styles['search-history__item-query']}>
                                        {entry.queryText
                                            ? entry.queryText.length > 70
                                                ? `${entry.queryText.slice(0, 70)}…`
                                                : entry.queryText
                                            : t(
                                                  'account.searchHistory.noQuery',
                                                  'Búsqueda sin texto'
                                              )}
                                    </p>

                                    <div className={styles['search-history__item-meta']}>
                                        {filterCount > 0 && (
                                            <span
                                                className={styles['search-history__filter-badge']}
                                            >
                                                {tPlural(
                                                    'account.searchHistory.filters.filterCount',
                                                    filterCount
                                                )}
                                            </span>
                                        )}

                                        {entry.resultCount !== null && (
                                            <span
                                                className={styles['search-history__result-count']}
                                            >
                                                {formatResultCount(entry.resultCount)}
                                            </span>
                                        )}

                                        <time
                                            className={styles['search-history__item-time']}
                                            dateTime={entry.createdAt}
                                            title={new Date(entry.createdAt).toLocaleString()}
                                        >
                                            {formatRelativeTime({ date: entry.createdAt, locale })}
                                        </time>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className={styles['search-history__item-actions']}>
                                    <a
                                        href={rerunUrl}
                                        className={styles['search-history__rerun-btn']}
                                        aria-label={`${t('account.searchHistory.rerun', 'Repetir búsqueda')}: ${entry.queryText ?? t('account.searchHistory.noQuery', 'Búsqueda sin texto')}`}
                                    >
                                        {t('account.searchHistory.rerun', 'Repetir búsqueda')}
                                    </a>

                                    {confirmingThis ? (
                                        <div
                                            className={styles['search-history__delete-confirm']}
                                            // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the inline confirmation prompt with its action buttons; no native element fits (fieldset implies form fields, not an action confirmation)
                                            role="group"
                                            aria-label={`${t('account.searchHistory.deleteConfirmAria', 'Confirmar eliminación')}: ${entry.queryText ?? t('account.searchHistory.noQuery', 'Búsqueda sin texto')}`}
                                        >
                                            <button
                                                type="button"
                                                className={styles['search-history__confirm-yes']}
                                                onClick={() => void handleDeleteConfirm(entry.id)}
                                            >
                                                {t(
                                                    'account.searchHistory.deleteOneConfirm',
                                                    'Sí, eliminar'
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className={styles['search-history__confirm-no']}
                                                onClick={() => setConfirmDeleteId(null)}
                                            >
                                                {t(
                                                    'account.searchHistory.clearAllCancel',
                                                    'Cancelar'
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className={styles['search-history__delete-btn']}
                                            onClick={() => setConfirmDeleteId(entry.id)}
                                            disabled={isDeleting || deletingId !== null}
                                            aria-label={`${t('account.searchHistory.deleteOne', 'Eliminar')}: ${entry.queryText ?? t('account.searchHistory.noQuery', 'Búsqueda sin texto')}`}
                                        >
                                            {t('account.searchHistory.deleteOne', 'Eliminar')}
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// Exported type alias so tests can import the exact item shape.
export type { SearchHistoryApiItem };
// UserSearchHistoryListItem is re-exported for downstream consumers.
export type { UserSearchHistoryListItem };
