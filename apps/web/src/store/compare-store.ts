/**
 * @file compare-store.ts
 * @description Global accommodation comparison store for web.
 *
 * Pub/sub store for managing the set of accommodation IDs the user has
 * selected for side-by-side comparison. Module-level singleton with a
 * subscriber pattern compatible with React's `useSyncExternalStore`.
 *
 * Features:
 * - Insertion-order-preserving, deduplicated ID set.
 * - localStorage persistence so the selection survives page navigation.
 * - SSR-safe: {@link getServerSnapshot} returns a stable empty state for
 *   Astro island rendering, preventing hydration mismatches.
 * - React hook {@link useCompareStore} for island components.
 *
 * @example
 * ```tsx
 * // In a React island:
 * import { useCompareStore, toggleCompare } from '@/store/compare-store';
 *
 * function CompareToggle({ id }: { id: string }) {
 *   const { ids } = useCompareStore();
 *   return (
 *     <button onClick={() => toggleCompare(id)}>
 *       {ids.includes(id) ? 'Remove from compare' : 'Add to compare'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useSyncExternalStore } from 'react';

/**
 * Snapshot shape returned by {@link getSnapshot} and {@link useCompareStore}.
 * Always immutable — mutators replace the reference instead of mutating.
 */
export interface CompareState {
    readonly ids: readonly string[];
}

/** localStorage key for comparison state (namespaced and versioned). */
const STORAGE_KEY = 'hospeda:compare:v1' as const;

/** Canonical empty state. Used as the initial snapshot and the server snapshot. */
const EMPTY_STATE: CompareState = { ids: [] };

/** Current module-level snapshot. Replaced (never mutated) on every change. */
let snapshot: CompareState = EMPTY_STATE;

/** Registered change listeners. */
const listeners = new Set<() => void>();

/** Notify all registered listeners that the store state has changed. */
function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Write the current ID list to localStorage. Safe in all environments —
 * silently no-ops during SSR (no `window`) or when localStorage throws
 * (private-browsing quota exhaustion).
 */
function persist(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.ids));
    } catch {
        // localStorage throws in private mode or when the quota is exceeded.
    }
}

/**
 * Replace the in-memory snapshot, persist to localStorage, and notify all
 * subscribers.
 *
 * @param ids - New ordered, deduplicated list of accommodation IDs.
 */
function setState(ids: readonly string[]): void {
    snapshot = { ids: [...ids] };
    persist();
    emitChange();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read persisted comparison IDs from localStorage and update the in-memory
 * snapshot. Called once automatically at module load time and exported so
 * tests can simulate a fresh page load after pre-populating localStorage.
 *
 * Gracefully handles: missing key, malformed JSON, a non-array value, and
 * non-string array entries (those are filtered out rather than throwing).
 */
export function loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return;
    }
    if (raw === null) {
        snapshot = EMPTY_STATE;
        return;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            snapshot = EMPTY_STATE;
            return;
        }
        const ids = parsed.filter((item): item is string => typeof item === 'string');
        snapshot = { ids };
    } catch {
        snapshot = EMPTY_STATE;
    }
}

// Initialise from localStorage once, immediately at module load.
loadFromStorage();

/**
 * Subscribe to compare store state changes.
 *
 * Signature is compatible with `useSyncExternalStore`'s first argument so
 * island components can re-render whenever the comparison list changes.
 *
 * @param listener - Invoked whenever the store state changes.
 * @returns Unsubscribe function.
 */
export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Return the current compare state snapshot.
 *
 * Returns the **same object reference** when nothing has changed, so
 * `useSyncExternalStore` does not schedule unnecessary re-renders.
 *
 * @returns Current {@link CompareState}.
 */
export function getSnapshot(): CompareState {
    return snapshot;
}

/**
 * Return a stable empty snapshot for Astro SSR and hydration.
 *
 * Astro renders islands on the server where localStorage is unavailable.
 * Providing this third argument to `useSyncExternalStore` prevents the
 * runtime from reading client state on the server, avoiding hydration
 * mismatches.
 *
 * @returns Canonical empty {@link CompareState}.
 */
export function getServerSnapshot(): CompareState {
    return EMPTY_STATE;
}

/**
 * Add an accommodation ID to the comparison list. A duplicate ID is silently
 * ignored; insertion order is preserved for all other entries.
 *
 * @param id - Accommodation ID to add.
 */
export function addToCompare(id: string): void {
    if (snapshot.ids.includes(id)) return;
    setState([...snapshot.ids, id]);
}

/**
 * Remove an accommodation ID from the comparison list. No-op when the ID is
 * not present.
 *
 * @param id - Accommodation ID to remove.
 */
export function removeFromCompare(id: string): void {
    const filtered = snapshot.ids.filter((existing) => existing !== id);
    if (filtered.length === snapshot.ids.length) return;
    setState(filtered);
}

/**
 * Toggle an accommodation ID in the comparison list: add if absent, remove
 * if present.
 *
 * @param id - Accommodation ID to toggle.
 */
export function toggleCompare(id: string): void {
    if (isInCompare(id)) {
        removeFromCompare(id);
    } else {
        addToCompare(id);
    }
}

/**
 * Remove all IDs from the comparison list and persist the empty state.
 * No-op when the list is already empty (no listeners notified, no I/O).
 */
export function clearCompare(): void {
    if (snapshot.ids.length === 0) return;
    snapshot = EMPTY_STATE;
    persist();
    emitChange();
}

/**
 * Check whether an accommodation ID is currently in the comparison list.
 *
 * @param id - Accommodation ID to check.
 * @returns `true` if the ID is present in the current list.
 */
export function isInCompare(id: string): boolean {
    return snapshot.ids.includes(id);
}

/**
 * React hook for subscribing to the compare store in island components.
 *
 * Uses `useSyncExternalStore` for concurrent-mode–safe subscriptions and
 * supplies {@link getServerSnapshot} so Astro island rendering never attempts
 * to read localStorage on the server.
 *
 * @example
 * ```tsx
 * function CompareToggle({ id }: { id: string }) {
 *   const { ids } = useCompareStore();
 *   return (
 *     <button onClick={() => toggleCompare(id)}>
 *       {ids.includes(id) ? 'Remove from compare' : 'Add to compare'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @returns Current {@link CompareState} snapshot, updated on every change.
 */
export function useCompareStore(): CompareState {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
