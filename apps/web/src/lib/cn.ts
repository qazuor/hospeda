import { type ClassValue, clsx } from 'clsx';

/** Merges class names using clsx for conditional class joining */
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}
