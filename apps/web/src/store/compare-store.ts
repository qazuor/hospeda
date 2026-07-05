/**
 * @file compare-store.ts
 * @description Global accommodation comparison store for web.
 *
 * Pub/sub store for managing the set of accommodations the user has selected
 * for side-by-side comparison. Module-level singleton with a subscriber
 * pattern compatible with React's `useSyncExternalStore`.
 *
 * State model (SPEC-288):
 * - `ids` — the canonical, insertion-order-preserving, deduplicated ID list.
 *   This is what the entitlement guard and the protected compare endpoint
 *   consume. Persisted under {@link STORAGE_KEY} as a plain `string[]`.
 * - `items` — the same selection enriched with display metadata
 *   (`name`, `thumbnailUrl`) so the floating compare bar can render thumbnails
 *   and labels without a network round-trip. Metadata is supplied opportunistically
 *   by the selecting UI ({@link addToCompare}'s optional `meta` argument) and
 *   persisted separately under {@link META_STORAGE_KEY}; `items` is always derived
 *   from `ids` (the source of truth for ordering) joined with that metadata.
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
 *
 * Compare MODE (HOS-85):
 * A second, independent sibling store tracks whether "compare mode" (the
 * selecting UI shown on the accommodation listing) is currently active. It is
 * kept separate from the selection state above — the two change for different
 * reasons and at different rates, and consumers that only care about the
 * selection (e.g. the floating compare bar) should not re-render every time
 * mode toggles, and vice versa.
 *
 * Because `apps/web` is an Astro MPA (every navigation is a full page reload),
 * compare mode is persisted to localStorage under {@link MODE_STORAGE_KEY} so
 * it survives reloads while browsing the accommodation section. It must NOT
 * leak into unrelated sections of the site, so {@link clearCompareModeIfOutsideSection}
 * is provided for the listing/layout code to call on bootstrap: it turns mode
 * OFF whenever the current path is not under `/{locale}/alojamientos/...`
 * (for any supported locale), and leaves it untouched otherwise.
 */

import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { useSyncExternalStore } from 'react';

/**
 * Display metadata for a selected accommodation. Supplied by the selecting UI
 * so the compare bar can render a thumbnail + label without re-fetching.
 */
export interface CompareItemMeta {
    /** Human-readable accommodation name (used for label + alt text). */
    readonly name: string;
    /** Thumbnail image URL. Optional — the bar falls back to a placeholder. */
    readonly thumbnailUrl?: string;
}

/**
 * A selected accommodation: its ID plus any known display metadata. `name` /
 * `thumbnailUrl` are optional because an ID can be restored from storage or
 * added without metadata; the UI degrades gracefully when they are missing.
 */
export interface CompareItem {
    readonly id: string;
    readonly name?: string;
    readonly thumbnailUrl?: string;
}

/**
 * Snapshot shape returned by {@link getSnapshot} and {@link useCompareStore}.
 * Always immutable — mutators replace the reference instead of mutating.
 */
export interface CompareState {
    /** Canonical ordered, deduplicated list of accommodation IDs. */
    readonly ids: readonly string[];
    /** The same selection enriched with display metadata, in `ids` order. */
    readonly items: readonly CompareItem[];
}

/** localStorage key for the canonical ID list (namespaced and versioned). */
const STORAGE_KEY = 'hospeda:compare:v1' as const;
/** localStorage key for the per-ID display metadata map. */
const META_STORAGE_KEY = 'hospeda:compare:meta:v1' as const;
/** localStorage key for the compare-mode flag (namespaced and versioned). */
const MODE_STORAGE_KEY = 'hospeda:compare:mode:v1' as const;
/**
 * The `/{locale}/{segment}/...` path segment that compare mode is scoped to.
 * Mode stays on while browsing under this segment and turns off elsewhere.
 */
const COMPARE_MODE_SECTION_SEGMENT = 'alojamientos' as const;

/** Canonical empty state. Used as the initial snapshot and the server snapshot. */
const EMPTY_STATE: CompareState = { ids: [], items: [] };

/** Current module-level snapshot. Replaced (never mutated) on every change. */
let snapshot: CompareState = EMPTY_STATE;

/** Per-ID display metadata. Not ordered — ordering always comes from `ids`. */
let metaById = new Map<string, CompareItemMeta>();

/** Registered change listeners. */
const listeners = new Set<() => void>();

/** Notify all registered listeners that the store state has changed. */
function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Current compare-mode flag. Kept as a plain module-level boolean (not part of
 * {@link CompareState}) since it changes independently of the selection and
 * has its own listener set — see the "Compare MODE" note in the file header.
 */
let compareModeEnabled = false;

/** Registered compare-mode change listeners (separate from {@link listeners}). */
const modeListeners = new Set<() => void>();

/** Notify all registered compare-mode listeners that the flag has changed. */
function emitModeChange(): void {
    for (const listener of modeListeners) {
        listener();
    }
}

/**
 * Build an immutable {@link CompareState} from an ordered ID list, joining each
 * ID with its known metadata (if any) to produce the derived `items` array.
 *
 * @param ids - Ordered, deduplicated list of accommodation IDs.
 * @returns A fresh immutable snapshot.
 */
function buildState(ids: readonly string[]): CompareState {
    const frozenIds = [...ids];
    const items = frozenIds.map((id): CompareItem => {
        const meta = metaById.get(id);
        return meta ? { id, name: meta.name, thumbnailUrl: meta.thumbnailUrl } : { id };
    });
    return { ids: frozenIds, items };
}

/**
 * Write the current ID list + metadata map to localStorage. Safe in all
 * environments — silently no-ops during SSR (no `window`) or when localStorage
 * throws (private-browsing quota exhaustion).
 */
function persist(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.ids));
        window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(Object.fromEntries(metaById)));
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
    snapshot = buildState(ids);
    persist();
    emitChange();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read persisted comparison IDs + metadata from localStorage and update the
 * in-memory snapshot. Called once automatically at module load time and
 * exported so tests can simulate a fresh page load after pre-populating
 * localStorage.
 *
 * Gracefully handles: missing key, malformed JSON, a non-array value, and
 * non-string array entries (those are filtered out rather than throwing).
 * Metadata is best-effort: a malformed metadata blob is ignored and the
 * selection still restores from `ids` alone.
 */
export function loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    metaById = loadMetaFromStorage();
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
        snapshot = buildState(ids);
    } catch {
        snapshot = EMPTY_STATE;
    }
}

/**
 * Read and validate the persisted metadata map. Returns an empty map on any
 * problem (missing key, malformed JSON, non-object value, invalid entries).
 */
function loadMetaFromStorage(): Map<string, CompareItemMeta> {
    const result = new Map<string, CompareItemMeta>();
    if (typeof window === 'undefined') return result;
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(META_STORAGE_KEY);
    } catch {
        return result;
    }
    if (raw === null) return result;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return result;
        }
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (value !== null && typeof value === 'object' && 'name' in value) {
                const name = (value as { name: unknown }).name;
                const thumbnailUrl = (value as { thumbnailUrl?: unknown }).thumbnailUrl;
                if (typeof name === 'string') {
                    result.set(id, {
                        name,
                        thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : undefined
                    });
                }
            }
        }
    } catch {
        // Malformed metadata — ignore; selection still restores from ids.
    }
    return result;
}

/**
 * Read the persisted compare-mode flag from localStorage and update the
 * in-memory value. Called once automatically at module load time and
 * exported so tests can simulate a fresh page load after pre-populating
 * localStorage.
 *
 * Gracefully handles: missing key, malformed JSON, and any non-boolean value
 * (treated as `false`, matching the SSR default).
 */
export function loadCompareModeFromStorage(): void {
    if (typeof window === 'undefined') return;
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    } catch {
        compareModeEnabled = false;
        return;
    }
    if (raw === null) {
        compareModeEnabled = false;
        return;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        compareModeEnabled = parsed === true;
    } catch {
        compareModeEnabled = false;
    }
}

// Initialise from localStorage once, immediately at module load.
loadFromStorage();
loadCompareModeFromStorage();

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
 * ignored for ordering, but its display metadata is refreshed when provided.
 * Insertion order is preserved for all other entries.
 *
 * @param id - Accommodation ID to add.
 * @param meta - Optional display metadata (name + thumbnail) for the compare bar.
 */
export function addToCompare(id: string, meta?: CompareItemMeta): void {
    if (snapshot.ids.includes(id)) {
        // Already present: refresh metadata if newly supplied, otherwise no-op
        // (preserving the "no emit on duplicate" contract when nothing changes).
        if (meta) {
            metaById.set(id, meta);
            setState(snapshot.ids);
        }
        return;
    }
    if (meta) {
        metaById.set(id, meta);
    }
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
    metaById.delete(id);
    setState(filtered);
}

/**
 * Toggle an accommodation ID in the comparison list: add if absent, remove
 * if present.
 *
 * @param id - Accommodation ID to toggle.
 * @param meta - Optional display metadata applied when the toggle adds the ID.
 */
export function toggleCompare(id: string, meta?: CompareItemMeta): void {
    if (isInCompare(id)) {
        removeFromCompare(id);
    } else {
        addToCompare(id, meta);
    }
}

/**
 * Remove all IDs (and their metadata) from the comparison list and persist the
 * empty state. No-op when the list is already empty (no listeners notified, no I/O).
 */
export function clearCompare(): void {
    if (snapshot.ids.length === 0) return;
    metaById.clear();
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

// ---------------------------------------------------------------------------
// Compare mode (HOS-85) — sibling store, see the file header note.
// ---------------------------------------------------------------------------

/**
 * Persist the current compare-mode flag to localStorage. Safe in all
 * environments — silently no-ops during SSR (no `window`) or when
 * localStorage throws (private-browsing quota exhaustion).
 */
function persistCompareMode(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify(compareModeEnabled));
    } catch {
        // localStorage throws in private mode or when the quota is exceeded.
    }
}

/**
 * Set the compare-mode flag, persist it, and notify compare-mode subscribers.
 * No-op (no persistence, no notification) when the value is unchanged, matching
 * the "no emit on no-op" contract of the selection mutators above.
 *
 * @param enabled - Whether compare mode should be active.
 */
export function setCompareMode(enabled: boolean): void {
    if (compareModeEnabled === enabled) return;
    compareModeEnabled = enabled;
    persistCompareMode();
    emitModeChange();
}

/**
 * Toggle the compare-mode flag: on if currently off, off if currently on.
 */
export function toggleCompareMode(): void {
    setCompareMode(!compareModeEnabled);
}

/**
 * Determine whether a pathname falls under the accommodation listing section
 * (`/{locale}/alojamientos/...`) for any supported locale.
 *
 * @param pathname - A URL pathname, e.g. `location.pathname` or `Astro.url.pathname`.
 * @returns `true` when the first two non-empty path segments are a supported
 *   locale followed by {@link COMPARE_MODE_SECTION_SEGMENT}.
 */
function isAccommodationSectionPath(pathname: string): boolean {
    const [locale, section] = pathname.split('/').filter((segment) => segment.length > 0);
    return (
        (SUPPORTED_LOCALES as readonly string[]).includes(locale ?? '') &&
        section === COMPARE_MODE_SECTION_SEGMENT
    );
}

/**
 * Reset the compare experience (mode flag AND the selected accommodations) when
 * `pathname` is outside the accommodation listing section, leaving both
 * untouched when inside it.
 *
 * The compare feature is deliberately scoped to `/{locale}/alojamientos/...`:
 * since `apps/web` is an Astro MPA/ClientRouter app, both the mode flag and the
 * selection persist in localStorage across navigations. Without this call they
 * would leak into unrelated sections, so a user leaving the accommodation
 * section and coming back would see a stale, previously-built selection reappear
 * (confusing: "I just started comparing and it already shows 2"). Clearing the
 * selection here — not just the mode — makes "start comparing" always begin from
 * an empty state, while navigating between the listing and an accommodation
 * detail page (both under `/alojamientos/`) preserves the in-progress selection.
 *
 * Intended to be called once on every page load by the base layout, passing the
 * current pathname.
 *
 * @param pathname - The current pathname to check, e.g. `Astro.url.pathname`.
 *
 * @example
 * ```ts
 * clearCompareModeIfOutsideSection('/es/mi-cuenta/'); // clears mode + selection
 * clearCompareModeIfOutsideSection('/es/alojamientos/'); // leaves both as-is
 * clearCompareModeIfOutsideSection('/es/alojamientos/some-hotel/'); // leaves both as-is (detail is in-section)
 * ```
 */
export function clearCompareModeIfOutsideSection(pathname: string): void {
    if (isAccommodationSectionPath(pathname)) return;
    setCompareMode(false);
    clearCompare();
}

/**
 * Subscribe to compare-mode changes.
 *
 * Signature is compatible with `useSyncExternalStore`'s first argument so
 * island components can re-render whenever compare mode toggles. Kept
 * separate from {@link subscribe} (selection changes) so consumers only
 * re-render for the state they actually care about.
 *
 * @param listener - Invoked whenever the compare-mode flag changes.
 * @returns Unsubscribe function.
 */
export function subscribeToCompareMode(listener: () => void): () => void {
    modeListeners.add(listener);
    return () => {
        modeListeners.delete(listener);
    };
}

/**
 * Return the current compare-mode flag.
 *
 * @returns `true` if compare mode is currently active.
 */
export function getCompareModeSnapshot(): boolean {
    return compareModeEnabled;
}

/**
 * Return the compare-mode flag used during Astro SSR and hydration: always
 * `false`, since mode is a client-only, section-scoped concept with no
 * server-side equivalent.
 *
 * @returns `false`.
 */
export function getCompareModeServerSnapshot(): boolean {
    return false;
}

/**
 * React hook for subscribing to the compare-mode flag in island components.
 *
 * @example
 * ```tsx
 * function CompareModeToggle() {
 *   const enabled = useCompareMode();
 *   return (
 *     <button onClick={toggleCompareMode}>
 *       {enabled ? 'Exit compare mode' : 'Compare accommodations'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @returns `true` if compare mode is currently active, updated on every change.
 */
export function useCompareMode(): boolean {
    return useSyncExternalStore(
        subscribeToCompareMode,
        getCompareModeSnapshot,
        getCompareModeServerSnapshot
    );
}
