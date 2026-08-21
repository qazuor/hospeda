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
 * HOS-723 — a cap has up to TWO ways out, and this helper used to know only
 * one. Four of the nineteen limits are raised by an add-on that is on sale
 * today; for those, "upgrade your plan" is not the cheapest answer and often
 * not the answer at all. The add-on offer is resolved here, from the same
 * table the plan-usage panel uses, so both surfaces make the same offer.
 */

import { buildAddonFocusUrl } from '@/lib/billing/addon-focus';
import { addonSlugForLimit } from '@/lib/billing/plan-usage-config';
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
 * Resolved toast payload.
 *
 * `action` (the plan upgrade) is ALWAYS present — every limit is raised by a
 * bigger plan, so there is always at least one way out.
 *
 * `addonAction` is present only for the limits an add-on actually raises
 * (today 4 of 19 — see `addonSlugForLimit`). It is deliberately absent, not a
 * generic link to the add-ons page, for the other 15: sending someone to shop
 * for an add-on that does not exist is a false promise, and worse than making
 * no offer at all.
 *
 * Consumers pass it as the toast's `secondaryAction`, which `ToastViewport`
 * renders BEFORE the primary one — so the cheap, immediate fix reads first and
 * the plan upgrade stays the prominent CTA, matching the order the plan-usage
 * panel already uses.
 */
export interface LimitReachedToastPayload {
    readonly title: string;
    readonly message: string;
    readonly action: LimitReachedToastAction;
    readonly addonAction?: LimitReachedToastAction;
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
    'max_ai_search_per_month',
    'max_ai_support_per_month',
    'max_ai_translate_per_month',
    'max_ai_accommodation_import_per_month',
    'max_search_history_entries',
    'max_collections'
]);

/**
 * Build a localized toast payload from a LIMIT_REACHED 403 error body.
 *
 * @param params.errorBody - Parsed JSON body from a 403 LIMIT_REACHED response.
 * @param params.locale - Active UI locale for building URLs and translating strings.
 * @returns A localized payload ready for `addToast` — `action` is the plan
 * upgrade, `addonAction` the add-on offer when one raises this limit.
 *
 * @example
 * ```ts
 * const payload = buildLimitReachedPayload({ errorBody: body, locale });
 * addToast({
 *   type: 'error',
 *   message: payload.title,
 *   action: payload.action,
 *   secondaryAction: payload.addonAction
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
 * @returns A localized payload ready for `addToast` — `action` is the plan
 * upgrade, `addonAction` the add-on offer when one raises this limit.
 *
 * @example
 * ```ts
 * if (!result.ok && result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
 *   const payload = buildLimitReachedPayloadFromDetails({ details: result.error.details, locale });
 *   addToast({
 *     type: 'error',
 *     message: payload.message,
 *     action: payload.action,
 *     secondaryAction: payload.addonAction
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
    const message = t(`billing.limit.${limitKey}.message`, genericMessage, {
        currentCount,
        maxAllowed
    });
    const ctaLabel = t(`billing.limit.${limitKey}.cta`, genericCta);

    const upgradeHref = buildUrl({ locale, path: 'mi-cuenta/suscripcion' });

    // Resolved from the RAW key, not the `KNOWN_LIMIT_KEYS`-normalised one
    // above: that allowlist governs whether specific COPY exists, which is a
    // different question from whether an add-on is on sale. Reading it here
    // would make dropping a key from the copy allowlist silently withdraw a
    // purchasable offer.
    const addonSlug = details?.limitKey ? addonSlugForLimit(details.limitKey) : undefined;

    const addonAction: LimitReachedToastAction | undefined = addonSlug
        ? {
              // Reuses the plan-usage panel's own label so the two surfaces
              // name the same escape hatch identically.
              label: t('account.subscription.usage.buyAddon', 'Ampliar con un complemento'),
              // HOS-729's builder, never a hand-built URL: it carries both the
              // `?focus=<slug>` param (which reorders and highlights the card)
              // and the `#addon-<slug>` fragment (native scroll), so the user
              // lands on the add-on that solves THIS limit rather than on a
              // catalog they have to search.
              href: buildAddonFocusUrl({ locale, slug: addonSlug })
          }
        : undefined;

    return {
        title,
        message,
        action: {
            label: ctaLabel,
            href: upgradeHref
        },
        ...(addonAction ? { addonAction } : {})
    };
}
