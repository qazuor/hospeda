import {
    AlertTriangleIcon,
    CheckCircleIcon,
    CloseIcon as CloseIconComponent,
    InfoIcon as InfoIconComponent,
    XCircleIcon
} from '@repo/icons';
import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { getToasts, removeToast, subscribe } from '../../store/toast-store';
import type { Toast } from '../../store/toast-store';

/**
 * Custom hook to access toast store state
 *
 * Uses React's useSyncExternalStore to sync with the toast store.
 *
 * @returns Array of current toasts
 */
function useToasts(): ReadonlyArray<Toast> {
    return useSyncExternalStore(subscribe, getToasts);
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
 * Get Tailwind CSS classes for a toast type
 *
 * @param type - Toast type
 * @returns CSS class string for the toast type
 */
function getToastTypeClasses(type: Toast['type']): string {
    const typeClasses: Record<Toast['type'], string> = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error: 'bg-red-50 text-red-800 border-red-200',
        warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        info: 'bg-blue-50 text-blue-800 border-blue-200'
    };

    return typeClasses[type];
}

/**
 * Individual toast item component
 *
 * @param params - Component props
 * @param params.toast - Toast object
 */
function ToastItem(params: { readonly toast: Toast }): JSX.Element {
    const { toast } = params;

    const handleClose = (): void => {
        removeToast(toast.id);
    };

    return (
        <div
            role="alert"
            className={`pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out animate-slide-in-right${getToastTypeClasses(toast.type)}
			`}
        >
            <div className="flex items-start gap-3">
                <ToastIcon type={toast.type} />
                <p className="flex-1 font-medium text-sm leading-5">{toast.message}</p>
                <button
                    type="button"
                    onClick={handleClose}
                    className="shrink-0 rounded transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-label="Close notification"
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
 * Toast container component
 *
 * Renders all active toasts in a fixed position container.
 * Should be rendered once at the app root level.
 *
 * @example
 * ```tsx
 * // In your layout/app root
 * <ToastContainer />
 * ```
 */
export function ToastContainer(): JSX.Element {
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
                />
            ))}
        </div>
    );
}
