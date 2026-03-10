import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names, resolving conflicts via tailwind-merge.
 *
 * @param inputs - Class values accepted by clsx (strings, arrays, conditionals)
 * @returns A single deduplicated and conflict-resolved class string
 *
 * @example
 * cn('px-4 py-2', 'px-6') // => 'py-2 px-6'
 * cn('text-red-500', isError && 'text-destructive') // conditional
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
