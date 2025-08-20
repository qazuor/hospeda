/**
 * React hook for translations in the admin app
 *
 * This hook provides a simple translation function that uses the shared
 * @repo/i18n package. It's designed specifically for React components
 * in the TanStack Start admin application.
 */

import { type TranslationKey, defaultLocale, trans } from '@repo/i18n';
import { useMemo } from 'react';

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

            // Replace {key} and {{key}} patterns with parameter values
            return Object.keys(params).reduce((acc, k) => {
                const v = params[k];
                return acc
                    .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
                    .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            }, raw);
        };

        return { t, locale };
    }, [locale]);

    return translator;
};
