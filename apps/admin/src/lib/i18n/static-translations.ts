/**
 * Static translation helper for class components
 *
 * This module provides a translation function that can be used in class components
 * where React hooks are not available (e.g., error boundaries with getDerivedStateFromError).
 */

import { defaultLocale, trans } from '@repo/i18n';
import type { TranslationKey } from '@repo/i18n';
import { adminLogger } from '../../utils/logger';

/**
 * Get a translation by key without requiring hooks
 *
 * @param key - The translation key in dot notation
 * @param params - Optional parameters for string interpolation
 * @returns The translated string or a fallback message
 *
 * @example
 * ```ts
 * // In a class component
 * const title = getTranslation('error.boundary.entity.notFoundTitle', { entity: 'Alojamiento' });
 * ```
 */
export function getTranslation(key: TranslationKey, params?: Record<string, unknown>): string {
    const raw = trans[defaultLocale]?.[key];

    if (!raw) {
        adminLogger.error(`Translation key not found: ${key}`);
        return `[MISSING: ${key}]`;
    }

    if (!params) return raw;

    // Replace {{key}} and {key} patterns with parameter values
    // IMPORTANT: Must replace double braces FIRST to avoid partial matches
    return Object.keys(params).reduce((acc, k) => {
        const v = params[k];
        return acc
            .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
            .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }, raw);
}

/**
 * Alias for getTranslation - shorter name for convenience
 */
export const t = getTranslation;
