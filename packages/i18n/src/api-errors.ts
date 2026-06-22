/**
 * @file api-errors.ts
 * @description Shared helper for surfacing API error responses in the user's
 * locale. Moved from `apps/web/src/lib/api-errors.ts` so any app in the
 * monorepo can import it from `@repo/i18n`.
 *
 * The Hospeda API is server-only (no i18n on the backend) and answers errors
 * with `{ success: false, error: { code, message } }`, where `message` is
 * always English. To show a localized message, the priority chain is:
 *
 *   1. If `error.reason` is present and has a translation under
 *      `common.apiError.<REASON>` in the current locale, use it (more
 *      specific than `code`).
 *   2. Otherwise, if `error.code` is known and has a translation under
 *      `common.apiError.<CODE>`, use it.
 *   3. Otherwise fall back to the API's `message` (the English text).
 *   4. If neither is available, use the provided `fallback` (already
 *      localized by the caller).
 *   5. As a last resort, use the generic `common.apiError.GENERIC`
 *      translation.
 *
 * Translation keys live under the `common` namespace JSON, flattened by
 * `@repo/i18n` into `common.apiError.<CODE_OR_REASON>` dot-notation keys.
 *
 * This function does NOT throw — it always returns a non-empty string.
 */

import { defaultLocale, trans } from './config';
import type { Locale } from './config';

/**
 * Type alias for supported locale values. Exported so web can re-export it
 * for backward compatibility with existing `SupportedLocale` usage.
 */
export type SupportedLocale = Locale;

/**
 * Shape of a Hospeda API error response payload.
 *
 * All fields are optional to allow partial error objects from various call
 * sites (network failures, JSON parse errors, etc.).
 */
export interface ApiErrorShape {
    /** Canonical machine-readable error code (e.g. `'NOT_FOUND'`). */
    readonly code?: string | null;
    /** English error message returned by the API. */
    readonly message?: string | null;
    /**
     * Optional finer-grained reason supplied by some endpoints alongside
     * `code` (e.g. `code: 'SERVICE_UNAVAILABLE'`, `reason: 'NEWSLETTER_NOT_CONFIGURED'`).
     * When present it takes precedence over `code` for the i18n lookup so the
     * UI can show copy specific to the failure mode.
     */
    readonly reason?: string | null;
}

/**
 * Signature of a translation function accepted by `translateApiError`.
 *
 * Compatible with:
 * - Web's `createT(locale)` return value (supports optional `fallback`).
 * - Any function wrapping `@repo/i18n`'s `useTranslations` hook `t`.
 */
export type TranslationFn = (
    key: string,
    fallback?: string,
    params?: Record<string, unknown>
) => string;

/**
 * Looks up a `common.apiError.*` key directly from the `trans` map.
 *
 * This is the non-React path: used when the caller provides a `locale`
 * string instead of a pre-built `t` function.
 *
 * @param locale - The locale to resolve the key for.
 * @param key - Dot-notation key (e.g. `'common.apiError.NOT_FOUND'`).
 * @returns The translated string, or `undefined` if the key is absent.
 */
function lookupTrans(locale: Locale, key: string): string | undefined {
    const localeMap = trans[locale] ?? trans[defaultLocale];
    const value = localeMap?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Resolve an API error to a localized user-facing message.
 *
 * Accepts two translation-context modes:
 * - **React context**: pass `t` from `useTranslations()` or `createT(locale)`.
 * - **Non-React context** (Astro server code, plain TS): pass `locale` and
 *   the function uses `@repo/i18n`'s `trans` map directly.
 *
 * If neither `t` nor `locale` is provided, the function returns the most
 * useful raw value (API `message`, caller `fallback`, or a hardcoded English
 * sentinel).
 *
 * @param params - Parameters object.
 * @param params.error - The API error payload, or `null` / `undefined`.
 * @param params.t - Optional translation function (from `createT` or `useTranslations`).
 * @param params.locale - Optional locale string used when `t` is not available.
 * @param params.fallback - Optional pre-localized fallback string for when the
 *   error carries no code or message.
 * @returns A non-empty, user-displayable string.
 *
 * @example
 * ```ts
 * // Non-React (Astro, plain TS):
 * translateApiError({ error: { code: 'NOT_FOUND' }, locale: 'es' });
 * // → "No encontramos lo que buscabas."
 *
 * // React component:
 * const { t } = useTranslations();
 * translateApiError({ error, t });
 * ```
 */
export function translateApiError(params: {
    readonly error: ApiErrorShape | null | undefined;
    readonly t?: TranslationFn;
    readonly locale?: SupportedLocale;
    readonly fallback?: string;
}): string {
    const { error, fallback } = params;

    // Resolve the translation function: prefer an explicit `t`, then build one
    // from `locale` using the package's own `trans` map.
    // The built-in function uses `[MISSING: key]` as the sentinel for absent keys
    // (when no fallback is supplied) so that the `reason` fall-through check in
    // the priority logic works identically to the web's `createT` behaviour.
    const t: TranslationFn | undefined =
        params.t ??
        (params.locale
            ? (key: string, fb?: string) =>
                  lookupTrans(params.locale as Locale, key) ?? fb ?? `[MISSING: ${key}]`
            : undefined);

    if (!t) {
        // No translation context — return the most useful raw value.
        return error?.message ?? fallback ?? 'Something went wrong. Please try again.';
    }

    const apiMessage = error?.message ?? '';
    const genericFallback =
        fallback ?? t('common.apiError.GENERIC', 'Algo salió mal. Intentá de nuevo en un momento.');

    // Prefer the more specific `reason` over `code` when both are present —
    // e.g. `code: 'SERVICE_UNAVAILABLE'` + `reason: 'NEWSLETTER_NOT_CONFIGURED'`
    // should render the newsletter-specific copy, not the generic 503 one.
    // Detect [MISSING: ...] sentinel (returned in DEV when a key is absent
    // and no fallback is supplied) so we fall through to `code`.
    if (error?.reason) {
        const reasonText = t(`common.apiError.${error.reason}`);
        if (reasonText && !reasonText.startsWith('[MISSING:')) return reasonText;
    }

    if (error?.code) {
        // `t()` returns the translation if present, otherwise the fallback
        // (the API's English message), otherwise the generic localized text.
        return t(`common.apiError.${error.code}`, apiMessage || genericFallback);
    }

    return apiMessage || genericFallback;
}
