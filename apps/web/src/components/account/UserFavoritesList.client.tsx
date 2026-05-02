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

import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookmarkItem, BookmarksApiResponse, DeleteApiResponse } from './BookmarkGrid';
import { BookmarkGrid, EmptyFavorites } from './BookmarkGrid';
import { CollectionCard } from './CollectionCard';
import styles from './UserFavoritesList.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const API_BASE = '/api/v1/protected/user-bookmarks';
const COLLECTIONS_API_BASE = '/api/v1/protected/user-bookmark-collections';

/** Max collections to fetch in a single request (entity-agnostic, fetch once). */
const COLLECTIONS_PAGE_SIZE = 100;

/** URL path segment for collection detail pages. */
const COLLECTIONS_PATH = 'favoritos/colecciones';

// ─── Entity tab types ─────────────────────────────────────────────────────────

/** Supported entity types for the favorites tabs */
type FavoritesEntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

interface TabDefinition {
    readonly entityType: FavoritesEntityType;
    /** i18n key for the tab label */
    readonly labelKey: string;
    /** Accessible panel id */
    readonly panelId: string;
    /** Accessible tab id */
    readonly tabId: string;
    /** URL path segment for building entity links */
    readonly pathSegment: string;
    /** i18n key for the entity type label shown in card meta */
    readonly cardTypeKey: string;
}

const TABS: readonly TabDefinition[] = [
    {
        entityType: 'ACCOMMODATION',
        labelKey: 'account.favorites.tabs.accommodation',
        panelId: 'tab-panel-accommodation',
        tabId: 'tab-accommodation',
        pathSegment: 'alojamientos',
        cardTypeKey: 'account.favorites.tabs.accommodation'
    },
    {
        entityType: 'DESTINATION',
        labelKey: 'account.favorites.tabs.destination',
        panelId: 'tab-panel-destination',
        tabId: 'tab-destination',
        pathSegment: 'destinos',
        cardTypeKey: 'account.favorites.tabs.destination'
    },
    {
        entityType: 'EVENT',
        labelKey: 'account.favorites.tabs.event',
        panelId: 'tab-panel-event',
        tabId: 'tab-event',
        pathSegment: 'eventos',
        cardTypeKey: 'account.favorites.tabs.event'
    },
    {
        entityType: 'POST',
        labelKey: 'account.favorites.tabs.post',
        panelId: 'tab-panel-post',
        tabId: 'tab-post',
        pathSegment: 'publicaciones',
        cardTypeKey: 'account.favorites.tabs.post'
    }
] as const;

// ─── Tab counts map ────────────────────────────────────────────────────────────

type TabCounts = Readonly<Record<FavoritesEntityType, number>>;

const INITIAL_TAB_COUNTS: TabCounts = {
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
    const [activeTab, setActiveTab] = useState<FavoritesEntityType>('ACCOMMODATION');
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

    function handleTabChange(entityType: FavoritesEntityType) {
        if (entityType === activeTab) return;
        abortRef.current?.abort();
        setActiveTab(entityType);
        setPage(1);
        setBookmarks([]);
        setTotal(0);
        setError(null);
    }

    // ── Count-only fetches on mount ────────────────────────────────────────

    useEffect(() => {
        const controllers: AbortController[] = [];

        async function fetchCount(entityType: FavoritesEntityType): Promise<void> {
            const ctrl = new AbortController();
            controllers.push(ctrl);
            try {
                const params = new URLSearchParams({
                    entityType,
                    page: '1',
                    pageSize: '1'
                });
                const res = await fetch(`${base}${API_BASE}?${params.toString()}`, {
                    credentials: 'include',
                    signal: ctrl.signal
                });
                if (!res.ok) return;
                const body = (await res.json()) as BookmarksApiResponse;
                if (body.success && body.data) {
                    setTabCounts((prev) => ({ ...prev, [entityType]: body.data?.total ?? 0 }));
                }
            } catch {
                // Ignore aborts and network errors for count-only fetches
            }
        }

        void Promise.all(TABS.map((tab) => fetchCount(tab.entityType)));

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

    const fetchBookmarks = useCallback(
        async (entityType: FavoritesEntityType, targetPage: number, signal: AbortSignal) => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    entityType,
                    page: String(targetPage),
                    pageSize: String(PAGE_SIZE)
                });
                const res = await fetch(`${base}${API_BASE}?${params.toString()}`, {
                    credentials: 'include',
                    signal
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
                const fetchedTotal = body.data?.total ?? 0;
                setBookmarks([...(body.data?.bookmarks ?? [])]);
                setTotal(fetchedTotal);
                // Reuse active tab total for its badge (avoids extra round-trip)
                setTabCounts((prev) => ({ ...prev, [entityType]: fetchedTotal }));
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
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

    // ── Render helpers ────────────────────────────────────────────────────

    function tabLabel(tab: TabDefinition): string {
        return t(tab.labelKey, tab.entityType);
    }

    function renderTabsRow() {
        return (
            <div
                role="tablist"
                aria-label={t('account.favorites.listLabel', 'Mis favoritos')}
                className={styles.tabsRow}
            >
                {TABS.map((tab) => {
                    const isActive = tab.entityType === activeTab;
                    const count = tabCounts[tab.entityType];
                    return (
                        <button
                            key={tab.entityType}
                            id={tab.tabId}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={tab.panelId}
                            tabIndex={isActive ? 0 : -1}
                            className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                            onClick={() => handleTabChange(tab.entityType)}
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

    function renderUncollectedSection(pathSegment: string, cardTypeLabel: string) {
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
                        onRemove={(bookmark) => {
                            void handleRemove(bookmark);
                        }}
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
        const activeTabDef = TABS.find((tab) => tab.entityType === activeTab);
        const panelId = activeTabDef?.panelId ?? 'tab-panel-accommodation';
        const tabId = activeTabDef?.tabId ?? 'tab-accommodation';
        const pathSegment = activeTabDef?.pathSegment ?? 'alojamientos';
        const cardTypeLabel = t(
            activeTabDef?.cardTypeKey ?? 'account.favorites.tabs.accommodation',
            activeTab
        );

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

    return (
        <div className={styles.root}>
            {/* ── Tab navigation ─────────────────────────────────────── */}
            {renderTabsRow()}

            {/* ── Active tab panel ────────────────────────────────────── */}
            {renderTabPanel()}
        </div>
    );
}
