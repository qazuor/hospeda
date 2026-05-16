/**
 * @file ToastViewport.client.tsx
 * @description Renders toast notifications from the global toast store.
 *
 * Subscribes to `toast-store` via `useSyncExternalStore` and renders each
 * toast with optional primary/secondary actions. Mounted once in the root
 * layouts (Base/Auth/Error) so any island in the app can call `addToast`
 * and have it appear on screen.
 *
 * On desktop the viewport sits in the top-right corner; on mobile it slides
 * in from the bottom and spans full width. The container is `aria-live=polite`
 * so screen readers announce new toasts without stealing focus.
 */

import { cn } from '@/lib/cn';
import {
    type Toast,
    type ToastAction,
    drainPendingToast,
    getToasts,
    removeToast,
    subscribe
} from '@/store/toast-store';
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, InfoIcon, XCircleIcon } from '@repo/icons';
import { type ComponentType, useEffect, useSyncExternalStore } from 'react';
import styles from './ToastViewport.module.css';

/**
 * Icon shown to the left of the toast message per variant. Gives the user a
 * clear visual cue beyond the (subtle) border accent.
 */
const VARIANT_ICON: Record<Toast['type'], ComponentType<{ size: number; weight: string }>> = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: InfoIcon
};

const EMPTY_TOASTS: ReadonlyArray<Toast> = [];

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

function ToastItem({ toast }: { readonly toast: Toast }) {
    const dismiss = () => removeToast(toast.id);
    const Icon = VARIANT_ICON[toast.type];

    return (
        <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={cn(styles.toast, styles[`toast--${toast.type}`])}
            data-toast-type={toast.type}
        >
            <span
                className={styles.icon}
                aria-hidden="true"
            >
                <Icon
                    size={20}
                    weight="fill"
                />
            </span>
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

            <button
                type="button"
                onClick={dismiss}
                className={styles.close}
                aria-label="Cerrar notificación"
            >
                <CloseIcon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}

/**
 * ToastViewport - global container that renders all active toasts.
 *
 * @example
 * ```astro
 * <ToastViewport client:idle />
 * ```
 */
export function ToastViewport() {
    const toasts = useSyncExternalStore(subscribe, getToasts, getServerSnapshot);

    // Drain any toast persisted via `queueToastForNextPage` on a previous page.
    // Runs once per mount (one effect call per page load).
    useEffect(() => {
        drainPendingToast();
    }, []);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className={styles.viewport}
        >
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                />
            ))}
        </div>
    );
}
