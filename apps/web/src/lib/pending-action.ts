/**
 * @file pending-action.ts
 * @description "Pending action" handoff for guests who tap something that needs
 * an account (HOS-1925).
 *
 * A guest taps the heart, is sent through sign-in, and lands back on the same
 * page. Nothing about that tap survives the full page navigation unless it is
 * stored first. This module is that store: the guest-side click SAVES the
 * intended action, and the island that can perform it TAKES it once, after a
 * session exists.
 *
 * Guarantees:
 * - **Expires.** An entry older than {@link PENDING_ACTION_TTL_MS} is discarded,
 *   so a tap abandoned at the sign-in form cannot fire hours later.
 * - **Applied once.** {@link takePendingAction} removes the entry as it returns
 *   it, so a reload, a second island or a re-render cannot replay it.
 * - **Page-scoped.** It only matches on the page it was saved for (pathname), so
 *   it is never applied somewhere unrelated.
 * - **Tab-scoped.** Stored in `sessionStorage`, never shared between tabs and
 *   gone when the tab closes.
 * - **Single slot.** A newer tap replaces an older one.
 *
 * A guest has no user id at save time, so the entry cannot be bound to one
 * account. The short TTL, single-use semantics and the callers' requirement of a
 * resolved session bound the exposure instead.
 *
 * Pure client helper: every storage access is guarded, so it is safe to import
 * from islands and a no-op during SSR. It never reads the session, which keeps
 * cacheable pages session-blind.
 */

/** sessionStorage key holding the single pending action. */
export const PENDING_ACTION_STORAGE_KEY = 'hospeda:pendingAction' as const;

/** How long a saved action stays valid (covers a normal sign-in or sign-up). */
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

/** Bookmark entity types, kept structural to avoid importing UI code. */
export type PendingFavoriteEntityType =
    | 'ACCOMMODATION'
    | 'ATTRACTION'
    | 'DESTINATION'
    | 'EVENT'
    | 'EXPERIENCE'
    | 'VENUE'
    | 'POST';

/** An action a guest asked for before signing in. */
export type PendingAction =
    | {
          readonly kind: 'favorite';
          readonly entityType: PendingFavoriteEntityType;
          readonly entityId: string;
      }
    | { readonly kind: 'compare-mode' };

interface StoredPendingAction {
    readonly action: PendingAction;
    readonly path: string;
    readonly expiresAt: number;
}

function getStorage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

function isPendingAction(value: unknown): value is PendingAction {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (candidate.kind === 'compare-mode') return true;
    return (
        candidate.kind === 'favorite' &&
        typeof candidate.entityType === 'string' &&
        typeof candidate.entityId === 'string' &&
        candidate.entityId.length > 0
    );
}

function parseStored(raw: string | null): StoredPendingAction | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        const { action, path, expiresAt } = parsed as Record<string, unknown>;
        if (!isPendingAction(action)) return null;
        if (typeof path !== 'string' || typeof expiresAt !== 'number') return null;
        return { action, path, expiresAt };
    } catch {
        return null;
    }
}

/**
 * Remember an action the guest just asked for.
 *
 * @param params.action - What to perform after authentication.
 * @param params.path - Pathname of the page the action belongs to.
 * @param params.now - Clock override (tests).
 */
export function savePendingAction({
    action,
    path,
    now = Date.now()
}: {
    readonly action: PendingAction;
    readonly path: string;
    readonly now?: number;
}): void {
    const storage = getStorage();
    if (!storage) return;
    const entry: StoredPendingAction = { action, path, expiresAt: now + PENDING_ACTION_TTL_MS };
    try {
        storage.setItem(PENDING_ACTION_STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // Storage full or blocked: the tap is simply not remembered.
    }
}

/** Forget any pending action (the guest dismissed the sign-in prompt). */
export function clearPendingAction(): void {
    try {
        getStorage()?.removeItem(PENDING_ACTION_STORAGE_KEY);
    } catch {
        // Nothing to clear.
    }
}

/**
 * Take the pending action if it is valid, unexpired, saved for this page and
 * accepted by `matches`. A returned action is REMOVED from storage, so each
 * saved tap is applied at most once. An expired or malformed entry is purged.
 * An entry saved for another page or action is left untouched.
 *
 * @param params.path - Pathname of the current page.
 * @param params.matches - Predicate selecting the action this caller can perform.
 * @param params.now - Clock override (tests).
 * @returns The action, or `null` when there is nothing for this caller.
 */
export function takePendingAction({
    path,
    matches,
    now = Date.now()
}: {
    readonly path: string;
    readonly matches: (action: PendingAction) => boolean;
    readonly now?: number;
}): PendingAction | null {
    const storage = getStorage();
    if (!storage) return null;
    let raw: string | null;
    try {
        raw = storage.getItem(PENDING_ACTION_STORAGE_KEY);
    } catch {
        return null;
    }
    if (raw === null) return null;

    const entry = parseStored(raw);
    if (!entry || entry.expiresAt <= now) {
        clearPendingAction();
        return null;
    }
    if (entry.path !== path || !matches(entry.action)) return null;

    clearPendingAction();
    return entry.action;
}
