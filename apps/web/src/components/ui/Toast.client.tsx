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
 * Icon component for success toast
 */
function SuccessIcon(): JSX.Element {
    return (
        <svg
            className="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Icon component for error toast
 */
function ErrorIcon(): JSX.Element {
    return (
        <svg
            className="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Icon component for warning toast
 */
function WarningIcon(): JSX.Element {
    return (
        <svg
            className="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Icon component for info toast
 */
function InfoIcon(): JSX.Element {
    return (
        <svg
            className="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Close icon for dismiss button
 */
function CloseIcon(): JSX.Element {
    return (
        <svg
            className="size-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
    );
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
            return <SuccessIcon />;
        case 'error':
            return <ErrorIcon />;
        case 'warning':
            return <WarningIcon />;
        case 'info':
            return <InfoIcon />;
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
                    <CloseIcon />
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
