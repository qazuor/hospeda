/**
 * Toast Provider using Flashy.js
 *
 * This component provides toast notification functionality using the Flashy.js library.
 * It maintains backward compatibility with the previous toast API while leveraging
 * the modern features of Flashy.js.
 */

import { type FlashyToastType, useFlashyToast } from '@/hooks/use-flashy-toast';
import { type ReactNode, createContext, useCallback, useContext, useMemo } from 'react';

/**
 * Legacy toast variant type for backward compatibility
 */
export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

/**
 * Legacy toast configuration for backward compatibility
 */
export type Toast = {
    readonly title?: string;
    readonly message: string;
    readonly variant?: ToastVariant;
    readonly durationMs?: number;
};

/**
 * Toast context value with legacy API
 */
export type ToastContextValue = {
    readonly addToast: (toast: Toast) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Hook to access toast functionality (legacy API)
 *
 * @returns Toast context with addToast method
 * @throws Error if used outside ToastProvider
 */
export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

/**
 * Props for ToastProvider component
 */
export type ToastProviderProps = {
    readonly children: ReactNode;
};

/**
 * Maps legacy toast variants to Flashy.js types
 */
const mapVariantToFlashyType = (variant?: ToastVariant): FlashyToastType => {
    switch (variant) {
        case 'success':
            return 'success';
        case 'error':
            return 'error';
        case 'warning':
            return 'warning';
        case 'info':
            return 'info';
        default:
            return 'default';
    }
};

/**
 * Toast Provider component using Flashy.js
 *
 * Provides toast notification functionality throughout the application.
 * Uses Flashy.js under the hood while maintaining backward compatibility
 * with the previous toast API.
 *
 * @param props - Component props
 * @returns JSX element
 */
export const ToastProvider = ({ children }: ToastProviderProps) => {
    const { toast } = useFlashyToast();

    const addToast = useCallback(
        (toastConfig: Toast) => {
            const { message, variant, durationMs, title } = toastConfig;

            // Build the display message (include title if provided)
            const displayMessage = title ? `${title}: ${message}` : message;

            // Convert legacy variant to Flashy.js type
            const flashyType = mapVariantToFlashyType(variant);

            // Show toast using Flashy.js
            toast(displayMessage, {
                type: flashyType,
                duration: durationMs || 15000,
                position: 'top-right',
                closable: true,
                animation: 'fade',
                theme: 'dark'
            });
        },
        [toast]
    );

    const value = useMemo<ToastContextValue>(() => ({ addToast }), [addToast]);

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
