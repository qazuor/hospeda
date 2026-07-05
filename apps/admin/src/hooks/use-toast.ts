/**
 * Modern toast hook using Flashy.js
 *
 * This hook provides both the legacy toast API (for backward compatibility)
 * and the modern Flashy.js API for new implementations.
 */

export type {
    Toast,
    ToastContextValue,
    ToastVariant
} from '@/components/ui/ToastProvider';
export { useToast } from '@/components/ui/ToastProvider';

// Re-export types for convenience
export type {
    FlashyToastAnimation,
    FlashyToastOptions,
    FlashyToastPosition,
    FlashyToastTheme,
    FlashyToastType,
    UseFlashyToastReturn
} from './use-flashy-toast';
export { useFlashyToast } from './use-flashy-toast';
