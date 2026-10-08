/**
 * @file billing-limit-error.ts
 * @description Helper for translating LIMIT_REACHED 403 error bodies into
 * localized toast payloads with an upgrade CTA.
 *
 * The backend carries `error.details = { limitKey, currentCount, maxAllowed,
 * usagePercent, upgradeAudience: 'tourist' | 'host' }` on every LIMIT_REACHED
 * 403. This module maps that payload to an i18n-keyed title/message/action
 * triple that toast consumers can render directly.
 *
 * HOS-723 added a second way out — an add-on offer that led the toast when
 * one was on sale for the limit hit. That offer pointed at the old add-on
 * purchase page and was removed with it (HOS-1637, AC:B13a:20), so the toast
 * carries the plan action only.
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

/** One call to action on a limit toast. Mirrors `ToastAction`'s link shape. */
export interface LimitReachedToastAction {
    readonly label: string;
    readonly href: string;
}

/**
 * Resolved toast payload. `action` maps 1:1 onto `addToast`'s `action`: the
 * plan upgrade, so a limit toast is never a dead end.
 */
export interface LimitReachedToastPayload {
    readonly title: string;
    readonly message: string;
    readonly action: LimitReachedToastAction;
}

/**
 * Known limit keys that have dedicated i18n entries.
 * Any other key falls back to `billing.limit.generic.*`.
 *
 * Exported (HOS-690 AC-23) so the exhaustiveness guard
 * (`test/lib/billing-limit-key-i18n-coverage.guard.test.ts`) can assert every
 * `LimitKey` is a member, instead of re-deriving the set from source text.
 */
export const KNOWN_LIMIT_KEYS = new Set([
    'max_favorites',
    'max_accommodations',
    'max_photos_per_accommodation',
    'max_active_promotions',
    'max_properties',
    'max_staff_accounts',
    // HOS-688 — each has a `billing.limit.<key>.*` block in all three locales.
    // Without the entry the at-limit toast falls back to
    // `billing.limit.generic.*`, which never names the vertical just hit.
    'max_gastronomies',
    'max_experiences',
    // HOS-690 AC-23 — closing the gap the exhaustiveness guard found: these 11
    // keys had NO `billing.limit.<key>.*` entry at all in any locale and were
    // silently absent from this Set. None currently reaches this helper (no
    // call site in `apps/web/src` passes one of these limitKeys to
    // `buildLimitReachedPayload*` today — only max_accommodations and
    // max_favorites do), so this closes a latent gap rather than changing live
    // behaviour. Each locale only got a `.title` entry, deliberately NOT the
    // full `message_one`/`message_other`/`cta` shape `max_favorites` etc.
    // have — `buildFromDetails` falls back to its own generic string per field
    // independently, so a title-only entry is a safe, honest partial: whoever
    // wires one of these limits into an at-limit UI still owes it a message
    // and a CTA.
    'max_active_alerts',
    'max_compare_items',
    'max_ai_text_improve_per_month',
    'max_ai_chat_per_month',
    'max_ai_chat_consumer_per_month',
    // HOS-400 — each gastronomy/experience verticals's own AI-chat cap. Title-only entry,
    // same shape as the pair above (see the comment a few lines up).
    'max_ai_chat_gastronomy_per_month',
    'max_ai_chat_experience_per_month',
    'max_ai_search_per_month',
    'max_ai_support_per_month',
    'max_ai_translate_per_month',
    'max_ai_accommodation_import_per_month',
    'max_search_history_entries',
    'max_collections',
    // HOS-1060 — the private-gallery cap. Title-only entry, the same honest
    // partial the two comments above describe: nothing in `apps/web/src` passes
    // this limitKey to `buildLimitReachedPayload*` yet, because the creation
    // route it would come from is a later phase. Whoever wires that route still
    // owes this key a message and a CTA; what the entry buys today is that the
    // toast names the gallery cap instead of falling back to
    // `billing.limit.generic.*`, which never says which limit was hit.
    'max_active_private_galleries'
]);

/**
 * Build a localized toast payload from a LIMIT_REACHED 403 error body.
 *
 * @param params.errorBody - Parsed JSON body from a 403 LIMIT_REACHED response.
 * @param params.locale - Active UI locale for building URLs and translating strings.
 * @returns A localized payload ready for `addToast`; `action` is the plan upgrade.
 *
 * @example
 * ```ts
 * const payload = buildLimitReachedPayload({ errorBody: body, locale });
 * addToast({
 *   type: 'error',
 *   message: payload.title,
 *   action: payload.action
 * });
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
 * @returns A localized payload ready for `addToast`; `action` is the plan upgrade.
 *
 * @example
 * ```ts
 * if (!result.ok && result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
 *   const payload = buildLimitReachedPayloadFromDetails({ details: result.error.details, locale });
 *   addToast({
 *     type: 'error',
 *     message: payload.message,
 *     action: payload.action
 *   });
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

    // HOS-754 — 8 of the 19 known limits carry `message_one`/`message_other`
    // (CLDR plural forms), never a flat `.message`: the noun in the sentence
    // is pluralized on `maxAllowed` (e.g. "1 favorito" vs "3 favoritos"), not
    // on `currentCount`. The other 11 known limits (plus `generic`) have no
    // message entry at all — that gap is deliberate (HOS-690 AC-23, see the
    // KNOWN_LIMIT_KEYS comment above). Resolving a flat `.message` key, as
    // this used to do, therefore NEVER matched for any of the 19 limits, and
    // the toast always rendered `genericMessage` regardless of which limit
    // was actually hit.
    //
    // This deliberately does NOT use `tPlural` (from `createTranslations`):
    // its missing-key fallback detection (`pluralize()` in @repo/i18n) checks
    // for the `[MISSING: ...]` marker that `resolve()` only emits in
    // `import.meta.env.DEV` — in a production build a missing plural key
    // resolves to the bare key string instead, so `pluralize()` would render
    // the literal `billing.limit.<key>.message_one` for the 11 limits with no
    // message entry, instead of falling back. Resolving the CLDR-suffixed key
    // ourselves through `t()` reuses the same real-fallback mechanism already
    // used for `title`/`cta` above, which is safe in both dev and production.
    const pluralSuffix = maxAllowed === 1 ? '_one' : '_other';
    const message = t(`billing.limit.${limitKey}.message${pluralSuffix}`, genericMessage, {
        currentCount,
        maxAllowed
    });
    const ctaLabel = t(`billing.limit.${limitKey}.cta`, genericCta);

    const planAction: LimitReachedToastAction = {
        label: ctaLabel,
        href: buildUrl({ locale, path: 'mi-cuenta/suscripcion' })
    };

    return { title, message, action: planAction };
}
