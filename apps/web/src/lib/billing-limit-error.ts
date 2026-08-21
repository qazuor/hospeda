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
 * today, and when one exists it LEADS: at the real catalog prices the add-on
 * beats the plan jump on both axes at once. A Básico host ($18.000, 1 listing)
 * who wants a second one pays $31.000 with the add-on and gets 6 listings, or
 * $35.000 on Pro and gets 3; wanting more photos, $23.000 for 35 photos against
 * Pro's $35.000 for 30. Leading with the plan meant offering the worse of the
 * two options first, in every sellable case.
 *
 * The offer is resolved through {@link resolveLimitAddonOffer}, the same
 * composition the publish precheck and the property-quota badge use (HOS-727),
 * so there is ONE limit → add-on resolution in the app rather than one per
 * surface.
 */

import { resolveLimitAddonOffer } from '@/lib/billing/limit-addon-offer';
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
 * Resolved toast payload. The two fields map 1:1 onto `addToast`'s `action` /
 * `secondaryAction`, so a consumer forwards them verbatim and never decides
 * prominence itself.
 *
 * Which CTA occupies which slot depends on whether an add-on raises this limit:
 *
 * | limit has an add-on | `action` (primary) | `secondaryAction` |
 * | --- | --- | --- |
 * | yes (4 of 19) | the add-on | the plan upgrade |
 * | no (15 of 19)  | the plan upgrade | absent |
 *
 * Two invariants hold in both rows, and the tests pin both:
 *
 * 1. **The plan upgrade is always reachable.** It is never dropped — it only
 *    moves slot. A limit toast is never a dead end.
 * 2. **An add-on is offered only when one exists.** For the other 15 limits the
 *    secondary slot stays empty rather than falling back to a bare add-ons-page
 *    link: sending someone to shop for a card that is not on the page is a
 *    false promise, worse than making no offer at all.
 *
 * The no-add-on row is byte-for-byte the pre-HOS-723 payload, so the inversion
 * applies strictly where there is something better to offer.
 */
export interface LimitReachedToastPayload {
    readonly title: string;
    readonly message: string;
    readonly action: LimitReachedToastAction;
    readonly secondaryAction?: LimitReachedToastAction;
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
 * @returns A localized payload ready for `addToast`. `action` is the add-on
 * when one raises this limit and the plan upgrade otherwise;
 * `secondaryAction` carries the demoted plan upgrade in the former case.
 *
 * @example
 * ```ts
 * const payload = buildLimitReachedPayload({ errorBody: body, locale });
 * addToast({
 *   type: 'error',
 *   message: payload.title,
 *   action: payload.action,
 *   secondaryAction: payload.secondaryAction
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
 * @returns A localized payload ready for `addToast`. `action` is the add-on
 * when one raises this limit and the plan upgrade otherwise;
 * `secondaryAction` carries the demoted plan upgrade in the former case.
 *
 * @example
 * ```ts
 * if (!result.ok && result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
 *   const payload = buildLimitReachedPayloadFromDetails({ details: result.error.details, locale });
 *   addToast({
 *     type: 'error',
 *     message: payload.message,
 *     action: payload.action,
 *     secondaryAction: payload.secondaryAction
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

    const planAction: LimitReachedToastAction = {
        label: ctaLabel,
        href: buildUrl({ locale, path: 'mi-cuenta/suscripcion' })
    };

    // Resolved from the RAW key, not the `KNOWN_LIMIT_KEYS`-normalised one
    // above: that allowlist governs whether specific COPY exists, which is a
    // different question from whether an add-on is on sale. Reading it here
    // would make dropping a key from the copy allowlist silently withdraw a
    // purchasable offer.
    //
    // `resolveLimitAddonOffer` returns `null` for the 15 limits nothing is sold
    // for, and that `null` is the load-bearing half — see the payload docs.
    const addonOffer = details?.limitKey
        ? resolveLimitAddonOffer({ locale, limitKey: details.limitKey })
        : null;

    if (addonOffer === null) {
        return { title, message, action: planAction };
    }

    return {
        title,
        message,
        // The add-on takes the primary slot: it is cheaper AND grants more than
        // the plan jump at every real catalog price (see the file header), so
        // leading with the plan would put the worse option first.
        action: {
            // Reuses the plan-usage panel's own label — and the precheck
            // panel's (HOS-727) — so all three surfaces name the same escape
            // hatch identically.
            label: t('account.subscription.usage.buyAddon', 'Ampliar con un complemento'),
            href: addonOffer.href
        },
        // Demoted, never dropped: the plan upgrade stays one step down so a
        // host who genuinely wants the bigger plan can still reach it.
        secondaryAction: planAction
    };
}
