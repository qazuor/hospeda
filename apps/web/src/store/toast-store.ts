/**
 * @file toast-store.ts
 * @description Global toast notification store for web2.
 *
 * Simple pub/sub store for managing toast notifications without external dependencies.
 * Uses module-level state with a subscriber pattern compatible with React's
 * `useSyncExternalStore`.
 *
 * Copied from `apps/web` with no changes — the API is identical across both apps.
 */

/**
 * A toast notification object.
 */
export interface Toast {
    readonly id: string;
    readonly type: 'success' | 'error' | 'warning' | 'info';
    readonly message: string;
    readonly duration?: number;
}

/** Internal mutable store state */
let toasts: Toast[] = [];

/** Set of listener callbacks to notify on state changes */
const listeners = new Set<() => void>();

/** Map of toast IDs to their auto-dismiss timeout IDs */
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

/** Notify all subscribers of a state change */
function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Generate a unique identifier for a toast.
 *
 * @returns Unique toast identifier string
 */
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a new toast notification to the store.
 *
 * @param params - Toast configuration (without `id`)
 * @param params.type - Visual type: success | error | warning | info
 * @param params.message - Human-readable message content
 * @param params.duration - Auto-dismiss delay in ms. Defaults to 5000. Pass 0 to persist.
 * @returns The generated toast `id`
 */
export function addToast(params: Omit<Toast, 'id'>): string {
    const { type, message, duration = 5000 } = params;

    const id = generateId();
    const toast: Toast = { id, type, message, duration };

    toasts = [...toasts, toast];
    emitChange();

    if (duration > 0) {
        const timeoutId = setTimeout(() => {
            removeToast(id);
        }, duration);
        timeouts.set(id, timeoutId);
    }

    return id;
}

/**
 * Remove a toast notification by its `id`.
 *
 * @param id - Toast identifier to remove
 */
export function removeToast(id: string): void {
    const timeoutId = timeouts.get(id);
    if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeouts.delete(id);
    }

    toasts = toasts.filter((toast) => toast.id !== id);
    emitChange();
}

/**
 * Remove all toast notifications from the store.
 */
export function clearToasts(): void {
    for (const timeoutId of timeouts.values()) {
        clearTimeout(timeoutId);
    }
    timeouts.clear();

    toasts = [];
    emitChange();
}

/**
 * Get the current snapshot of toasts.
 *
 * @returns Readonly array of current toasts
 */
export function getToasts(): ReadonlyArray<Toast> {
    return toasts;
}

/**
 * Subscribe to toast store changes (compatible with `useSyncExternalStore`).
 *
 * @param listener - Callback invoked whenever the store changes
 * @returns Unsubscribe function
 */
export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
