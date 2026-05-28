/**
 * @file billing-limit-error.ts
 * @description Helper for translating LIMIT_REACHED 403 error bodies into
 * localized toast payloads with an upgrade CTA.
 *
 * The backend carries `error.details = { limitKey, currentCount, maxAllowed,
 * usagePercent, upgradeAudience: 'tourist' | 'host' }` on every LIMIT_REACHED
 * 403. This module maps that payload to an i18n-keyed title/message/action
 * triple that toast consumers can render directly.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Shape of `error.details` on a LIMIT_REACHED 403 response. */
export interface LimitReachedDetails {
    readonly limitKey: string;
    readonly currentCount: number;
    readonly maxAllowed: number;
    readonly usagePercent: number;
    readonly upgradeAudience: 'tourist' | 'host';
}

/**
 * Parsed 403 error body returned by the API on LIMIT_REACHED.
 * Matches the `details` field from `ApiError` in the web API client.
 */
export interface LimitReachedErrorBody {
    readonly error?: {
        readonly code?: string;
        readonly details?: LimitReachedDetails;
    };
}

/** Resolved toast payload. `action` is always present (upgrade CTA). */
export interface LimitReachedToastPayload {
    readonly title: string;
    readonly message: string;
    readonly action: {
        readonly label: string;
        readonly href: string;
    };
}

/**
 * Known limit keys that have dedicated i18n entries.
 * Any other key falls back to `billing.limit.generic.*`.
 */
const KNOWN_LIMIT_KEYS = new Set([
    'max_favorites',
    'max_accommodations',
    'max_photos_per_accommodation',
    'max_active_promotions',
    'max_properties',
    'max_staff_accounts'
]);

/**
 * Build a localized toast payload from a LIMIT_REACHED 403 error body.
 *
 * @param params.errorBody - Parsed JSON body from a 403 LIMIT_REACHED response.
 * @param params.locale - Active UI locale for building URLs and translating strings.
 * @returns A localized `{ title, message, action }` payload ready for `addToast`.
 *
 * @example
 * ```ts
 * const payload = buildLimitReachedPayload({ errorBody: body, locale });
 * addToast({ type: 'error', message: payload.title, action: payload.action });
 * ```
 */
export function buildLimitReachedPayload({
    errorBody,
    locale
}: {
    readonly errorBody: LimitReachedErrorBody;
    readonly locale: SupportedLocale;
}): LimitReachedToastPayload {
    const t = createT(locale);
    const details = errorBody?.error?.details;

    return buildFromDetails({ details, locale, t });
}

/**
 * Build a localized toast payload from the `details` field of an `ApiError`
 * (the `unknown`-typed field returned by the API client on a 403 LIMIT_REACHED).
 *
 * Use this overload in components that hold an `ApiError` (e.g. from `ApiResult`),
 * as `ApiError.details` is typed `unknown` to avoid leaking API internals.
 *
 * @param params.details - The `details` field from `ApiError` (cast-safe, guarded internally).
 * @param params.locale - Active UI locale.
 * @returns A localized `{ title, message, action }` payload ready for `addToast`.
 *
 * @example
 * ```ts
 * if (!result.ok && result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
 *   const payload = buildLimitReachedPayloadFromDetails({ details: result.error.details, locale });
 *   addToast({ type: 'error', message: payload.message, action: payload.action });
 * }
 * ```
 */
export function buildLimitReachedPayloadFromDetails({
    details: rawDetails,
    locale
}: {
    readonly details: unknown;
    readonly locale: SupportedLocale;
}): LimitReachedToastPayload {
    const t = createT(locale);
    // Guard: cast to the expected shape only if the object has the limitKey field.
    const details =
        rawDetails !== null &&
        typeof rawDetails === 'object' &&
        'limitKey' in rawDetails &&
        typeof (rawDetails as Record<string, unknown>).limitKey === 'string'
            ? (rawDetails as LimitReachedDetails)
            : undefined;

    return buildFromDetails({ details, locale, t });
}

/** Internal shared builder. */
function buildFromDetails({
    details,
    locale,
    t
}: {
    readonly details: LimitReachedDetails | undefined;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createT>;
}): LimitReachedToastPayload {
    const limitKey =
        details?.limitKey && KNOWN_LIMIT_KEYS.has(details.limitKey) ? details.limitKey : 'generic';

    const currentCount = details?.currentCount ?? 0;
    const maxAllowed = details?.maxAllowed ?? 0;

    // Use a direct fallback string. The i18n system will resolve the specific
    // key first (e.g. billing.limit.max_favorites.title), falling back to the
    // provided string only when the key is missing. Avoid nesting t() as fallback
    // because the test mock for createT returns the fallback directly, which would
    // always resolve to the generic fallback instead of the specific key.
    const genericTitle = 'Límite del plan alcanzado';
    const genericMessage = 'Alcanzaste el límite de tu plan. Actualizalo para continuar.';
    const genericCta = 'Ver mi suscripción';

    const title = t(`billing.limit.${limitKey}.title`, genericTitle);
    const message = t(`billing.limit.${limitKey}.message`, genericMessage, {
        currentCount,
        maxAllowed
    });
    const ctaLabel = t(`billing.limit.${limitKey}.cta`, genericCta);

    const upgradeHref = buildUrl({ locale, path: 'mi-cuenta/suscripcion' });

    return {
        title,
        message,
        action: {
            label: ctaLabel,
            href: upgradeHref
        }
    };
}
