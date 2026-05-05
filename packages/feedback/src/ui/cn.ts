import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';

/**
 * Merges CSS class names using clsx.
 *
 * This helper no longer uses tailwind-merge since the feedback package
 * has migrated to CSS Modules. It accepts the same ClassValue inputs
 * as before (strings, arrays, conditionals) for a drop-in replacement.
 *
 * @param inputs - Class values accepted by clsx (strings, arrays, conditionals)
 * @returns A single space-separated class string
 *
 * @example
 * cn(styles.fab, isPulsing && styles.pulsing)
 * cn(styles.container, isMobile ? styles.drawer : styles.modal)
 */
export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs);
}
