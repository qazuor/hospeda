/**
 * @file api-errors.ts
 * @description Web-side wrapper over `@repo/i18n`'s API-error translator.
 *
 * The priority-chain logic (reason → code → status → fallback) lives once in
 * `@repo/i18n` (`translateApiErrorWithT`). This wrapper keeps the familiar
 * `translateApiError({ error, t?, locale?, fallback? })` signature — with the
 * exact same behavior — but resolves the `locale` convenience path through the
 * web app's own CLIENT-SAFE `createT` instead of `@repo/i18n`'s `locale` path,
 * which reads the full `trans` catalog. That keeps the ~1 MB translation
 * dictionary out of the client bundle (HOS-160 lever A): the web client only
 * ever imports `translateApiErrorWithT` (catalog-free) from the package.
 *
 * @see packages/i18n/src/api-errors.ts
 */

import type { ApiErrorShape, TranslationFn } from '@repo/i18n/web';
import { translateApiErrorWithT } from '@repo/i18n/web';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';

export type { ApiErrorShape, TranslationFn };

/**
 * Builds a `t` from a locale that yields the `[MISSING: key]` sentinel for an
 * absent key when no fallback is given. `createT` returns the raw dotted key in
 * that case in PRODUCTION (only DEV emits the sentinel), but
 * `translateApiErrorWithT`'s `reason`/`status` fall-through detects absence via
 * the sentinel — so without this an unmapped `error.reason` would surface the
 * raw `common.apiError.<REASON>` key to the user in prod instead of falling
 * through to `code`/`message`/`fallback` (HOS-160 review fix).
 */
function buildLocaleT(locale: SupportedLocale): TranslationFn {
    const t = createT(locale);
    return (key, fallback, params) => {
        const result = t(key, fallback, params);
        return fallback === undefined && result === key ? `[MISSING: ${key}]` : result;
    };
}

/**
 * Resolve an API error to a localized user-facing message. Accepts either a
 * ready `t` function or a `locale` (from which a client-safe `t` is built).
 * Never throws — always returns a non-empty string.
 *
 * @param params.error - The API error payload, or `null` / `undefined`.
 * @param params.t - Optional translation function (from `createT` / `useTranslations`).
 * @param params.locale - Optional locale, used to build a `t` when none is given.
 * @param params.fallback - Optional pre-localized fallback string.
 * @returns A non-empty, user-displayable string.
 */
export function translateApiError(params: {
    readonly error: ApiErrorShape | null | undefined;
    readonly t?: TranslationFn;
    readonly locale?: SupportedLocale;
    readonly fallback?: string;
}): string {
    const { error, t, locale, fallback } = params;
    const resolvedT: TranslationFn | undefined = t ?? (locale ? buildLocaleT(locale) : undefined);

    if (!resolvedT) {
        // No translation context — return the most useful raw value.
        return error?.message ?? fallback ?? 'Something went wrong. Please try again.';
    }

    return translateApiErrorWithT({ error, t: resolvedT, fallback });
}

/**
 * Decide whether an API error is worth a "Retry" affordance.
 *
 * A retry only helps for TRANSIENT failures — the same request may succeed
 * moments later: network/offline (no status), client-side timeout (408),
 * rate-limit (429), or any server-side error (>= 500). Every other 4xx
 * (400/403/404/409/422) is a NON-transitory business/state rejection: the
 * request is deterministically doomed until the caller changes something, so
 * offering "Retry" invites the user to repeat a click that will always fail
 * (BETA-194 / BETA-195). Those must surface the specific message WITHOUT a
 * retry button.
 *
 * @param error - The API error, or `null`/`undefined` when the failure has no
 *   structured shape (treated as transient — retry is the safe default).
 * @returns `true` when a retry affordance is appropriate.
 */
export function isRetryableApiError(
    error: { readonly status?: number } | null | undefined
): boolean {
    const status = error?.status;
    if (status == null) return true;
    return status === 0 || status === 408 || status === 429 || status >= 500;
}
