/**
 * @file favorites-store.ts
 * @description Shared client-side favorite-status store for every
 * `FavoriteButton` island on a page (HOS-369 WB0-2).
 *
 * **Why this exists.** Favorite status is per-user, so it cannot be baked into
 * an edge-cacheable HTML document. Once the SSR bulk check is removed from the
 * listing pages (WB0-5), each heart would resolve its own status with one
 * `GET /user-bookmarks/check` call — 24 cards on a listing means 24 requests.
 * This store collapses them: islands *register* the entity they display, the
 * store batches the registrations that arrive within
 * {@link BATCH_WINDOW_MS}, and issues **one** `POST /user-bookmarks/check-bulk`
 * per entity type.
 *
 * **Session resolution lives here.** The store resolves the visitor's session
 * once (cache-first, via `@/lib/auth-cache`) and only issues a bulk check when
 * there is one. A guest never triggers a favorites request at all: every
 * registered entity resolves to "not favorited" locally. Consumers therefore
 * do not carry — and cannot forget — an auth gate of their own.
 *
 * **Consumers also share writes.** The same entity can appear several times on
 * one page (a listing card and its map popup, for instance). `setFavoriteStatus`
 * publishes a toggle to every island showing that entity, so they never drift.
 *
 * State model:
 * - Entries are keyed by `` `${entityType}:${entityId}` `` and are immutable —
 *   a change replaces the entry object, so `useSyncExternalStore` can compare by
 *   reference.
 * - Listeners are registered **per key**, so resolving 24 entities notifies each
 *   island once about its own entity instead of re-rendering all of them 24 times.
 * - Nothing is persisted. Favorite status is server state; it is re-resolved on
 *   the next page load.
 *
 * @example
 * ```tsx
 * // In a React island:
 * import { useFavoriteStatus, setFavoriteStatus } from '@/store/favorites-store';
 *
 * function Heart({ id }: { id: string }) {
 *   const { isFavorited, isResolving } = useFavoriteStatus({
 *       entityType: 'ACCOMMODATION',
 *       entityId: id
 *   });
 *   return <button disabled={isResolving} aria-pressed={isFavorited}>♥</button>;
 * }
 * ```
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import { fetchAuthMe, readCachedAuthMe, writeCachedAuthMe } from '@/lib/auth-cache';

/**
 * Polymorphic entity types that can be favorited. Mirrors `FavoriteEntityType`
 * in `FavoriteButton.client.tsx` and the bookmark entity type accepted by
 * `userBookmarksApi`.
 */
export type FavoriteEntityType =
    | 'ACCOMMODATION'
    | 'ATTRACTION'
    | 'DESTINATION'
    | 'EVENT'
    | 'EXPERIENCE'
    | 'GASTRONOMY'
    | 'POST';

/** Identifies one favoritable entity. */
export interface FavoriteEntityRef {
    readonly entityType: FavoriteEntityType;
    readonly entityId: string;
}

/** Resolved (or in-flight) favorite status for a single entity. */
export interface FavoriteStatus {
    /** Whether the current visitor has this entity bookmarked. */
    readonly isFavorited: boolean;
    /** Bookmark id when favorited, `null` otherwise. */
    readonly bookmarkId: string | null;
    /**
     * Whether the status is still being resolved. `false` for guests (resolved
     * locally, no request) and after the bulk check settles — including when it
     * fails, in which case the status degrades to "not favorited" rather than
     * staying busy forever.
     */
    readonly isResolving: boolean;
}

/**
 * How long registrations are collected before a bulk check is issued.
 *
 * Islands hydrated with `client:visible` do not mount in the same tick — a grid
 * of cards entering the viewport hydrates across a few frames. A window this
 * size groups one scroll burst into a single request while staying far below
 * the threshold where a user would perceive the heart as slow to settle.
 */
const BATCH_WINDOW_MS = 50;

/**
 * Status served during SSR and to entities nobody has registered yet: the
 * anonymous variant, not busy. Astro renders islands on the server where there
 * is no session and no `window`; rendering the un-favorited heart there is both
 * the correct crawler-visible output and the safe fallback if JS never runs
 * (HOS-369 D-11).
 */
const UNRESOLVED_STATUS: FavoriteStatus = {
    isFavorited: false,
    bookmarkId: null,
    isResolving: false
};

/** Status of an entity that has been registered but not yet resolved. */
const RESOLVING_STATUS: FavoriteStatus = {
    isFavorited: false,
    bookmarkId: null,
    isResolving: true
};

/** Current status per entity key. Entries are replaced, never mutated. */
let statusByKey = new Map<string, FavoriteStatus>();

/** Per-key listener sets, so a change only re-renders the islands that show it. */
const listenersByKey = new Map<string, Set<() => void>>();

/** Entities registered but not yet included in a bulk request, grouped by type. */
let pendingByType = new Map<FavoriteEntityType, Set<string>>();

/** Entity keys currently covered by an in-flight bulk request. */
let inFlightKeys = new Set<string>();

/** Handle of the scheduled batch flush, or `null` when none is pending. */
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Build the map key for an entity. Entity ids are UUIDs and entity types are a
 * closed set, so a `:` join cannot collide.
 */
function buildKey({ entityType, entityId }: FavoriteEntityRef): string {
    return `${entityType}:${entityId}`;
}

/** Notify every listener registered for one entity key. */
function emitChange(key: string): void {
    const listeners = listenersByKey.get(key);
    if (!listeners) return;
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Write a status for one entity and notify its listeners. Skips both when the
 * value is unchanged, so a redundant write never schedules a re-render.
 */
function writeStatus(key: string, next: FavoriteStatus): void {
    const current = statusByKey.get(key);
    if (
        current &&
        current.isFavorited === next.isFavorited &&
        current.bookmarkId === next.bookmarkId &&
        current.isResolving === next.isResolving
    ) {
        return;
    }
    statusByKey.set(key, next);
    emitChange(key);
}

/**
 * Resolve whether the visitor has a session, cache-first.
 *
 * Reads the shared `/auth/me` snapshot from `sessionStorage` when it is fresh;
 * otherwise fetches it (concurrent callers across all islands share a single
 * in-flight request inside `fetchAuthMe`) and writes it back so the next batch —
 * and every other island — reads the cache instead.
 */
async function resolveIsAuthenticated(): Promise<boolean> {
    const cached = readCachedAuthMe();
    if (cached) return cached.isAuthenticated;

    const snapshot = await fetchAuthMe();
    writeCachedAuthMe(snapshot);
    return snapshot.isAuthenticated;
}

/**
 * Issue one bulk check for a group of same-type entities and apply the result.
 *
 * A failed or partial response resolves the affected entities to "not
 * favorited" rather than leaving them busy: the heart stays clickable and the
 * toggle itself is the authoritative operation.
 */
async function resolveGroup(entityType: FavoriteEntityType, entityIds: string[]): Promise<void> {
    try {
        const result = await userBookmarksApi.checkBulk({ entityType, entityIds });
        if (!result.ok) {
            settleGroupAsNotFavorited(entityType, entityIds);
            return;
        }
        for (const entityId of entityIds) {
            const check = result.data.checks[entityId];
            writeStatus(buildKey({ entityType, entityId }), {
                isFavorited: check?.isBookmarked ?? false,
                bookmarkId: check?.bookmarkId ?? null,
                isResolving: false
            });
        }
    } catch {
        // Network failure — degrade to "not favorited" (see the JSDoc above).
        settleGroupAsNotFavorited(entityType, entityIds);
    }
}

/** Resolve a whole group to the un-favorited, settled status. */
function settleGroupAsNotFavorited(entityType: FavoriteEntityType, entityIds: string[]): void {
    for (const entityId of entityIds) {
        writeStatus(buildKey({ entityType, entityId }), UNRESOLVED_STATUS);
    }
}

/**
 * Drain the pending registrations: resolve the session once, then issue one
 * bulk check per entity type. Guests settle locally without any request.
 */
async function flushPending(): Promise<void> {
    flushTimer = null;
    const batch = pendingByType;
    pendingByType = new Map();
    if (batch.size === 0) return;

    const batchKeys: string[] = [];
    for (const [entityType, entityIds] of batch) {
        for (const entityId of entityIds) {
            batchKeys.push(buildKey({ entityType, entityId }));
        }
    }
    for (const key of batchKeys) {
        inFlightKeys.add(key);
    }

    try {
        const isAuthenticated = await resolveIsAuthenticated();
        if (!isAuthenticated) {
            for (const [entityType, entityIds] of batch) {
                settleGroupAsNotFavorited(entityType, [...entityIds]);
            }
            return;
        }
        await Promise.all(
            [...batch].map(([entityType, entityIds]) => resolveGroup(entityType, [...entityIds]))
        );
    } catch {
        // `resolveIsAuthenticated` degrades to a guest snapshot internally, so
        // reaching here means an unexpected throw. Settle rather than hang.
        for (const [entityType, entityIds] of batch) {
            settleGroupAsNotFavorited(entityType, [...entityIds]);
        }
    } finally {
        for (const key of batchKeys) {
            inFlightKeys.delete(key);
        }
    }
}

/** Schedule a batch flush if one is not already pending. */
function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
        void flushPending();
    }, BATCH_WINDOW_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register an entity whose favorite status should be resolved.
 *
 * Idempotent and cheap to call from every island: an entity that is already
 * resolved, already queued, or already covered by an in-flight request is
 * ignored. No-ops during SSR, where there is no session to resolve.
 *
 * @param ref - `{ entityType, entityId }` (RO-RO).
 */
export function requestFavoriteStatus(ref: FavoriteEntityRef): void {
    if (typeof window === 'undefined') return;

    const key = buildKey(ref);
    if (statusByKey.has(key) || inFlightKeys.has(key)) return;

    const queued = pendingByType.get(ref.entityType);
    if (queued) {
        if (queued.has(ref.entityId)) return;
        queued.add(ref.entityId);
    } else {
        pendingByType.set(ref.entityType, new Set([ref.entityId]));
    }

    writeStatus(key, RESOLVING_STATUS);
    scheduleFlush();
}

/**
 * Publish a known favorite status for an entity, notifying every island that
 * displays it.
 *
 * Used for optimistic toggles and for the confirmed server response afterwards,
 * so a heart in a listing card and the same heart in a map popup never disagree.
 * The status is marked settled — a caller that knows the value has, by
 * definition, no resolution pending.
 *
 * @param params - The entity plus its new `isFavorited` / `bookmarkId`.
 */
export function setFavoriteStatus({
    entityType,
    entityId,
    isFavorited,
    bookmarkId
}: FavoriteEntityRef & {
    readonly isFavorited: boolean;
    readonly bookmarkId: string | null;
}): void {
    writeStatus(buildKey({ entityType, entityId }), {
        isFavorited,
        bookmarkId,
        isResolving: false
    });
}

/**
 * Subscribe to changes for one entity.
 *
 * Signature is compatible with `useSyncExternalStore`'s first argument.
 *
 * @param key - Entity key, as built by `buildKey`.
 * @param listener - Invoked whenever this entity's status changes.
 * @returns Unsubscribe function.
 */
function subscribeToKey(key: string, listener: () => void): () => void {
    const existing = listenersByKey.get(key);
    if (existing) {
        existing.add(listener);
    } else {
        listenersByKey.set(key, new Set([listener]));
    }
    return () => {
        const listeners = listenersByKey.get(key);
        if (!listeners) return;
        listeners.delete(listener);
        if (listeners.size === 0) listenersByKey.delete(key);
    };
}

/**
 * Read the current status of one entity.
 *
 * Returns the **same object reference** while the status is unchanged, so
 * `useSyncExternalStore` does not schedule unnecessary re-renders.
 *
 * @param ref - `{ entityType, entityId }` (RO-RO).
 * @returns The entity's {@link FavoriteStatus}; the unresolved status when the
 *   entity is unknown to the store.
 */
export function getFavoriteStatus(ref: FavoriteEntityRef): FavoriteStatus {
    return statusByKey.get(buildKey(ref)) ?? UNRESOLVED_STATUS;
}

/**
 * Status used during Astro SSR and hydration: always the anonymous, settled
 * variant. The server has no session-specific state to render (HOS-369 D-11).
 */
export function getServerFavoriteStatus(): FavoriteStatus {
    return UNRESOLVED_STATUS;
}

/**
 * React hook returning one entity's favorite status, registering it for
 * resolution on mount.
 *
 * Every island calling this for the same page load shares a single bulk
 * request; every island calling it for the *same entity* shares one status, so
 * a toggle in one place is reflected in all of them.
 *
 * @param ref - `{ entityType, entityId }` (RO-RO).
 * @returns The current {@link FavoriteStatus}, updated on every change.
 */
export function useFavoriteStatus(ref: FavoriteEntityRef): FavoriteStatus {
    const { entityType, entityId } = ref;
    const key = buildKey({ entityType, entityId });

    // Both callbacks are memoized on the entity key: `useSyncExternalStore`
    // re-subscribes whenever `subscribe`'s identity changes, so an inline arrow
    // would tear down and re-register the listener on every single render.
    const subscribe = useCallback((listener: () => void) => subscribeToKey(key, listener), [key]);
    const readStatus = useCallback(
        () => getFavoriteStatus({ entityType, entityId }),
        [entityType, entityId]
    );

    const status = useSyncExternalStore(subscribe, readStatus, getServerFavoriteStatus);

    useEffect(() => {
        requestFavoriteStatus({ entityType, entityId });
    }, [entityType, entityId]);

    return status;
}

/**
 * TEST-ONLY: drop every cached status, listener, pending registration, and
 * scheduled flush.
 *
 * Vitest reuses the module across tests in a file, so without this a status
 * resolved in one test would silently satisfy the next one's registration and
 * the expected request would never be issued.
 */
export function resetFavoritesStore(): void {
    if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    statusByKey = new Map();
    listenersByKey.clear();
    pendingByType = new Map();
    inFlightKeys = new Set();
}
