/**
 * Modern toast hook using Flashy.js
 *
 * This hook provides both the legacy toast API (for backward compatibility)
 * and the modern Flashy.js API for new implementations.
 */

export { useToast } from '@/components/ui/ToastProvider';
export { useFlashyToast } from './use-flashy-toast';

// Re-export types for convenience
export type {
    FlashyToastAnimation,
    FlashyToastOptions,
    FlashyToastPosition,
    FlashyToastTheme,
    FlashyToastType,
    UseFlashyToastReturn
} from './use-flashy-toast';

export type {
    Toast,
    ToastContextValue,
    ToastVariant
} from '@/components/ui/ToastProvider';
