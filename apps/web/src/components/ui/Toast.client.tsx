/**
 * @file Toast.client.tsx
 * @description Toast notification system with icon-based type indicators.
 * Uses feedback design tokens (success, warning, info, destructive).
 * Renders all active toasts in a fixed position container.
 */

import {
    AlertTriangleIcon,
    CheckCircleIcon,
    CloseIcon as CloseIconComponent,
    InfoIcon as InfoIconComponent,
    XCircleIcon
} from '@repo/icons';
import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { cn } from '../../lib/cn';
import { getToasts, removeToast, subscribe } from '../../store/toast-store';
import type { Toast } from '../../store/toast-store';

/** Server snapshot returns empty array (no toasts during SSR) */
const emptyToasts: ReadonlyArray<Toast> = [];
function getServerSnapshot(): ReadonlyArray<Toast> {
    return emptyToasts;
}

/**
 * Custom hook to access toast store state via useSyncExternalStore.
 *
 * @returns Array of current toasts
 */
function useToasts(): ReadonlyArray<Toast> {
    return useSyncExternalStore(subscribe, getToasts, getServerSnapshot);
}

/**
 * Toast icon component (renders appropriate icon based on type)
 *
 * @param params - Component props
 * @param params.type - Toast type
 */
function ToastIcon(params: { readonly type: Toast['type'] }): JSX.Element {
    const { type } = params;

    switch (type) {
        case 'success':
            return (
                <CheckCircleIcon
                    size={20}
                    className="shrink-0"
                    weight="fill"
                    aria-hidden="true"
                />
            );
        case 'error':
            return (
                <XCircleIcon
                    size={20}
                    className="shrink-0"
                    weight="fill"
                    aria-hidden="true"
                />
            );
        case 'warning':
            return (
                <AlertTriangleIcon
                    size={20}
                    className="shrink-0"
                    weight="fill"
                    aria-hidden="true"
                />
            );
        case 'info':
            return (
                <InfoIconComponent
                    size={20}
                    className="shrink-0"
                    weight="fill"
                    aria-hidden="true"
                />
            );
    }
}

/**
 * Get Tailwind CSS classes for a toast type using feedback design tokens.
 *
 * @param type - Toast type
 * @returns CSS class string for the toast type
 */
function getToastTypeClasses(type: Toast['type']): string {
    const typeClasses: Record<Toast['type'], string> = {
        success: 'bg-success/10 text-success border-success/30',
        error: 'bg-destructive/10 text-destructive border-destructive/30',
        warning: 'bg-warning/10 text-warning border-warning/30',
        info: 'bg-info/10 text-info border-info/30'
    };

    return typeClasses[type];
}

/**
 * Individual toast item component
 *
 * @param params - Component props
 * @param params.toast - Toast object
 * @param params.closeToastLabel - Accessible close button label
 */
function ToastItem(params: {
    readonly toast: Toast;
    readonly closeToastLabel: string;
}): JSX.Element {
    const { toast, closeToastLabel } = params;

    const handleClose = (): void => {
        removeToast(toast.id);
    };

    return (
        <div
            role="alert"
            className={cn(
                'slide-in-from-right-5 fade-in pointer-events-auto w-full max-w-sm animate-in rounded-lg border p-4 shadow-lg duration-300',
                getToastTypeClasses(toast.type)
            )}
        >
            <div className="flex items-start gap-3">
                <ToastIcon type={toast.type} />
                <p className="flex-1 font-medium text-sm leading-5">{toast.message}</p>
                <button
                    type="button"
                    onClick={handleClose}
                    className="shrink-0 rounded transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-label={closeToastLabel}
                >
                    <CloseIconComponent
                        size={20}
                        weight="bold"
                        aria-hidden="true"
                    />
                </button>
            </div>
        </div>
    );
}

/**
 * Props for the ToastContainer component
 */
export interface ToastContainerProps {
    /** Locale for content (currently unused, reserved for future i18n) */
    readonly locale?: 'es' | 'en' | 'pt';
    /** Accessible label for the close button (default: "Cerrar notificacion") */
    readonly closeToastLabel?: string;
}

/**
 * Toast container component.
 * Renders all active toasts in a fixed position container.
 * Should be rendered once at the app root level.
 *
 * @param props - Component props
 */
export function ToastContainer({
    locale: _locale = 'es',
    closeToastLabel = 'Cerrar notificacion'
}: ToastContainerProps): JSX.Element {
    const toasts = useToasts();

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-3"
        >
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    closeToastLabel={closeToastLabel}
                />
            ))}
        </div>
    );
}
