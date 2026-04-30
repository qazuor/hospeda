/**
 * @file UserFavoritesList.client.tsx
 * @description React island that lists the authenticated user's accommodation
 * bookmarks with optimistic removal and pagination.
 *
 * Fetches GET /api/v1/protected/user-bookmarks?entityType=ACCOMMODATION on
 * mount. Renders a 12-per-page grid of cards. The "Quitar" button triggers an
 * optimistic DELETE so the card disappears immediately; on error the item
 * is restored and a toast is shown.
 *
 * Hydration: caller must use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useState } from 'react';
import styles from './UserFavoritesList.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const API_BASE = '/api/v1/protected/user-bookmarks';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape of a bookmark returned by the API */
interface BookmarkItem {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: string;
    /** Display name stored at bookmark-creation time */
    readonly name?: string | null;
    /** Thumbnail image URL (may be absent) */
    readonly imageUrl?: string | null;
    /** Entity URL (may be absent for non-accommodation types) */
    readonly entityUrl?: string | null;
}

/** API response shape for the bookmarks list */
interface BookmarksApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly bookmarks: readonly BookmarkItem[];
        readonly total: number;
    };
    readonly error?: { readonly message: string };
}

/** API response shape for bookmark delete */
interface DeleteApiResponse {
    readonly success: boolean;
    readonly error?: { readonly message: string };
}

interface UserFavoritesListProps {
    /** Active locale for i18n strings */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

// ─── Empty state (inline React, since EmptyState is Astro-only) ───────────────

/** Minimal inline empty state for React context */
function EmptyFavorites({ label }: { readonly label: string }) {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: 'var(--space-10, 40px) var(--space-6, 24px)',
                color: 'var(--muted-foreground)',
                fontFamily: 'var(--font-sans)',
                background: 'var(--card)',
                borderRadius: 'var(--radius-card)',
                border: '1px dashed var(--border)'
            }}
        >
            <p style={{ margin: 0 }}>{label}</p>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Favorites list island.
 * - Fetches user's accommodation bookmarks on mount.
 * - 12-per-page grid with prev/next pagination.
 * - Optimistic DELETE with revert-on-error.
 */
export function UserFavoritesList({ locale, apiUrl }: UserFavoritesListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Fetch ─────────────────────────────────────────────────────────────

    const fetchBookmarks = useCallback(
        async (targetPage: number) => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    entityType: 'ACCOMMODATION',
                    page: String(targetPage),
                    pageSize: String(PAGE_SIZE)
                });
                const res = await fetch(`${base}${API_BASE}?${params.toString()}`, {
                    credentials: 'include'
                });
                if (!res.ok) {
                    throw new Error(
                        t('account.favorites.errors.fetchFailed', 'Error al cargar favoritos')
                    );
                }
                const body = (await res.json()) as BookmarksApiResponse;
                if (!body.success) {
                    throw new Error(
                        body.error?.message ??
                            t('account.favorites.errors.fetchFailed', 'Error al cargar favoritos')
                    );
                }
                setBookmarks([...(body.data?.bookmarks ?? [])]);
                setTotal(body.data?.total ?? 0);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : t('account.favorites.errors.fetchFailed', 'Error al cargar favoritos');
                setError(msg);
            } finally {
                setLoading(false);
            }
        },
        [base, t]
    );

    useEffect(() => {
        void fetchBookmarks(page);
    }, [fetchBookmarks, page]);

    // ── Remove (optimistic) ───────────────────────────────────────────────

    async function handleRemove(bookmark: BookmarkItem) {
        // Optimistic: remove immediately from local state
        const snapshot = [...bookmarks];
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
        setTotal((prev) => Math.max(0, prev - 1));
        setRemovingIds((prev) => new Set([...prev, bookmark.id]));

        try {
            const res = await fetch(`${base}${API_BASE}/${bookmark.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) {
                let msg = t(
                    'account.favorites.errors.removeFailed',
                    'No se pudo eliminar el favorito'
                );
                try {
                    const body = (await res.json()) as DeleteApiResponse;
                    if (body.error?.message) msg = body.error.message;
                } catch {
                    // ignore
                }
                throw new Error(msg);
            }
        } catch (err) {
            // Revert optimistic update on failure
            setBookmarks(snapshot);
            setTotal((prev) => prev + 1);
            const msg =
                err instanceof Error
                    ? err.message
                    : t('account.favorites.errors.removeFailed', 'No se pudo eliminar el favorito');
            addToast({ type: 'error', message: msg });
        } finally {
            setRemovingIds((prev) => {
                const next = new Set(prev);
                next.delete(bookmark.id);
                return next;
            });
        }
    }

    // ── Render ────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div
                className={styles.loadingWrap}
                aria-live="polite"
                aria-busy="true"
            >
                {t('common.loading', 'Cargando…')}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={styles.errorWrap}
                role="alert"
            >
                {error}
            </div>
        );
    }

    if (bookmarks.length === 0) {
        return (
            <EmptyFavorites
                label={t('account.favorites.empty', 'Aún no tenés alojamientos favoritos.')}
            />
        );
    }

    return (
        <div className={styles.root}>
            {/* ── Grid ───────────────────────────────────────────────── */}
            <ul
                className={styles.grid}
                aria-label={t('account.favorites.listLabel', 'Alojamientos favoritos')}
            >
                {bookmarks.map((bookmark) => (
                    <li
                        key={bookmark.id}
                        className={styles.card}
                    >
                        {/* Image */}
                        <div className={styles.cardImage}>
                            {bookmark.imageUrl ? (
                                <img
                                    src={bookmark.imageUrl}
                                    alt={bookmark.name ?? ''}
                                    className={styles.cardImg}
                                    loading="lazy"
                                />
                            ) : (
                                <div
                                    className={styles.cardImagePlaceholder}
                                    aria-hidden="true"
                                >
                                    {t('common.noImage', 'Sin imagen')}
                                </div>
                            )}
                        </div>

                        {/* Body */}
                        <div className={styles.cardBody}>
                            <h3 className={styles.cardTitle}>
                                {bookmark.entityUrl ? (
                                    <a
                                        href={bookmark.entityUrl}
                                        className={styles.cardTitleLink}
                                    >
                                        {bookmark.name ?? t('common.untitled', 'Sin título')}
                                    </a>
                                ) : (
                                    (bookmark.name ?? t('common.untitled', 'Sin título'))
                                )}
                            </h3>
                            <p className={styles.cardMeta}>
                                {t('account.favorites.cardType', 'Alojamiento')}
                            </p>
                        </div>

                        {/* Footer with remove button */}
                        <div className={styles.cardFooter}>
                            <button
                                type="button"
                                className={styles.removeBtn}
                                disabled={removingIds.has(bookmark.id)}
                                onClick={() => {
                                    void handleRemove(bookmark);
                                }}
                                aria-label={`${t('account.favorites.removeLabel', 'Quitar de favoritos')}: ${bookmark.name ?? ''}`}
                            >
                                {removingIds.has(bookmark.id)
                                    ? t('common.removing', 'Quitando…')
                                    : t('account.favorites.removeBtn', 'Quitar')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {/* ── Pagination ─────────────────────────────────────────── */}
            {totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label={t('common.pagination', 'Paginación')}
                >
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label={t('common.prevPage', 'Página anterior')}
                    >
                        {t('common.prev', 'Anterior')}
                    </button>
                    <span className={styles.pageInfo}>
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label={t('common.nextPage', 'Página siguiente')}
                    >
                        {t('common.next', 'Siguiente')}
                    </button>
                </nav>
            )}
        </div>
    );
}
