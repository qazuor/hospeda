/**
 * React hook for translations
 *
 * This hook provides a simple translation function that uses the shared
 * @repo/i18n package. It's designed for React components across all apps
 * in the monorepo.
 */

import { useMemo } from 'react';
import { defaultLocale, trans } from '../config';
import { pluralize } from '../pluralization';
import type { TranslationKey } from '../types';

/**
 * Hook that provides translation functionality for React components
 *
 * @param locale - The locale to use for translations (defaults to 'es')
 * @returns Object with translation function and current locale
 *
 * @example
 * ```tsx
 * const { t } = useTranslations();
 *
 * return (
 *   <button>{t('admin-dashboard.actions.create')}</button>
 * );
 * ```
 */
export const useTranslations = (locale: string = defaultLocale) => {
    const translator = useMemo(() => {
        /**
         * Translation function that retrieves translated text by key
         *
         * @param key - The translation key in dot notation
         * @param params - Optional parameters for string interpolation
         * @returns The translated string or a fallback message
         */
        const t = (key: TranslationKey, params?: Record<string, unknown>): string => {
            const raw = trans[locale as keyof typeof trans]?.[key] || trans[defaultLocale][key];

            if (!raw) {
                console.error(`Translation key not found: ${key}`);
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
        };

        /**
         * Pluralization function that resolves _one/_other keys based on count.
         *
         * @param key - The base translation key (without _one/_other suffix).
         * @param count - The count value to determine plural form.
         * @param params - Optional additional parameters for interpolation.
         * @returns The resolved plural translation string.
         *
         * @example
         * ```tsx
         * tPlural('review.list.totalReviews', 5) // "5 reviews"
         * tPlural('review.list.totalReviews', 1) // "1 review"
         * ```
         */
        const tPlural = (key: string, count: number, params?: Record<string, unknown>): string => {
            return pluralize({
                t: (k: string, p?: Record<string, unknown>) => t(k as TranslationKey, p),
                key,
                count,
                params
            });
        };

        return { t, tPlural, locale };
    }, [locale]);

    return translator;
};
