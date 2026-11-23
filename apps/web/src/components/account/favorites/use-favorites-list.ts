/**
 * @file use-favorites-list.ts
 * @description State of the «Sin colección» region of the favorites page
 * (HOS-2480): the active type tab, the server page, the loaded bookmarks and
 * the tab counts.
 *
 * The region is exposed as an `AsyncResult`, so a failed read is `error` with
 * a retry and never an empty grid (HOS-2414 AC-2). A tab count that fails to
 * load is simply absent: the tab then shows no count instead of a false `0`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncResult } from '@/components/account/ui';
import {
    type BookmarkItem,
    type BookmarksPage,
    deleteBookmark,
    FAVORITES_PAGE_SIZE,
    fetchTabCount,
    fetchUncollectedPage
} from './favorites-api';
import { FAVORITES_TABS, type FavoritesTabKey } from './favorites-tabs';

/** Raw state of the current page read. */
type PageState =
    | { readonly status: 'loading' }
    | { readonly status: 'error' }
    | { readonly status: 'ready'; readonly data: BookmarksPage };

/** Result of {@link useFavoritesList}. */
export interface UseFavoritesListResult {
    /** The active tab. */
    readonly tab: FavoritesTabKey;
    /** Switches tab (back to page 1). */
    readonly selectTab: (tab: FavoritesTabKey) => void;
    /** Current page, 1-based. */
    readonly page: number;
    /** Total pages of the uncollected list (at least 1). */
    readonly pageCount: number;
    /** Goes to a page. */
    readonly setPage: (page: number) => void;
    /** The region state. `empty` only after a SUCCESSFUL read with no bookmarks. */
    readonly state: AsyncResult<BookmarksPage>;
    /** Count per tab; a missing entry means the count could not be read. */
    readonly counts: Readonly<Partial<Record<FavoritesTabKey, number>>>;
    /** Bookmark ids with a removal in flight. */
    readonly removingIds: ReadonlySet<string>;
    /**
     * Removes a bookmark optimistically (call it AFTER the user confirmed).
     * On failure the card comes back and the promise rejects (a
     * `FavoritesApiError` when the API answered).
     */
    readonly remove: (bookmark: BookmarkItem) => Promise<void>;
    /** Applies a successful move: a bookmark that joined a collection leaves the list. */
    readonly applyMove: (input: {
        readonly bookmark: BookmarkItem;
        readonly collectionId: string | null;
    }) => void;
    /** Applies a saved note to the in-memory bookmark. */
    readonly applyNote: (input: { readonly id: string; readonly description: string }) => void;
}

/**
 * State and actions of the uncollected favorites region.
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @returns See {@link UseFavoritesListResult}.
 */
export function useFavoritesList({ base }: { readonly base: string }): UseFavoritesListResult {
    const [tab, setTab] = useState<FavoritesTabKey>('ALL');
    const [page, setPage] = useState(1);
    const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
    const [counts, setCounts] = useState<Partial<Record<FavoritesTabKey, number>>>({});
    const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
    const [attempt, setAttempt] = useState(0);
    const [knownTotal, setKnownTotal] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    // True once a card left the page locally since the last read.
    const removedRef = useRef(false);

    // One page read per (tab, page, attempt). A newer read aborts the older one.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger
    useEffect(() => {
        const ctrl = new AbortController();
        abortRef.current?.abort();
        abortRef.current = ctrl;
        setPageState({ status: 'loading' });
        const run = async () => {
            try {
                const data = await fetchUncollectedPage({ base, tab, page, signal: ctrl.signal });
                if (!ctrl.signal.aborted) {
                    removedRef.current = false;
                    setPageState({ status: 'ready', data });
                }
            } catch {
                if (!ctrl.signal.aborted) setPageState({ status: 'error' });
            }
        };
        void run();
        return () => ctrl.abort();
    }, [base, tab, page, attempt]);

    // Tab counts: every bookmark of the type, collected or not (HOS-2420: the
    // uncollected total above is smaller, so it never feeds the badge).
    useEffect(() => {
        const ctrl = new AbortController();
        const run = async (key: FavoritesTabKey) => {
            try {
                const total = await fetchTabCount({ base, tab: key, signal: ctrl.signal });
                if (!ctrl.signal.aborted) setCounts((prev) => ({ ...prev, [key]: total }));
            } catch {
                // An unknown count stays absent: never shown as 0.
            }
        };
        for (const key of FAVORITES_TABS) void run(key);
        return () => ctrl.abort();
    }, [base]);

    // Last known total, so the paginator does not vanish while a page loads.
    const total = pageState.status === 'ready' ? pageState.data.total : knownTotal;
    const pageCount = Math.max(1, Math.ceil(total / FAVORITES_PAGE_SIZE));

    useEffect(() => {
        if (pageState.status === 'ready') setKnownTotal(pageState.data.total);
    }, [pageState]);

    // When the total shrinks below the current page (removals, moves, another
    // device), that page no longer exists: go back to the last one (HOS-2420).
    // A page emptied by local removals while the server still holds favorites
    // past it re-reads once, so the next ones slide in instead of an empty
    // state. Only after a removal: an inconsistent server answer never loops.
    useEffect(() => {
        if (pageState.status !== 'ready') return;
        if (page > pageCount) {
            setPage(pageCount);
            return;
        }
        if (
            removedRef.current &&
            pageState.data.bookmarks.length === 0 &&
            pageState.data.total > 0
        ) {
            removedRef.current = false;
            setAttempt((n) => n + 1);
        }
    }, [pageState, page, pageCount]);

    const selectTab = useCallback(
        (next: FavoritesTabKey) => {
            if (next === tab) return;
            setTab(next);
            setPage(1);
            setKnownTotal(0);
        },
        [tab]
    );

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // A bookmark leaving for good lowers its own tab and «Todos» by one. A
    // count that could not be read stays absent. Moving into a collection does
    // not call this: the counts include collected bookmarks.
    const shiftCounts = useCallback(({ entityType, by }: { entityType: string; by: 1 | -1 }) => {
        setCounts((prev) => {
            const next = { ...prev };
            for (const key of ['ALL', entityType] as const) {
                const current = next[key as FavoritesTabKey];
                if (current !== undefined) {
                    next[key as FavoritesTabKey] = Math.max(0, current + by);
                }
            }
            return next;
        });
    }, []);

    const remove = useCallback(
        async (bookmark: BookmarkItem) => {
            let originalIndex = -1;
            shiftCounts({ entityType: bookmark.entityType, by: -1 });
            removedRef.current = true;
            setPageState((prev) => {
                if (prev.status !== 'ready') return prev;
                originalIndex = prev.data.bookmarks.findIndex((b) => b.id === bookmark.id);
                return {
                    status: 'ready',
                    data: {
                        bookmarks: prev.data.bookmarks.filter((b) => b.id !== bookmark.id),
                        total: Math.max(0, prev.data.total - 1)
                    }
                };
            });
            setRemovingIds((prev) => new Set([...prev, bookmark.id]));
            try {
                await deleteBookmark({ base, id: bookmark.id });
            } catch (err) {
                // Put back ONLY this bookmark at its old place: restoring a whole
                // snapshot would resurrect bookmarks a concurrent removal deleted.
                setPageState((prev) => {
                    if (prev.status !== 'ready') return prev;
                    if (prev.data.bookmarks.some((b) => b.id === bookmark.id)) return prev;
                    const next = [...prev.data.bookmarks];
                    const at =
                        originalIndex < 0 ? next.length : Math.min(originalIndex, next.length);
                    next.splice(at, 0, bookmark);
                    return {
                        status: 'ready',
                        data: { bookmarks: next, total: prev.data.total + 1 }
                    };
                });
                shiftCounts({ entityType: bookmark.entityType, by: 1 });
                throw err;
            } finally {
                setRemovingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(bookmark.id);
                    return next;
                });
            }
        },
        [base, shiftCounts]
    );

    const applyMove = useCallback(
        ({
            bookmark,
            collectionId
        }: {
            readonly bookmark: BookmarkItem;
            readonly collectionId: string | null;
        }) => {
            // The list is server-filtered to uncollected bookmarks: one that just
            // joined a collection leaves the list and its total.
            if (collectionId === null || bookmark.collectionId) return;
            removedRef.current = true;
            setPageState((prev) =>
                prev.status === 'ready'
                    ? {
                          status: 'ready',
                          data: {
                              bookmarks: prev.data.bookmarks.filter((b) => b.id !== bookmark.id),
                              total: Math.max(0, prev.data.total - 1)
                          }
                      }
                    : prev
            );
        },
        []
    );

    const applyNote = useCallback(
        ({ id, description }: { readonly id: string; readonly description: string }) => {
            setPageState((prev) =>
                prev.status === 'ready'
                    ? {
                          status: 'ready',
                          data: {
                              ...prev.data,
                              bookmarks: prev.data.bookmarks.map((b) =>
                                  b.id === id ? { ...b, description } : b
                              )
                          }
                      }
                    : prev
            );
        },
        []
    );

    const state: AsyncResult<BookmarksPage> =
        pageState.status === 'loading'
            ? { status: 'loading' }
            : pageState.status === 'error'
              ? { status: 'error', retry }
              : pageState.data.bookmarks.length === 0
                ? { status: 'empty' }
                : { status: 'ready', data: pageState.data };

    return {
        tab,
        selectTab,
        page,
        pageCount,
        setPage,
        state,
        counts,
        removingIds,
        remove,
        applyMove,
        applyNote
    };
}
