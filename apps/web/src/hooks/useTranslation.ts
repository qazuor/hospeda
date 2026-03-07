/**
 * React hook for translations in web app React islands.
 * Provides memoized translation functions scoped to a locale and namespace,
 * wrapping the `createTranslations` utility from `src/lib/i18n.ts`.
 *
 * Use this hook in any React component hydrated with a `client:*` directive.
 * For Astro components, use `createTranslations` or `createT` directly from `src/lib/i18n.ts`.
 */

import type { Namespace } from '@repo/i18n';
import { useMemo } from 'react';
import {
    DEFAULT_LOCALE,
    type PluralTranslationFn,
    type SupportedLocale,
    type TranslationFn,
    createTranslations
} from '../lib/i18n';

/**
 * Return type for the `useTranslation` hook.
 */
export interface UseTranslationResult {
    /**
     * Translation function scoped to the hook's namespace.
     * Accepts a short key (without namespace prefix), an optional fallback,
     * and optional interpolation parameters.
     *
     * @example
     * ```tsx
     * t('search')                                // 'Buscar'
     * t('missing', 'Default text')               // 'Default text'
     * t('greeting', 'Hola {{name}}', { name: 'Juan' }) // 'Hola Juan'
     * ```
     */
    readonly t: TranslationFn;

    /**
     * Plural-aware translation function scoped to the hook's namespace.
     * Resolves `_one` / `_other` CLDR key variants based on the count value.
     *
     * @example
     * ```tsx
     * tPlural('review.count', 1)  // '1 resena'
     * tPlural('review.count', 5)  // '5 resenas'
     * ```
     */
    readonly tPlural: PluralTranslationFn;
}

/**
 * React hook that provides memoized translation functions for React island components.
 *
 * The `t` function returned by this hook accepts short keys (without namespace prefix),
 * e.g. `t('search')` instead of `t('common.search')`. The namespace is prepended
 * automatically using the value passed to the hook.
 *
 * The `tPlural` function works the same way but resolves `_one` / `_other` key
 * variants based on a count argument.
 *
 * Both functions are re-created only when `locale` or `namespace` change, making
 * them safe to use as `useMemo` / `useCallback` dependencies.
 *
 * @param params - Configuration object.
 * @param params.locale - The locale to use for translations. Defaults to `'es'`.
 * @param params.namespace - The i18n namespace to scope all translation keys.
 * @returns An object with `t` and `tPlural` translation functions.
 *
 * @example
 * ```tsx
 * import { useTranslation } from '@/hooks/useTranslation';
 * import type { SupportedLocale } from '@/lib/i18n';
 *
 * interface SearchBarProps {
 *   locale: SupportedLocale;
 * }
 *
 * export function SearchBar({ locale }: SearchBarProps) {
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
 * // With pluralization:
 * const { tPlural } = useTranslation({ locale: 'es', namespace: 'review' });
 *
 * return <p>{tPlural('count', reviews.length)}</p>;
 * // => '1 resena' or '5 resenas'
 * ```
 */
export function useTranslation({
    locale = DEFAULT_LOCALE,
    namespace
}: {
    locale?: SupportedLocale;
    namespace: Namespace;
}): UseTranslationResult {
    return useMemo<UseTranslationResult>(() => {
        const { t: baseT, tPlural: baseTPlural } = createTranslations(locale);

        /**
         * Namespaced translation function.
         * Prepends `namespace.` to `key` before delegating to the locale-bound `t`.
         */
        const t: TranslationFn = (
            key: string,
            fallback?: string,
            params?: Record<string, unknown>
        ): string => {
            return baseT(`${namespace}.${key}`, fallback, params);
        };

        /**
         * Namespaced plural translation function.
         * Prepends `namespace.` to `key` before delegating to the locale-bound `tPlural`.
         */
        const tPlural: PluralTranslationFn = (
            key: string,
            count: number,
            params?: Record<string, unknown>
        ): string => {
            return baseTPlural(`${namespace}.${key}`, count, params);
        };

        return { t, tPlural };
    }, [locale, namespace]);
}
