/**
 * Admin-side adapter for translateApiError from @repo/i18n.
 *
 * The admin's `useTranslations()` `t` function has the signature
 * `(key: TranslationKey, params?) => string` — it does NOT accept a `fallback`
 * parameter. The shared `translateApiError` helper expects
 * `TranslationFn = (key: string, fallback?, params?) => string` and calls
 * `t('common.apiError.X', <fallbackString>)`.
 *
 * If we passed the admin `t` directly:
 *  1. The second argument would be silently interpreted as `params`, not `fallback`.
 *  2. When a key is absent the admin `t` returns `[MISSING: <key>]` instead of the
 *     caller fallback, breaking the priority chain:
 *     reason → code → message → fallback → GENERIC.
 *
 * This module provides `translateAdminApiError`, which wraps the admin `t` in a
 * `TranslationFn`-compatible shim that bridges the signature gap and converts the
 * `[MISSING: <key>]` sentinel back to the appropriate fallback value.
 */

import { type ApiErrorShape, type TranslationFn, translateApiError } from '@repo/i18n';
import type { TranslationKey } from '@repo/i18n';

/**
 * Admin's `useTranslations()` `t` signature.
 * Second parameter is `params`, NOT a fallback string.
 */
type AdminTranslationFn = (key: TranslationKey, params?: Record<string, unknown>) => string;

/**
 * Parameters for `translateAdminApiError`.
 */
export interface TranslateAdminApiErrorInput {
    /** The API error payload, or `null` / `undefined`. */
    readonly error: ApiErrorShape | null | undefined;
    /** The `t` function from `useTranslations()` in an admin component. */
    readonly t: AdminTranslationFn;
    /**
     * Optional pre-localized fallback string used when neither `reason`, `code`,
     * nor `message` yields a usable translation. Pass the existing `t('...')` call
     * that was serving as the fallback before the migration.
     */
    readonly fallback?: string;
}

/**
 * Admin-side adapter around the shared `translateApiError` helper.
 *
 * Bridges the admin `t(key, params?)` signature to the `TranslationFn`
 * `(key, fallback?, params?)` signature expected by `translateApiError`, so
 * that the reason → code → message → fallback → GENERIC priority chain works
 * correctly even when a translation key is absent from the catalog.
 *
 * @example
 * ```tsx
 * import { translateAdminApiError } from '@/lib/errors';
 *
 * catch (error) {
 *   addToast({
 *     message: translateAdminApiError({
 *       error: error as ApiErrorShape,
 *       t,
 *       fallback: t('some.fallback.key'),
 *     }),
 *     variant: 'error',
 *   });
 * }
 * ```
 */
export function translateAdminApiError({
    error,
    t,
    fallback
}: TranslateAdminApiErrorInput): string {
    const wrapped: TranslationFn = (key, fb, p) => {
        // Cast `key` (string) to `TranslationKey` — safe because all
        // `common.apiError.*` keys ARE TranslationKey members (confirmed in
        // packages/i18n/src/types.ts). Unknown codes produce the sentinel.
        const result = t(key as TranslationKey, p);
        // When the key is absent, the admin `t` returns `[MISSING: <key>]`.
        // Substitute the fallback so the priority chain is honoured.
        return result.startsWith('[MISSING:') ? (fb ?? result) : result;
    };
    return translateApiError({ error, t: wrapped, fallback });
}
