/**
 * React hook for Flashy.js toast notifications
 *
 * This hook provides a clean interface to use Flashy.js toast notifications
 * with TypeScript support and consistent configuration across the admin app.
 */

import flashy from '@pablotheblink/flashyjs';
import { useCallback } from 'react';

/**
 * Available toast types from Flashy.js
 */
export type FlashyToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

/**
 * Available positions for toast notifications
 */
export type FlashyToastPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

/**
 * Available animations for toast notifications
 */
export type FlashyToastAnimation = 'slide' | 'fade' | 'bounce' | 'zoom';

/**
 * Available themes for toast notifications
 */
export type FlashyToastTheme = 'light' | 'dark';

/**
 * Configuration options for Flashy.js toast notifications
 */
export type FlashyToastOptions = {
    readonly type?: FlashyToastType;
    readonly position?: FlashyToastPosition;
    readonly duration?: number;
    readonly closable?: boolean;
    readonly animation?: FlashyToastAnimation;
    readonly theme?: FlashyToastTheme;
    readonly icon?: string;
    readonly onClick?: () => void;
    readonly onClose?: () => void;
};

/**
 * Simple toast configuration for common use cases
 */
export type SimpleToastConfig = {
    readonly message: string;
    readonly type?: FlashyToastType;
    readonly duration?: number;
};

/**
 * Hook return type with toast methods
 */
export type UseFlashyToastReturn = {
    readonly toast: (message: string, options?: FlashyToastOptions | FlashyToastType) => () => void;
    readonly success: (message: string, options?: Omit<FlashyToastOptions, 'type'>) => () => void;
    readonly error: (message: string, options?: Omit<FlashyToastOptions, 'type'>) => () => void;
    readonly warning: (message: string, options?: Omit<FlashyToastOptions, 'type'>) => () => void;
    readonly info: (message: string, options?: Omit<FlashyToastOptions, 'type'>) => () => void;
    readonly closeAll: () => void;
    readonly setDefaults: (defaults: Partial<FlashyToastOptions>) => void;
};

/**
 * Default configuration for toast notifications in the admin app
 */
const DEFAULT_CONFIG: FlashyToastOptions = {
    position: 'top-right',
    duration: 5000,
    closable: true,
    animation: 'slide',
    theme: 'light'
};

/**
 * React hook that provides Flashy.js toast notification functionality
 *
 * @returns Object with toast methods and utilities
 *
 * @example
 * ```tsx
 * const { toast, success, error } = useFlashyToast();
 *
 * // Simple usage
 * success('Operation completed successfully!');
 * error('Something went wrong');
 *
 * // Advanced usage
 * toast('Custom message', {
 *     type: 'info',
 *     position: 'bottom-center',
 *     duration: 3000,
 *     onClick: () => console.log('Toast clicked!')
 * });
 * ```
 */
export const useFlashyToast = (): UseFlashyToastReturn => {
    // Set default configuration on first use
    flashy.setDefaults(DEFAULT_CONFIG);

    const toast = useCallback(
        (message: string, options?: FlashyToastOptions | FlashyToastType): (() => void) => {
            // Handle string type shorthand
            if (typeof options === 'string') {
                return flashy(message, options);
            }

            // Handle full options object
            return flashy(message, options || {});
        },
        []
    );

    const success = useCallback(
        (message: string, options?: Omit<FlashyToastOptions, 'type'>): (() => void) => {
            return flashy.success(message, options);
        },
        []
    );

    const error = useCallback(
        (message: string, options?: Omit<FlashyToastOptions, 'type'>): (() => void) => {
            return flashy.error(message, options);
        },
        []
    );

    const warning = useCallback(
        (message: string, options?: Omit<FlashyToastOptions, 'type'>): (() => void) => {
            return flashy.warning(message, options);
        },
        []
    );

    const info = useCallback(
        (message: string, options?: Omit<FlashyToastOptions, 'type'>): (() => void) => {
            return flashy.info(message, options);
        },
        []
    );

    const closeAll = useCallback((): void => {
        flashy.closeAll();
    }, []);

    const setDefaults = useCallback((defaults: Partial<FlashyToastOptions>): void => {
        flashy.setDefaults(defaults);
    }, []);

    return {
        toast,
        success,
        error,
        warning,
        info,
        closeAll,
        setDefaults
    };
};
