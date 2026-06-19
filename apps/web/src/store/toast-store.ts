/**
 * @file toast-store.ts
 * @description Global toast notification store for web.
 *
 * Pub/sub store for managing toast notifications without external dependencies.
 * Module-level state with a subscriber pattern compatible with React's
 * `useSyncExternalStore`.
 *
 * Features:
 * - Stacking limit (FIFO eviction) so floods of toasts can't pile up.
 * - Pause / resume of the dismiss timer (used by hover and window blur).
 * - In-place updates via {@link updateToast}, which enables {@link promiseToast}
 *   and `loading -> success/error` transitions.
 * - `queueToastForNextPage` / `drainPendingToast` to survive hard navigations.
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

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

/**
 * A toast notification object.
 */
export interface Toast {
    readonly id: string;
    readonly type: ToastType;
    readonly message: string;
    /**
     * Auto-dismiss delay in ms. `0` means persistent (no auto-dismiss).
     * `loading` toasts are always persistent regardless of this value.
     */
    readonly duration: number;
    /** Primary action (e.g. "Sign in"). Rendered prominently. */
    readonly action?: ToastAction;
    /** Secondary action (e.g. "View benefits"). Rendered as a quieter link. */
    readonly secondaryAction?: ToastAction;
    /** Monotonically increasing version. Bumped on every {@link updateToast}. */
    readonly version: number;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;

let toasts: Toast[] = [];

const listeners = new Set<() => void>();

type TimerState = {
    timeoutId: ReturnType<typeof setTimeout>;
    /** Total duration originally requested for this toast (ms). */
    totalDuration: number;
    /** Remaining ms when the current timer was started. */
    remaining: number;
    /** `Date.now()` at the moment the current timer was started. */
    startedAt: number;
    /** `true` while paused (timer cleared, remaining frozen). */
    paused: boolean;
};

const timers = new Map<string, TimerState>();

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

function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (!timer) {
        return;
    }
    clearTimeout(timer.timeoutId);
    timers.delete(id);
}

function scheduleDismiss(id: string, ms: number, totalDuration: number): void {
    clearTimer(id);
    const timeoutId = setTimeout(() => {
        removeToast(id);
    }, ms);
    timers.set(id, {
        timeoutId,
        totalDuration,
        remaining: ms,
        startedAt: Date.now(),
        paused: false
    });
}

/**
 * Add a new toast notification to the store. Enforces {@link MAX_TOASTS} by
 * evicting the oldest non-loading toast when over the cap.
 *
 * @param params - Toast configuration (without `id` or `version`)
 * @returns The generated toast `id`
 */
export function addToast(params: {
    readonly type: ToastType;
    readonly message: string;
    /** Auto-dismiss delay in ms. Defaults to 5000. Pass 0 to persist. */
    readonly duration?: number;
    readonly action?: ToastAction;
    readonly secondaryAction?: ToastAction;
}): string {
    const { type, message, action, secondaryAction } = params;

    const isLoading = type === 'loading';
    const duration = isLoading ? 0 : (params.duration ?? DEFAULT_DURATION);

    const id = generateId();
    const toast: Toast = {
        id,
        type,
        message,
        duration,
        action,
        secondaryAction,
        version: 0
    };

    let next = [...toasts, toast];

    if (next.length > MAX_TOASTS) {
        const evictId = pickEvictionTarget(next);
        if (evictId !== null) {
            clearTimer(evictId);
            next = next.filter((t) => t.id !== evictId);
        }
    }

    toasts = next;
    emitChange();

    if (duration > 0) {
        scheduleDismiss(id, duration, duration);
    }

    return id;
}

/**
 * Pick which toast to drop when the stack overflows. Prefers the oldest
 * non-loading entry so async operations in flight survive new noise.
 */
function pickEvictionTarget(list: ReadonlyArray<Toast>): string | null {
    for (const t of list) {
        if (t.type !== 'loading') {
            return t.id;
        }
    }
    return list[0]?.id ?? null;
}

/**
 * Update an existing toast in place. Used by {@link promiseToast} to swap a
 * `loading` toast into its `success` / `error` outcome without re-mounting.
 * Bumps the toast's `version` so consumers can reset per-render state
 * (animations, progress bar, etc).
 *
 * @param id - Toast id returned by {@link addToast}
 * @param patch - Fields to overwrite
 * @returns `true` if the toast existed and was updated
 */
export function updateToast(
    id: string,
    patch: {
        readonly type?: ToastType;
        readonly message?: string;
        readonly duration?: number;
        readonly action?: ToastAction;
        readonly secondaryAction?: ToastAction;
    }
): boolean {
    const index = toasts.findIndex((t) => t.id === id);
    if (index === -1) {
        return false;
    }

    const current = toasts[index];
    if (!current) {
        return false;
    }

    const nextType = patch.type ?? current.type;
    const isLoading = nextType === 'loading';
    const requestedDuration = patch.duration ?? current.duration;
    const nextDuration = isLoading ? 0 : requestedDuration;

    const next: Toast = {
        ...current,
        type: nextType,
        message: patch.message ?? current.message,
        duration: nextDuration,
        // `action` / `secondaryAction` can be cleared explicitly by passing
        // `undefined` in the patch (preserving the previous value otherwise).
        action: 'action' in patch ? patch.action : current.action,
        secondaryAction:
            'secondaryAction' in patch ? patch.secondaryAction : current.secondaryAction,
        version: current.version + 1
    };

    toasts = toasts.map((t, i) => (i === index ? next : t));
    emitChange();

    if (nextDuration > 0) {
        scheduleDismiss(id, nextDuration, nextDuration);
    } else {
        clearTimer(id);
    }

    return true;
}

export function removeToast(id: string): void {
    clearTimer(id);
    const filtered = toasts.filter((toast) => toast.id !== id);
    if (filtered.length === toasts.length) {
        return;
    }
    toasts = filtered;
    emitChange();
}

export function clearToasts(): void {
    for (const id of [...timers.keys()]) {
        clearTimer(id);
    }
    toasts = [];
    emitChange();
}

export function getToasts(): ReadonlyArray<Toast> {
    return toasts;
}

/**
 * Pause the dismiss timer for the given toast. Safe to call when no timer is
 * active (loading or already paused). The remaining time is preserved until
 * {@link resumeToast} is called.
 */
export function pauseToast(id: string): void {
    const timer = timers.get(id);
    if (!timer || timer.paused) {
        return;
    }
    const elapsed = Date.now() - timer.startedAt;
    const remaining = Math.max(0, timer.remaining - elapsed);
    clearTimeout(timer.timeoutId);
    timers.set(id, {
        ...timer,
        // TYPE-WORKAROUND: `ReturnType<typeof setTimeout>` is `NodeJS.Timeout` in Node
        // and `number` in browsers; using `0` as a sentinel for "no active timer" when
        // the timer is paused requires a cast because `0` is not assignable to either.
        timeoutId: 0 as unknown as ReturnType<typeof setTimeout>,
        remaining,
        paused: true
    });
}

/**
 * Resume a previously paused dismiss timer. No-op if the toast has no timer
 * or is not paused.
 */
export function resumeToast(id: string): void {
    const timer = timers.get(id);
    if (!timer || !timer.paused) {
        return;
    }
    if (timer.remaining <= 0) {
        removeToast(id);
        return;
    }
    const timeoutId = setTimeout(() => {
        removeToast(id);
    }, timer.remaining);
    timers.set(id, {
        ...timer,
        timeoutId,
        startedAt: Date.now(),
        paused: false
    });
}

/**
 * Snapshot of the current timer state for a toast. Used by the viewport to
 * sync the progress-bar animation duration / play-state.
 */
export interface ToastTimerSnapshot {
    readonly totalDuration: number;
    readonly remaining: number;
    readonly paused: boolean;
}

export function getToastTimer(id: string): ToastTimerSnapshot | null {
    const timer = timers.get(id);
    if (!timer) {
        return null;
    }
    const remaining = timer.paused
        ? timer.remaining
        : Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    return {
        totalDuration: timer.totalDuration,
        remaining,
        paused: timer.paused
    };
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
 * Convenience helper that ties a Promise to a toast lifecycle. Shows a
 * `loading` toast immediately, then swaps it in place to a `success` or
 * `error` toast based on the promise outcome.
 *
 * @example
 * ```ts
 * promiseToast(api.save(data), {
 *   loading: 'Guardando...',
 *   success: 'Guardado',
 *   error: (err) => `Falló: ${err.message}`
 * });
 * ```
 *
 * @returns The original promise, so the caller can `await` it.
 */
export function promiseToast<T>(
    promise: Promise<T>,
    messages: {
        readonly loading: string;
        readonly success: string | ((value: T) => string);
        readonly error: string | ((error: unknown) => string);
        /** Duration for the resolved success/error toast. Defaults to 5000. */
        readonly duration?: number;
    }
): Promise<T> {
    const id = addToast({ type: 'loading', message: messages.loading });

    promise.then(
        (value) => {
            const message =
                typeof messages.success === 'function' ? messages.success(value) : messages.success;
            updateToast(id, { type: 'success', message, duration: messages.duration });
        },
        (error: unknown) => {
            const message =
                typeof messages.error === 'function' ? messages.error(error) : messages.error;
            updateToast(id, { type: 'error', message, duration: messages.duration });
        }
    );

    return promise;
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
 */
export function queueToastForNextPage(params: {
    readonly type: ToastType;
    readonly message: string;
    readonly duration?: number;
    readonly action?: ToastAction;
    readonly secondaryAction?: ToastAction;
}): void {
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
        return;
    }
    if (raw === null) {
        return;
    }
    try {
        const params = JSON.parse(raw) as {
            readonly type?: ToastType;
            readonly message?: string;
            readonly duration?: number;
            readonly action?: ToastAction;
            readonly secondaryAction?: ToastAction;
        };
        if (params && typeof params.message === 'string' && typeof params.type === 'string') {
            addToast({
                type: params.type,
                message: params.message,
                duration: params.duration,
                action: params.action,
                secondaryAction: params.secondaryAction
            });
        }
    } catch {
        // Malformed JSON — drop silently.
    }
}
