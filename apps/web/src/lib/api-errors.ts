/**
 * @file api-errors.ts
 * @description Helpers for surfacing API error responses to the UI in the
 * user's locale.
 *
 * The Hospeda API is server-only (no i18n on the backend) and answers errors
 * with `{ success: false, error: { code, message } }`, where `message` is
 * always English. To show a localized message in the web UI, the rule is:
 *
 *   1. If `error.code` is known and has a translation under `apiError.<code>`
 *      in the current locale, use it.
 *   2. Otherwise fall back to the API's `message` (the English text). It is
 *      at least informative for the user and any logs we capture.
 *   3. If neither is available, use the provided `fallback` (already
 *      localized by the caller).
 *   4. As a last resort, use the generic `apiError.GENERIC` translation.
 *
 * Keep this small and dependency-free so it can be used from any client
 * component or store. It does NOT throw — it always returns a non-empty
 * string.
 */

import type { SupportedLocale } from './i18n';
import { createT } from './i18n';

/** Shape of a Hospeda API error response payload. */
export interface ApiErrorShape {
    readonly code?: string | null;
    readonly message?: string | null;
}

/** Signature of a translation function created by `createT(locale)`. */
type TranslationFn = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/**
 * Resolve an API error to a localized user-facing message.
 *
 * @param params - Object with `error`, either a `t` function or a `locale`,
 *   and an optional `fallback` for when neither code nor message is usable.
 * @returns A non-empty string suitable for direct display to the user.
 */
export function translateApiError(params: {
    readonly error: ApiErrorShape | null | undefined;
    readonly t?: TranslationFn;
    readonly locale?: SupportedLocale;
    readonly fallback?: string;
}): string {
    const { error, fallback } = params;
    const t = params.t ?? (params.locale ? createT(params.locale) : undefined);

    if (!t) {
        // No translation context — return the most useful raw value.
        return error?.message ?? fallback ?? 'Something went wrong. Please try again.';
    }

    const apiMessage = error?.message ?? '';
    const genericFallback =
        fallback ?? t('apiError.GENERIC', 'Algo salió mal. Intentá de nuevo en un momento.');

    if (error?.code) {
        // `t()` returns the translation if present, otherwise the fallback
        // (the API's English message), otherwise the generic localized text.
        return t(`apiError.${error.code}`, apiMessage || genericFallback);
    }

    return apiMessage || genericFallback;
}
