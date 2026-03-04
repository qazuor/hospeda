/**
 * React hook for translations in web2 components.
 * Provides a memoized translation function integrated with @repo/i18n.
 */

import type { Namespace } from '@repo/i18n';
import { useMemo } from 'react';
import {
    DEFAULT_LOCALE,
    type SupportedLocale,
    tPlural as tPluralFn,
    t as translateFn
} from '../lib/i18n';

/**
 * Hook that provides translation functionality for React components.
 * Returns a memoized translation function scoped to a specific locale and namespace.
 *
 * @param params - Object with locale and namespace.
 * @param params.locale - The locale to use for translations (defaults to 'es').
 * @param params.namespace - The namespace for translation keys.
 * @returns Object with translation function.
 *
 * @example
 * ```tsx
 * import { useTranslation } from '@/hooks/useTranslation';
 *
 * export function SearchBar({ locale }: { locale: SupportedLocale }) {
 *   const { t } = useTranslation({ locale, namespace: 'common' });
 *
 *   return (
 *     <div>
 *       <input placeholder={t('search')} />
 *       <button>{t('submit')}</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With parameters
 * const { t } = useTranslation({ locale: 'es', namespace: 'blog' });
 *
 * return (
 *   <p>{t('publishedOn', 'Published on', { date: '2024-01-15' })}</p>
 * );
 * ```
 */
export function useTranslation({
    locale = DEFAULT_LOCALE,
    namespace
}: {
    locale?: SupportedLocale;
    namespace: Namespace;
}) {
    const translator = useMemo(() => {
        /**
         * Translation function that retrieves translated text by key.
         * The key is scoped to the namespace provided to useTranslation.
         *
         * @param key - The translation key (without namespace prefix).
         * @param fallback - Optional fallback text if translation is missing.
         * @param params - Optional parameters for string interpolation.
         * @returns The translated string or fallback.
         *
         * @example
         * ```tsx
         * t('search') // 'Buscar'
         * t('missing', 'Fallback text') // 'Fallback text'
         * t('welcome', undefined, { name: 'Juan' }) // 'Bienvenido, Juan'
         * ```
         */
        const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
            return translateFn({
                locale,
                namespace,
                key,
                fallback,
                params
            });
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
         * tPlural('list.totalReviews', 5) // "5 reviews"
         * tPlural('list.totalReviews', 1) // "1 review"
         * ```
         */
        const tPlural = (key: string, count: number, params?: Record<string, unknown>): string => {
            return tPluralFn({
                locale,
                namespace,
                key,
                count,
                params
            });
        };

        return { t, tPlural };
    }, [locale, namespace]);

    return translator;
}
