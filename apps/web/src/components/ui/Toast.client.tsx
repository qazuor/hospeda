import {
    AlertTriangleIcon,
    CheckCircleIcon,
    CloseIcon as CloseIconComponent,
    InfoIcon as InfoIconComponent,
    XCircleIcon
} from '@repo/icons';
import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
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
        success: 'bg-success/10 dark:bg-success/20 text-success border-success/30',
        error: 'bg-error/10 dark:bg-error/20 text-error border-error/30',
        warning: 'bg-warning/10 dark:bg-warning/20 text-warning border-warning/30',
        info: 'bg-info/10 dark:bg-info/20 text-info border-info/30'
    };

    return typeClasses[type];
}

/**
 * Individual toast item component
 *
 * @param params - Component props
 * @param params.toast - Toast object
 * @param params.locale - Locale for i18n translations
 */
function ToastItem(params: {
    readonly toast: Toast;
    readonly locale: SupportedLocale;
}): JSX.Element {
    const { toast, locale } = params;
    const { t } = useTranslation({ locale, namespace: 'ui' });

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
                    aria-label={t('accessibility.closeToast')}
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
    /**
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * Toast container component
 *
 * Renders all active toasts in a fixed position container.
 * Should be rendered once at the app root level.
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * // In your layout/app root
 * <ToastContainer locale="es" />
 * ```
 */
export function ToastContainer({ locale = 'es' }: ToastContainerProps): JSX.Element {
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
                    locale={locale}
                />
            ))}
        </div>
    );
}
