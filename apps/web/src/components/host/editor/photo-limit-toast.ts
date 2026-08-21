/**
 * @file photo-limit-toast.ts
 * @description Turns the API's `403 LIMIT_REACHED` on a photo upload into the
 * toast the host actually needs (HOS-724).
 *
 * ## Why this module exists
 *
 * Before HOS-724 the photo editor had NO `LIMIT_REACHED` branch at all: both
 * upload paths in `use-photo-section.ts` funnelled every `addMedia` failure
 * through the same generic reporter, which rendered `error.message` verbatim.
 * For this error that message is the API's own hardcoded Spanish sentence
 * (`apps/api/src/utils/limit-check.ts`) — untranslated in en/pt, and carrying
 * no link whatsoever. The host was stopped mid-upload and told to "actualiza tu
 * plan" with nothing to click, while `error.details.limitKey` sat unread on the
 * very same object.
 *
 * `max_photos_per_accommodation` is one of only 4 limits with something to
 * sell, and its add-on (`extra-photos-20`) is the cheapest in the catalog — so
 * this is the single most natural upsell moment in the product.
 *
 * ## Prominence rule (owner decision, already unified elsewhere)
 *
 * When the limit has a purchasable add-on, **the add-on leads**: it is the
 * action that unblocks the upload the host came here to finish, immediately and
 * cheaply. The plan upgrade stays offered, demoted to the secondary slot. When
 * there is no add-on the plan CTA is primary and alone — never a bare add-ons
 * link, which would be a false promise. Same rule as
 * `@/lib/host/publish-precheck-panel-content` and the plan-usage panel.
 *
 * ## What this module deliberately does NOT own
 *
 * - WHICH add-on raises this cap, and its URL — `resolveLimitAddonOffer` is the
 *   only place that decides that. Composing `?focus=` by hand here would start
 *   the repo's recurring duplicate-helper drift over again.
 * - The plan-upgrade CTA's label and href — `buildLimitReachedPayloadFromDetails`
 *   is the canonical "you hit a limit" resolver, and it is what every other
 *   at-limit toast in the app already uses.
 *
 * The one thing resolved locally is the message body, and only because the
 * shared helper cannot reach it: its `t()` is not plural-aware, so
 * `billing.limit.<key>.message` (a key that exists for NO limit — every limit
 * ships `message_one`/`message_other` instead) always misses and falls back to
 * a generic sentence. `tPlural` reads the real per-limit copy that is already
 * translated in all three locales.
 */

import { LimitKey } from '@repo/billing';
import type { ApiError } from '@/lib/api/types';
import { resolveLimitAddonOffer } from '@/lib/billing/limit-addon-offer';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ToastAction } from '@/store/toast-store';

/**
 * A toast describing the photo cap, with its way(s) out.
 *
 * `action` is the prominent slot and `secondaryAction` the quiet one — see
 * `ToastViewport.client.tsx`, which renders them with `actionPrimary` /
 * `actionSecondary` respectively.
 */
export interface PhotoLimitToastPayload {
    /** Localized, photo-specific "you're at N of M photos" line. */
    readonly message: string;
    /** Prominent CTA: the add-on when one exists, the plan upgrade otherwise. */
    readonly action: ToastAction;
    /** Quiet CTA: the plan upgrade, present only when the add-on took the lead. */
    readonly secondaryAction?: ToastAction;
}

/**
 * Whether an `addMedia` failure is the plan photo cap rather than any other
 * upload error.
 *
 * Both halves are load-bearing: `LIMIT_REACHED` is the code, and `403` is the
 * status the API contract pairs it with. Matching on the code alone would let a
 * future non-403 reuse of the code render an upsell in the wrong place.
 *
 * @param params.error - The `ApiError` from a failed `ApiResult`.
 * @returns `true` when the upload was refused because the plan cap is full.
 *
 * @example
 * ```ts
 * if (!addResult.ok && isLimitReachedError({ error: addResult.error })) {
 *   const toast = buildPhotoLimitToast({ details: addResult.error.details, locale });
 * }
 * ```
 */
export function isLimitReachedError({ error }: { readonly error: ApiError }): boolean {
    return error.status === 403 && error.code === 'LIMIT_REACHED';
}

/**
 * Narrow the `unknown` `details` payload to the two counts this copy needs.
 *
 * Returns `null` rather than zeros when either count is missing, so the caller
 * can fall back to the (still photo-specific) title instead of rendering a
 * confident but wrong "0 de 0".
 */
function readCounts(
    rawDetails: unknown
): { readonly currentCount: number; readonly maxAllowed: number } | null {
    if (rawDetails === null || typeof rawDetails !== 'object') {
        return null;
    }

    const { currentCount, maxAllowed } = rawDetails as Record<string, unknown>;

    if (typeof currentCount !== 'number' || typeof maxAllowed !== 'number') {
        return null;
    }

    return { currentCount, maxAllowed };
}

/**
 * Build the at-cap toast for a refused photo upload.
 *
 * @param params.details - `error.details` from the 403 (`unknown`, guarded internally).
 * @param params.locale - Active UI locale.
 * @returns Message plus one or two CTAs, ordered by the prominence rule above.
 *
 * @example
 * ```ts
 * const toast = buildPhotoLimitToast({ details: error.details, locale: 'es' });
 * addToast({ type: 'error', message: toast.message, action: toast.action,
 *            secondaryAction: toast.secondaryAction });
 * ```
 */
export function buildPhotoLimitToast({
    details,
    locale
}: {
    readonly details: unknown;
    readonly locale: SupportedLocale;
}): PhotoLimitToastPayload {
    const { t, tPlural } = createTranslations(locale);
    const limitPayload = buildLimitReachedPayloadFromDetails({ details, locale });
    const counts = readCounts(details);

    // Plural basis is `maxAllowed`: the noun follows the cap in the "X de Y
    // fotos" construction, the same basis `publish-precheck-panel-content`
    // documents for its own "X de Y propiedades" body.
    const message =
        counts === null
            ? limitPayload.title
            : tPlural(
                  `billing.limit.${LimitKey.MAX_PHOTOS_PER_ACCOMMODATION}.message`,
                  counts.maxAllowed,
                  { currentCount: counts.currentCount, maxAllowed: counts.maxAllowed }
              );

    const planAction: ToastAction = {
        label: limitPayload.action.label,
        href: limitPayload.action.href
    };

    const addonOffer = resolveLimitAddonOffer({
        locale,
        limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
    });

    if (addonOffer === null) {
        // No add-on raises this cap (it does today, but the table is the
        // authority, not this file). The plan upgrade is then primary AND the
        // only CTA — never a bare add-ons link to a card that is not there.
        return { message, action: planAction };
    }

    return {
        message,
        action: {
            label: t('account.subscription.usage.buyAddon', 'Ampliar con un complemento'),
            href: addonOffer.href
        },
        secondaryAction: planAction
    };
}
