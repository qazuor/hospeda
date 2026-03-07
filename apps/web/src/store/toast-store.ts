/**
 * @file toast-store.ts
 * @description Toast notification store.
 * Simple pub/sub store for managing toast notifications without external dependencies.
 * Uses module-level state with subscribers pattern compatible with React's useSyncExternalStore.
 */

/**
 * Toast notification object
 */
export interface Toast {
    readonly id: string;
    readonly type: 'success' | 'error' | 'warning' | 'info';
    readonly message: string;
    readonly duration?: number;
}

/** Internal mutable store state */
let toasts: Toast[] = [];

/** Set of listener functions to notify on state changes */
const listeners = new Set<() => void>();

/** Map of toast IDs to their auto-dismiss timeout IDs */
const timeouts = new Map<string, NodeJS.Timeout>();

/** Notify all subscribers of state change */
function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Generate a unique ID for a toast
 *
 * @returns Unique toast identifier
 */
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a new toast notification
 *
 * @param params - Toast configuration
 * @param params.type - Toast type (success, error, warning, info)
 * @param params.message - Toast message content
 * @param params.duration - Auto-dismiss duration in milliseconds (default: 5000)
 * @returns The ID of the created toast
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
 * Remove a toast notification by ID
 *
 * @param id - Toast ID to remove
 */
export function removeToast(id: string): void {
    const timeoutId = timeouts.get(id);
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeouts.delete(id);
    }

    toasts = toasts.filter((toast) => toast.id !== id);
    emitChange();
}

/**
 * Remove all toast notifications
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
 * Get the current array of toasts
 *
 * @returns Readonly array of current toasts
 */
export function getToasts(): ReadonlyArray<Toast> {
    return toasts;
}

/**
 * Subscribe to toast store changes
 *
 * @param listener - Callback function to invoke on state change
 * @returns Unsubscribe function
 */
export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
