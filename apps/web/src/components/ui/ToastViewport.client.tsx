/**
 * @file ToastViewport.client.tsx
 * @description Renders toast notifications from the global toast store.
 *
 * Subscribes to `toast-store` via `useSyncExternalStore` and renders each
 * toast with optional primary/secondary actions. Mounted once in the root
 * layouts (Base/Auth/Error) so any island in the app can call `addToast`
 * and have it appear on screen.
 *
 * UX features
 * - Stacking limit + FIFO eviction (handled in the store).
 * - Hover / focus / window-blur pauses the dismiss timer; restore on leave.
 * - Animated countdown progress bar synced to the remaining timer.
 * - Animated exit (slide + fade) before the toast is actually removed.
 * - Swipe-to-dismiss on touch / pointer devices.
 * - `aria-live="polite"` viewport stays mounted permanently so screen
 *   readers reliably announce new toasts.
 */

import { cn } from '@/lib/cn';
import { type SupportedLocale, createTranslations } from '@/lib/i18n';
import * as toastStore from '@/store/toast-store';
import {
    type Toast,
    type ToastAction,
    drainPendingToast,
    getToasts,
    pauseToast,
    removeToast,
    resumeToast,
    subscribe
} from '@/store/toast-store';
import {
    AlertTriangleIcon,
    CheckCircleIcon,
    CloseIcon,
    type IconProps,
    InfoIcon,
    LoaderIcon,
    XCircleIcon
} from '@repo/icons';
import {
    type ComponentType,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore
} from 'react';
import styles from './ToastViewport.module.css';

/**
 * Icon shown to the left of the toast message per variant. Gives the user a
 * clear visual cue beyond the (subtle) border accent.
 */
const VARIANT_ICON: Record<Toast['type'], ComponentType<IconProps>> = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: InfoIcon,
    loading: LoaderIcon
};

const EMPTY_TOASTS: ReadonlyArray<Toast> = [];

/** Visual duration of the exit animation. Must match `toast-out` in the CSS. */
const EXIT_ANIMATION_MS = 200;

/** Horizontal distance (px) past which a swipe commits to dismissal. */
const SWIPE_DISMISS_THRESHOLD = 80;

function getServerSnapshot(): ReadonlyArray<Toast> {
    return EMPTY_TOASTS;
}

function ToastActionLink({
    action,
    onAfterClick,
    variant
}: {
    readonly action: ToastAction;
    readonly onAfterClick: () => void;
    readonly variant: 'primary' | 'secondary';
}) {
    const className = cn(
        styles.action,
        variant === 'primary' ? styles.actionPrimary : styles.actionSecondary
    );

    if (action.href) {
        return (
            <a
                href={action.href}
                onClick={onAfterClick}
                className={className}
            >
                {action.label}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                action.onClick?.();
                onAfterClick();
            }}
            className={className}
        >
            {action.label}
        </button>
    );
}

interface ToastItemProps {
    readonly toast: Toast;
    readonly closeLabel: string;
}

function ToastItem({ toast, closeLabel }: ToastItemProps) {
    const [isExiting, setIsExiting] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const pointerStartXRef = useRef<number | null>(null);
    const isLoading = toast.type === 'loading';
    const Icon = VARIANT_ICON[toast.type];

    /**
     * Trigger exit animation, then remove from the store after the keyframe
     * has had time to play. Re-entrant calls are no-ops thanks to the flag.
     */
    const dismiss = useCallback(() => {
        if (isExiting) {
            return;
        }
        setIsExiting(true);
        window.setTimeout(() => {
            removeToast(toast.id);
        }, EXIT_ANIMATION_MS);
    }, [isExiting, toast.id]);

    // Pause the timer when the user is interacting with the toast (hover or
    // keyboard focus) or when the tab loses visibility. Resume on leave.
    useEffect(() => {
        if (isLoading || toast.duration <= 0) {
            return;
        }
        const onVisibilityChange = () => {
            if (document.hidden) {
                pauseToast(toast.id);
            } else {
                resumeToast(toast.id);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isLoading, toast.duration, toast.id]);

    const handlePointerEnter = useCallback(() => {
        if (!isLoading) {
            pauseToast(toast.id);
        }
    }, [isLoading, toast.id]);

    const handlePointerLeave = useCallback(() => {
        if (!isLoading) {
            resumeToast(toast.id);
        }
    }, [isLoading, toast.id]);

    const handleFocus = useCallback(() => {
        if (!isLoading) {
            pauseToast(toast.id);
        }
    }, [isLoading, toast.id]);

    const handleBlur = useCallback(
        (event: React.FocusEvent<HTMLDivElement>) => {
            // Only resume when focus leaves the toast entirely, not when it
            // bounces between the close button and an action link.
            if (!isLoading && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
                resumeToast(toast.id);
            }
        },
        [isLoading, toast.id]
    );

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        // Ignore non-primary buttons and pointer types where swipe isn't
        // expected (mouse left-drag is fine; right-click etc. is not).
        if (event.button !== 0) {
            return;
        }
        pointerStartXRef.current = event.clientX;
    }, []);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerStartXRef.current === null) {
            return;
        }
        // Only allow horizontal swipe to the right (out of the viewport on
        // bottom-right placement). Negative drag is clamped to zero.
        const delta = event.clientX - pointerStartXRef.current;
        setSwipeOffset(Math.max(0, delta));
    }, []);

    const endSwipe = useCallback(() => {
        const offset = swipeOffset;
        pointerStartXRef.current = null;
        if (offset >= SWIPE_DISMISS_THRESHOLD) {
            // Commit the swipe by jumping it to a fully-off position before
            // triggering the regular exit animation, so the slide reads as
            // continuous.
            setSwipeOffset(offset + 200);
            window.setTimeout(() => {
                removeToast(toast.id);
            }, EXIT_ANIMATION_MS);
            return;
        }
        // Spring back.
        setSwipeOffset(0);
    }, [swipeOffset, toast.id]);

    const timerProgress = !isLoading && toast.duration > 0;

    const style: React.CSSProperties & Record<string, string | number> = {
        '--toast-duration': `${toast.duration}ms`
    };
    if (swipeOffset !== 0) {
        style.transform = `translateX(${swipeOffset}px)`;
        style.transition = pointerStartXRef.current === null ? 'transform 0.18s ease' : 'none';
        style.opacity = Math.max(0.2, 1 - swipeOffset / 200);
    }

    return (
        <div
            // `role=alert` interrupts; reserve for errors. Everything else uses
            // `status` so it joins the polite announcement queue.
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={cn(styles.toast, isExiting && styles.exiting)}
            data-toast-type={toast.type}
            style={style}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endSwipe}
            onPointerCancel={endSwipe}
        >
            <span
                className={cn(styles.icon, isLoading && styles.iconSpinning)}
                aria-hidden="true"
            >
                <Icon
                    size={28}
                    weight={isLoading ? 'regular' : 'fill'}
                />
            </span>

            <div className={styles.body}>
                <p className={styles.message}>{toast.message}</p>

                {(toast.action || toast.secondaryAction) && (
                    <div className={styles.actions}>
                        {toast.secondaryAction && (
                            <ToastActionLink
                                action={toast.secondaryAction}
                                onAfterClick={dismiss}
                                variant="secondary"
                            />
                        )}
                        {toast.action && (
                            <ToastActionLink
                                action={toast.action}
                                onAfterClick={dismiss}
                                variant="primary"
                            />
                        )}
                    </div>
                )}
            </div>

            <div className={styles.closeWrap}>
                {timerProgress && (
                    // Circular countdown that wraps the close button. The
                    // `version` key restarts the animation cleanly when the
                    // toast is updated in place (loading -> success/error).
                    <svg
                        key={`countdown-${toast.version}`}
                        className={styles.countdown}
                        viewBox="0 0 32 32"
                        aria-hidden="true"
                    >
                        <title>countdown</title>
                        <circle
                            cx="16"
                            cy="16"
                            r="14"
                            pathLength="100"
                            className={styles.countdownTrack}
                        />
                        <circle
                            cx="16"
                            cy="16"
                            r="14"
                            pathLength="100"
                            className={styles.countdownIndicator}
                        />
                    </svg>
                )}
                <button
                    type="button"
                    onClick={dismiss}
                    className={styles.close}
                    aria-label={closeLabel}
                >
                    <CloseIcon
                        size={14}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
            </div>
        </div>
    );
}

interface ToastViewportProps {
    readonly locale?: SupportedLocale;
}

/**
 * ToastViewport - global container that renders all active toasts.
 *
 * @example
 * ```astro
 * <ToastViewport client:idle locale={locale} />
 * ```
 */
export function ToastViewport({ locale = 'es' }: ToastViewportProps) {
    const toasts = useSyncExternalStore(subscribe, getToasts, getServerSnapshot);
    const { t } = createTranslations(locale);
    const closeLabel = t('ui.accessibility.closeToast', 'Cerrar notificación');

    // Drain any toast persisted via `queueToastForNextPage` on a previous page.
    // Runs once per mount (one effect call per page load).
    useEffect(() => {
        drainPendingToast();
        if (import.meta.env.DEV) {
            // Expose the same store instance the viewport is subscribed to,
            // so `window.__t.addToast(...)` from DevTools updates the visible
            // toasts. Without this the console import resolves to a separate
            // module instance and toasts are added to a phantom store.
            (window as unknown as { __t: typeof toastStore }).__t = toastStore;
        }
    }, []);

    // Keep the live region mounted even when empty so screen readers don't
    // lose the announcement channel between toasts.
    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className={cn(styles.viewport, toasts.length === 0 && styles.viewportEmpty)}
        >
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    closeLabel={closeLabel}
                />
            ))}
        </div>
    );
}
