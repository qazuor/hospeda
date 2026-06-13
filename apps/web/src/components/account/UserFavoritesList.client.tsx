/**
 * @file UserFavoritesList.client.tsx
 * @description React island that lists the authenticated user's bookmarks with
 * entity type tabs (Alojamientos, Destinos, Eventos, Blog).
 *
 * T-049a: Adds tab navigation UI.
 * T-049b: Wires real data fetching for all 4 entity types. On mount, fires 4
 * parallel count-only fetches (pageSize=1) to populate tab badges. The active
 * tab's full-page fetch reuses its total for the badge. AbortController cancels
 * inflight requests when switching tabs rapidly.
 *
 * T-049c: Splits the tab panel into two sections:
 *   1. "Sin colección" — bookmarks where collectionId is null/undefined.
 *   2. "Mis colecciones" — user's collections fetched once on mount.
 * Collections are entity-agnostic, fetched once, and reused across all tabs.
 *
 * SPEC-098 wiring closeout: integrates the MoveToCollectionModal as a controlled
 * sub-component. The "Mover" button on each card opens the modal pre-filled with
 * the bookmark's current collectionId; on success the local state is updated,
 * collection counts are refetched, and a confirmation toast is shown.
 *
 * Fetches GET /api/v1/protected/user-bookmarks?entityType=<activeTab>&page=N&pageSize=M.
 * Renders a 12-per-page grid of cards. The "Quitar" button triggers an optimistic
 * DELETE so the card disappears immediately; on error the item is restored and a
 * toast is shown.
 *
 * Sub-components (BookmarkGrid, EmptyFavorites) live in BookmarkGrid.tsx.
 * CollectionCard lives in CollectionCard.tsx.
 *
 * Hydration: caller must use `client:load`.
 */

import { translateApiError } from '@/lib/api-errors';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookmarkItem, BookmarksApiResponse, DeleteApiResponse } from './BookmarkGrid';
import { BookmarkGrid, EmptyFavorites } from './BookmarkGrid';
import { CollectionCard } from './CollectionCard';
import { MoveToCollectionModal } from './MoveToCollectionModal.client';
import type { CollectionOption } from './MoveToCollectionModal.client';
import styles from './UserFavoritesList.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const API_BASE = '/api/v1/protected/user-bookmarks';
const COLLECTIONS_API_BASE = '/api/v1/protected/user-bookmark-collections';

/** Max collections to fetch in a single request (entity-agnostic, fetch once). */
const COLLECTIONS_PAGE_SIZE = 100;

/** URL path segment for collection detail pages. */
const COLLECTIONS_PATH = 'mi-cuenta/favoritos/colecciones';

// ─── Entity tab types ─────────────────────────────────────────────────────────

/** Supported entity types for the favorites tabs */
type FavoritesEntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

/**
 * Tab key extends entity types with a virtual "ALL" tab that aggregates every
 * type into a single grid. ALL is not an entity type — the API call omits the
 * `entityType` query param when ALL is active.
 */
type FavoritesTabKey = FavoritesEntityType | 'ALL';

interface TabDefinition {
    readonly key: FavoritesTabKey;
    /** i18n key for the tab label */
    readonly labelKey: string;
    /** Accessible panel id */
    readonly panelId: string;
    /** Accessible tab id */
    readonly tabId: string;
    /** URL path segment for building entity links (unused for ALL — resolved per-bookmark) */
    readonly pathSegment: string;
    /** i18n key for the entity type label shown in card meta (unused for ALL) */
    readonly cardTypeKey: string;
}

const TABS: readonly TabDefinition[] = [
    {
        key: 'ALL',
        labelKey: 'account.favorites.tabs.all',
        panelId: 'tab-panel-all',
        tabId: 'tab-all',
        pathSegment: '',
        cardTypeKey: 'account.favorites.tabs.all'
    },
    {
        key: 'ACCOMMODATION',
        labelKey: 'account.favorites.tabs.accommodation',
        panelId: 'tab-panel-accommodation',
        tabId: 'tab-accommodation',
        pathSegment: 'alojamientos',
        cardTypeKey: 'account.favorites.tabs.accommodation'
    },
    {
        key: 'DESTINATION',
        labelKey: 'account.favorites.tabs.destination',
        panelId: 'tab-panel-destination',
        tabId: 'tab-destination',
        pathSegment: 'destinos',
        cardTypeKey: 'account.favorites.tabs.destination'
    },
    {
        key: 'EVENT',
        labelKey: 'account.favorites.tabs.event',
        panelId: 'tab-panel-event',
        tabId: 'tab-event',
        pathSegment: 'eventos',
        cardTypeKey: 'account.favorites.tabs.event'
    },
    {
        key: 'POST',
        labelKey: 'account.favorites.tabs.post',
        panelId: 'tab-panel-post',
        tabId: 'tab-post',
        pathSegment: 'publicaciones',
        cardTypeKey: 'account.favorites.tabs.post'
    }
] as const;

/** Per-entity-type lookup tables used by the ALL tab to resolve URLs/labels. */
const ENTITY_PATH_SEGMENTS: Readonly<Record<FavoritesEntityType, string>> = {
    ACCOMMODATION: 'alojamientos',
    DESTINATION: 'destinos',
    EVENT: 'eventos',
    POST: 'publicaciones'
};

// ─── Tab counts map ────────────────────────────────────────────────────────────

type TabCounts = Readonly<Record<FavoritesTabKey, number>>;

const INITIAL_TAB_COUNTS: TabCounts = {
    ALL: 0,
    ACCOMMODATION: 0,
    DESTINATION: 0,
    EVENT: 0,
    POST: 0
};

// ─── Collections API response ─────────────────────────────────────────────────

interface CollectionsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly items: readonly BookmarkCollectionItem[];
        readonly total: number;
    };
    readonly error?: { readonly message: string };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserFavoritesListProps {
    /** Active locale for i18n strings and URL prefix */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Favorites list island.
 * - Shows entity type tabs (Alojamientos, Destinos, Eventos, Blog).
 * - On mount fires 4 parallel pageSize=1 fetches to populate tab count badges.
 * - On mount fetches all user collections (entity-agnostic, fetched once).
 * - Fetches user's bookmarks for the active tab on mount and tab/page change.
 * - AbortController cancels inflight requests when switching tabs rapidly.
 * - 12-per-page grid with prev/next pagination for uncollected bookmarks.
 * - Optimistic DELETE with revert-on-error.
 * - Tab panel split: "Sin colección" section + "Mis colecciones" section.
 */
export function UserFavoritesList({ locale, apiUrl }: UserFavoritesListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── Tab state ─────────────────────────────────────────────────────────
    // Default to ALL so the user lands on the aggregated view.
    const [activeTab, setActiveTab] = useState<FavoritesTabKey>('ALL');
    const [tabCounts, setTabCounts] = useState<TabCounts>(INITIAL_TAB_COUNTS);

    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    // ── Collections state (fetched once on mount) ──────────────────────────
    const [collections, setCollections] = useState<readonly BookmarkCollectionItem[]>([]);
    const [collectionsLoading, setCollectionsLoading] = useState(true);

    // ── Move-to-collection modal state ─────────────────────────────────────
    const [bookmarkToMove, setBookmarkToMove] = useState<BookmarkItem | null>(null);

    /** Ref to abort inflight tab-switch requests */
    const abortRef = useRef<AbortController | null>(null);

    /**
     * Server-side total and page count.
     * Pagination navigates server pages; client-side filtering (uncollected) only
     * affects which cards from the current page are rendered — not the page count.
     */
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Derived: split bookmarks by collectionId ───────────────────────────

    /**
     * Bookmarks from the current server page that have no collection assigned.
     * The pagination controls (prev/next) still navigate server pages because the
     * server is the source of truth for total count.
     */
    const uncollectedBookmarks = bookmarks.filter((b) => !b.collectionId);

    // ── Tab switch handler ─────────────────────────────────────────────────

    function handleTabChange(key: FavoritesTabKey) {
        if (key === activeTab) return;
        abortRef.current?.abort();
        setActiveTab(key);
        setPage(1);
        setBookmarks([]);
        setTotal(0);
        setError(null);
    }

    // ── Count-only fetches on mount ────────────────────────────────────────

    useEffect(() => {
        const controllers: AbortController[] = [];

        async function fetchCount(key: FavoritesTabKey): Promise<void> {
            const ctrl = new AbortController();
            controllers.push(ctrl);
            try {
                const params = new URLSearchParams({ page: '1', pageSize: '1' });
                // The ALL tab does not narrow by entityType — the server
                // returns the global count for the user.
                if (key !== 'ALL') {
                    params.set('entityType', key);
                }
                const res = await fetch(`${base}${API_BASE}?${params.toString()}`, {
                    credentials: 'include',
                    signal: ctrl.signal
                });
                if (!res.ok) return;
                const body = (await res.json()) as BookmarksApiResponse;
                if (body.success && body.data) {
                    setTabCounts((prev) => ({ ...prev, [key]: body.data?.total ?? 0 }));
                }
            } catch {
                // Ignore aborts and network errors for count-only fetches
            }
        }

        void Promise.all(TABS.map((tab) => fetchCount(tab.key)));

        return () => {
            for (const ctrl of controllers) ctrl.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base]);

    // ── Fetch collections once on mount ────────────────────────────────────

    useEffect(() => {
        let cancelled = false;

        async function fetchCollections(): Promise<void> {
            setCollectionsLoading(true);
            try {
                const params = new URLSearchParams({
                    page: '1',
                    pageSize: String(COLLECTIONS_PAGE_SIZE),
                    includeBookmarkCount: 'true'
                });
                const res = await fetch(`${base}${COLLECTIONS_API_BASE}?${params.toString()}`, {
                    credentials: 'include'
                });
                if (!res.ok || cancelled) return;
                const body = (await res.json()) as CollectionsApiResponse;
                if (!cancelled && body.success && body.data && Array.isArray(body.data.items)) {
                    setCollections(body.data.items);
                }
            } catch {
                // Non-critical: collections section will be empty but won't break the page
            } finally {
                if (!cancelled) setCollectionsLoading(false);
            }
        }

        void fetchCollections();

        return () => {
            cancelled = true;
        };
    }, [base]);

    // ── Main fetch for active tab ──────────────────────────────────────────

    // Pre-compute the fetch-error fallback string so the useCallback below
    // can depend on a stable primitive (strings have value-based identity)
    // instead of `t`, which `createTranslations(locale)` recreates on every
    // render. Including `t` directly caused fetchBookmarks to change
    // identity each render, re-firing the useEffect below and producing an
    // infinite fetch loop — the API rate-limited the client with 429s.
    const fetchErrorMsg = t('account.favorites.errors.fetchFailed', 'Error al cargar favoritos');

    const fetchBookmarks = useCallback(
        async (key: FavoritesTabKey, targetPage: number, signal: AbortSignal) => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(targetPage),
                    pageSize: String(PAGE_SIZE)
                });
                // ALL: no entityType filter → server returns the global list.
                if (key !== 'ALL') {
                    params.set('entityType', key);
                }
                const res = await fetch(`${base}${API_BASE}?${params.toString()}`, {
                    credentials: 'include',
                    signal
                });
                if (!res.ok) {
                    throw new Error(fetchErrorMsg);
                }
                const body = (await res.json()) as BookmarksApiResponse;
                if (!body.success) {
                    throw new Error(body.error?.message ?? fetchErrorMsg);
                }
                const fetchedTotal = body.data?.total ?? 0;
                setBookmarks([...(body.data?.bookmarks ?? [])]);
                setTotal(fetchedTotal);
                // Reuse active tab total for its badge (avoids extra round-trip)
                setTabCounts((prev) => ({ ...prev, [key]: fetchedTotal }));
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                const msg = err instanceof Error ? err.message : fetchErrorMsg;
                setError(msg);
            } finally {
                setLoading(false);
            }
        },
        [base, fetchErrorMsg]
    );

    useEffect(() => {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        void fetchBookmarks(activeTab, page, ctrl.signal);
        return () => {
            ctrl.abort();
        };
    }, [fetchBookmarks, page, activeTab]);

    // ── Note update ───────────────────────────────────────────────────────

    /**
     * Called by EditableNote (via BookmarkGrid) after a successful PATCH.
     * Updates the in-memory copy of the bookmark so the card reflects the
     * new description without a full re-fetch.
     */
    function handleNoteUpdated(bookmarkId: string, newDescription: string) {
        setBookmarks((prev) =>
            prev.map((b) => (b.id === bookmarkId ? { ...b, description: newDescription } : b))
        );
    }

    // ── Remove (optimistic) ───────────────────────────────────────────────

    async function handleRemove(bookmark: BookmarkItem) {
        // Capture only this bookmark's original index — NOT a full snapshot.
        // Restoring a whole snapshot on failure would re-insert other bookmarks
        // that a concurrent remove already deleted from the server (stale UI).
        const originalIndex = bookmarks.findIndex((b) => b.id === bookmark.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
        setTotal((prev) => Math.max(0, prev - 1));
        setRemovingIds((prev) => new Set([...prev, bookmark.id]));

        try {
            const res = await fetch(`${base}${API_BASE}/${bookmark.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) {
                const localizedFallback = t(
                    'account.favorites.errors.removeFailed',
                    'No se pudo eliminar el favorito'
                );
                let apiError: { code?: string; message?: string } | undefined;
                try {
                    const body = (await res.json()) as DeleteApiResponse;
                    if (body.error) apiError = body.error;
                } catch {
                    // ignore — keep apiError undefined; helper will use fallback
                }
                throw new Error(
                    translateApiError({ error: apiError, t, fallback: localizedFallback })
                );
            }
        } catch (err) {
            // Re-insert ONLY the failed bookmark at its original position; leave
            // any concurrently-removed bookmarks untouched.
            setBookmarks((prev) => {
                if (prev.some((b) => b.id === bookmark.id)) return prev;
                const next = [...prev];
                const insertAt =
                    originalIndex < 0 ? next.length : Math.min(originalIndex, next.length);
                next.splice(insertAt, 0, bookmark);
                return next;
            });
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

    // ── Move-to-collection handlers ────────────────────────────────────────

    /**
     * Open the MoveToCollectionModal for a specific bookmark.
     * The current collection (if any) is read from `bookmark.collectionId`.
     */
    function handleMoveOpen(bookmark: BookmarkItem) {
        setBookmarkToMove(bookmark);
    }

    /** Close the MoveToCollectionModal without saving. */
    function handleMoveClose() {
        setBookmarkToMove(null);
    }

    /**
     * Refetch collection counts after a successful move so the
     * "Mis colecciones" section reflects the new bookmark distribution.
     */
    const refetchCollections = useCallback(async (): Promise<void> => {
        try {
            const params = new URLSearchParams({
                page: '1',
                pageSize: String(COLLECTIONS_PAGE_SIZE),
                includeBookmarkCount: 'true'
            });
            const res = await fetch(`${base}${COLLECTIONS_API_BASE}?${params.toString()}`, {
                credentials: 'include'
            });
            if (!res.ok) return;
            const body = (await res.json()) as CollectionsApiResponse;
            if (body.success && body.data && Array.isArray(body.data.items)) {
                setCollections(body.data.items);
            }
        } catch {
            // Non-critical: refetch is a best-effort sync after a move
        }
    }, [base]);

    /**
     * Called after a successful move. Updates local state, refreshes the
     * active tab and collection counts, and shows a success toast.
     */
    function handleMoveSaved(params: {
        readonly newCollectionId: string | null;
        readonly newCollectionName: string | null;
    }): void {
        const { newCollectionId, newCollectionName } = params;

        // Update the local copy of the moved bookmark so the uncollected
        // section reflects the change without a full re-fetch.
        if (bookmarkToMove) {
            setBookmarks((prev) =>
                prev.map((b) =>
                    b.id === bookmarkToMove.id ? { ...b, collectionId: newCollectionId } : b
                )
            );
        }

        // Sync collection bookmark counts (best-effort).
        void refetchCollections();

        // Show a confirmation toast.
        const message =
            newCollectionId === null || newCollectionName === null
                ? t(
                      'account.favorites.collections.moveSuccessUncollected',
                      'Quitado de la colección'
                  )
                : t('account.favorites.collections.moveSuccess', 'Movido a {{name}}', {
                      name: newCollectionName
                  });
        addToast({ type: 'success', message });

        setBookmarkToMove(null);
    }

    // ── Render helpers ────────────────────────────────────────────────────

    function tabLabel(tab: TabDefinition): string {
        return t(tab.labelKey, tab.key);
    }

    function renderTabsRow() {
        return (
            <div
                role="tablist"
                aria-label={t('account.favorites.listLabel', 'Mis favoritos')}
                className={styles.tabsRow}
            >
                {TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    const count = tabCounts[tab.key];
                    return (
                        <button
                            key={tab.key}
                            id={tab.tabId}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={tab.panelId}
                            tabIndex={isActive ? 0 : -1}
                            className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                            onClick={() => handleTabChange(tab.key)}
                        >
                            {tabLabel(tab)}
                            {count > 0 && (
                                <span
                                    className={styles.tabBadge}
                                    aria-label={`(${count})`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    function renderUncollectedSection(
        pathSegment: string | ((entityType: string) => string),
        cardTypeLabel: string | ((entityType: string) => string)
    ) {
        const noCollectionLabel = t('account.favorites.collections.no_collection', 'Sin colección');

        return (
            <section
                className={styles.sectionBlock}
                aria-label={noCollectionLabel}
            >
                {/* Section heading */}
                <div className={styles.sectionHeading}>
                    <h3 className={styles.sectionHeadingTitle}>{noCollectionLabel}</h3>
                    <span className={styles.sectionHeadingCount}>
                        {uncollectedBookmarks.length}
                    </span>
                </div>

                {uncollectedBookmarks.length === 0 ? (
                    <EmptyFavorites
                        label={t(
                            'account.favorites.empty',
                            'No tenés favoritos en esta categoría.'
                        )}
                    />
                ) : (
                    <BookmarkGrid
                        bookmarks={uncollectedBookmarks}
                        total={total}
                        page={page}
                        totalPages={totalPages}
                        removingIds={removingIds}
                        locale={locale}
                        pathSegment={pathSegment}
                        cardTypeLabel={cardTypeLabel}
                        removeLabel={t('account.favorites.removeLabel', 'Quitar de favoritos')}
                        removingLabel={t('common.removing', 'Quitando…')}
                        removeBtnLabel={t('account.favorites.removeBtn', 'Quitar')}
                        noImageLabel={t('common.noImage', 'Sin imagen')}
                        untitledLabel={t('common.untitled', 'Sin título')}
                        listAriaLabel={t('account.favorites.listLabel', 'Mis favoritos')}
                        paginationAriaLabel={t('common.pagination', 'Paginación')}
                        prevLabel={t('common.prev', 'Anterior')}
                        nextLabel={t('common.next', 'Siguiente')}
                        prevPageLabel={t('common.prevPage', 'Página anterior')}
                        nextPageLabel={t('common.nextPage', 'Página siguiente')}
                        apiBase={base}
                        notePlaceholder={t(
                            'account.favorites.notes.placeholder',
                            'Agregá una nota personal...'
                        )}
                        noteSaveLabel={t('account.favorites.notes.save', 'Guardar nota')}
                        noteCancelLabel={t('account.favorites.notes.cancel', 'Cancelar')}
                        noteTextareaLabel={t(
                            'account.favorites.notes.placeholder',
                            'Agregá una nota personal...'
                        )}
                        noteEditButtonLabel={t(
                            'account.favorites.notes.placeholder',
                            'Agregá una nota personal...'
                        )}
                        noteSaveErrorMessage={t(
                            'account.favorites.errors.saveFailed',
                            'No se pudo guardar la nota'
                        )}
                        moveBtnLabel={t('account.favorites.collections.move', 'Mover')}
                        moveBtnAriaLabel={t(
                            'account.favorites.collections.move_button_aria',
                            'Mover a colección: {{name}}'
                        )}
                        onRemove={(bookmark) => {
                            void handleRemove(bookmark);
                        }}
                        onMove={handleMoveOpen}
                        onPageChange={setPage}
                        onNoteUpdated={handleNoteUpdated}
                    />
                )}
            </section>
        );
    }

    function renderCollectionsSection() {
        const collectionsTitle = t('account.favorites.collections.title', 'Mis colecciones');

        return (
            <section
                className={styles.sectionBlock}
                aria-label={collectionsTitle}
            >
                {/* Section heading */}
                <div className={styles.sectionHeading}>
                    <h3 className={styles.sectionHeadingTitle}>{collectionsTitle}</h3>
                    <span className={styles.sectionHeadingCount}>
                        {collectionsLoading ? '…' : collections.length}
                    </span>
                </div>

                {collectionsLoading ? (
                    <div
                        className={styles.loadingWrap}
                        aria-live="polite"
                        aria-busy="true"
                    >
                        {t('common.loading', 'Cargando…')}
                    </div>
                ) : collections.length === 0 ? (
                    <EmptyFavorites
                        label={t('account.favorites.collections.empty', 'Aún no tenés colecciones')}
                    />
                ) : (
                    <ul
                        className={styles.collectionsGrid}
                        aria-label={collectionsTitle}
                    >
                        {collections.map((col) => (
                            <CollectionCard
                                key={col.id}
                                collection={col}
                                locale={locale}
                                bookmarksLabel={t('account.favorites.removeLabel', 'favoritos')}
                                collectionsBasePath={COLLECTIONS_PATH}
                            />
                        ))}
                    </ul>
                )}
            </section>
        );
    }

    function renderTabPanel() {
        const activeTabDef = TABS.find((tab) => tab.key === activeTab);
        const panelId = activeTabDef?.panelId ?? 'tab-panel-all';
        const tabId = activeTabDef?.tabId ?? 'tab-all';

        // Pre-resolve the per-entity labels once so the ALL tab resolver does
        // not re-call t() on every card render.
        const labelByType: Record<FavoritesEntityType, string> = {
            ACCOMMODATION: t('account.favorites.tabs.accommodation', 'Alojamientos'),
            DESTINATION: t('account.favorites.tabs.destination', 'Destinos'),
            EVENT: t('account.favorites.tabs.event', 'Eventos'),
            POST: t('account.favorites.tabs.post', 'Posts')
        };

        // For the ALL tab the path segment and label must be resolved per
        // bookmark since every entity type can appear in the same grid.
        const pathSegment: string | ((entityType: string) => string) =
            activeTab === 'ALL'
                ? (entityType: string) =>
                      ENTITY_PATH_SEGMENTS[entityType as FavoritesEntityType] ??
                      entityType.toLowerCase()
                : (activeTabDef?.pathSegment ?? 'alojamientos');

        const cardTypeLabel: string | ((entityType: string) => string) =
            activeTab === 'ALL'
                ? (entityType: string) =>
                      labelByType[entityType as FavoritesEntityType] ?? entityType
                : t(activeTabDef?.cardTypeKey ?? 'account.favorites.tabs.accommodation', activeTab);

        return (
            <div
                id={panelId}
                role="tabpanel"
                aria-labelledby={tabId}
            >
                {loading && (
                    <div
                        className={styles.loadingWrap}
                        aria-live="polite"
                        aria-busy="true"
                    >
                        {t('common.loading', 'Cargando…')}
                    </div>
                )}

                {!loading && error && (
                    <div
                        className={styles.errorWrap}
                        role="alert"
                    >
                        <p style={{ margin: '0 0 var(--space-3, 12px)' }}>{error}</p>
                        <button
                            type="button"
                            className={styles.pageBtn}
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                const ctrl = new AbortController();
                                abortRef.current = ctrl;
                                void fetchBookmarks(activeTab, page, ctrl.signal);
                            }}
                        >
                            {t('common.retry', 'Reintentar')}
                        </button>
                    </div>
                )}

                {!loading && !error && (
                    <div className={styles.root}>
                        {/* ── Sin colección ────────────────────────────── */}
                        {renderUncollectedSection(pathSegment, cardTypeLabel)}

                        {/* ── Mis colecciones ──────────────────────────── */}
                        {renderCollectionsSection()}
                    </div>
                )}
            </div>
        );
    }

    // ── Main render ───────────────────────────────────────────────────────

    /**
     * Build the radio options shown in the MoveToCollectionModal.
     * Maps the entity-agnostic collections list to the modal's CollectionOption shape.
     */
    const moveModalCollections: readonly CollectionOption[] = collections.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        bookmarkCount: c.bookmarkCount
    }));

    return (
        <div className={styles.root}>
            {/* ── Tab navigation ─────────────────────────────────────── */}
            {renderTabsRow()}

            {/* ── Active tab panel ────────────────────────────────────── */}
            {renderTabPanel()}

            {/* ── Move-to-collection modal ────────────────────────────── */}
            {bookmarkToMove !== null && (
                <MoveToCollectionModal
                    isOpen
                    onClose={handleMoveClose}
                    onSaved={handleMoveSaved}
                    locale={locale}
                    bookmarkId={bookmarkToMove.id}
                    currentCollectionId={bookmarkToMove.collectionId ?? null}
                    collections={moveModalCollections}
                />
            )}
        </div>
    );
}
