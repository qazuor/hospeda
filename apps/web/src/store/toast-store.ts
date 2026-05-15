/**
 * @file toast-store.ts
 * @description Global toast notification store for web2.
 *
 * Simple pub/sub store for managing toast notifications without external dependencies.
 * Uses module-level state with a subscriber pattern compatible with React's
 * `useSyncExternalStore`.
 *
 * Optional `action` and `secondaryAction` extend the basic toast with up to two
 * call-to-action links rendered next to the dismiss button by `ToastViewport`.
 */

/**
 * A clickable action attached to a toast. Renders as a link or button next to
 * the dismiss button. Either `href` (link) or `onClick` (button) must be set.
 */
export interface ToastAction {
    readonly label: string;
    readonly href?: string;
    readonly onClick?: () => void;
}

/**
 * A toast notification object.
 */
export interface Toast {
    readonly id: string;
    readonly type: 'success' | 'error' | 'warning' | 'info';
    readonly message: string;
    readonly duration?: number;
    /** Primary action (e.g. "Sign in"). Rendered prominently. */
    readonly action?: ToastAction;
    /** Secondary action (e.g. "View benefits"). Rendered as a quieter link. */
    readonly secondaryAction?: ToastAction;
}

let toasts: Toast[] = [];

const listeners = new Set<() => void>();

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

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
 * @param params.action - Optional primary CTA
 * @param params.secondaryAction - Optional secondary CTA (rendered as quieter link)
 * @returns The generated toast `id`
 */
export function addToast(params: Omit<Toast, 'id'>): string {
    const { type, message, duration = 5000, action, secondaryAction } = params;

    const id = generateId();
    const toast: Toast = { id, type, message, duration, action, secondaryAction };

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

export function removeToast(id: string): void {
    const timeoutId = timeouts.get(id);
    if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeouts.delete(id);
    }

    toasts = toasts.filter((toast) => toast.id !== id);
    emitChange();
}

export function clearToasts(): void {
    for (const timeoutId of timeouts.values()) {
        clearTimeout(timeoutId);
    }
    timeouts.clear();

    toasts = [];
    emitChange();
}

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

/**
 * sessionStorage key used by {@link queueToastForNextPage} /
 * {@link drainPendingToast} to persist a toast across a hard navigation
 * (`window.location.href = ...`), which wipes module state otherwise.
 */
const PENDING_TOAST_STORAGE_KEY = 'hospeda.pendingToast';

/**
 * Persist a toast in sessionStorage so it surfaces on the NEXT page load
 * instead of the current one. Use this when calling `addToast` immediately
 * before a hard navigation, where the current page would unmount before
 * the user can see the toast.
 *
 * Drained automatically by `ToastViewport` via {@link drainPendingToast}.
 *
 * @param params - Same shape as {@link addToast} (without `id`).
 */
export function queueToastForNextPage(params: Omit<Toast, 'id'>): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    try {
        sessionStorage.setItem(PENDING_TOAST_STORAGE_KEY, JSON.stringify(params));
    } catch {
        // sessionStorage may throw in private mode or when full — fail silently.
    }
}

/**
 * Read and remove any toast queued by {@link queueToastForNextPage}, then
 * emit it through the regular toast store. Called once on `ToastViewport`
 * mount.
 */
export function drainPendingToast(): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    let raw: string | null = null;
    try {
        raw = sessionStorage.getItem(PENDING_TOAST_STORAGE_KEY);
        if (raw !== null) {
            sessionStorage.removeItem(PENDING_TOAST_STORAGE_KEY);
        }
    } catch {
        // sessionStorage may throw — nothing to drain.
        return;
    }
    if (raw === null) {
        return;
    }
    try {
        const params = JSON.parse(raw) as Omit<Toast, 'id'>;
        if (params && typeof params.message === 'string' && typeof params.type === 'string') {
            addToast(params);
        }
    } catch {
        // Malformed JSON — drop silently.
    }
}
