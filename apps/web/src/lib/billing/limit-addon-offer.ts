/**
 * @file limit-addon-offer.ts
 * @description Resolves "the cheap way out of this cap" for ONE limit: the
 * add-ons-page URL focused on the add-on that raises it — or `null` when the
 * limit has no purchasable add-on at all (HOS-727).
 *
 * ## Why this exists as a module instead of two inline lines
 *
 * Only 4 of the 19 limits have something to sell (`ADDON_SLUG_BY_LIMIT_KEY` in
 * {@link ./plan-usage-config}). Linking to the add-ons page from the other 15 is
 * a FALSE PROMISE: the user is sent to look for a card that is not there and
 * never will be. So the offer must always be resolved FROM THE LIMIT, never
 * hardcoded per surface — the moment a surface hardcodes `mi-cuenta/addons`, it
 * has silently opted out of that rule and will keep pointing at nothing if the
 * add-on is ever withdrawn.
 *
 * Two surfaces now need exactly this composition (the publish precheck and the
 * property-quota badge), and a third does it inline
 * (`PlanUsageSection.client.tsx`). Composing it once here is what stops the
 * repo's recurring "canonical helper created, call sites not migrated" drift
 * from starting a fourth time.
 *
 * This module deliberately owns NO knowledge of its own: the limit → slug table
 * lives in `plan-usage-config`, the URL shape lives in `addon-focus`. It only
 * joins them.
 *
 * @see ./plan-usage-config for which limits are sellable.
 * @see ./addon-focus for the focus-URL contract (HOS-729).
 */

import { buildAddonFocusUrl } from '@/lib/billing/addon-focus';
import { addonSlugForLimit } from '@/lib/billing/plan-usage-config';
import type { SupportedLocale } from '@/lib/i18n';

/**
 * The purchasable way to raise one limit.
 */
export interface LimitAddonOffer {
    /** Slug of the add-on that raises the limit (e.g. `extra-accommodations-5`). */
    readonly slug: string;
    /**
     * Add-ons page URL with that add-on in focus — carries both `?focus=<slug>`
     * and the `#addon-<slug>` fragment, so the buyer lands on the right card
     * highlighted at the top rather than hunting through the catalog.
     */
    readonly href: string;
}

/**
 * Returns the add-on offer that raises a limit, or `null` when there is none.
 *
 * `null` is the load-bearing half of this function: it is what keeps a
 * "buy an add-on" link OUT of the 15 limits that have nothing to sell. Callers
 * must render their add-on CTA only when this returns non-`null`, and must
 * never fall back to a bare add-ons-page link when it returns `null`.
 *
 * @param params.locale - Active locale, for the URL's locale segment.
 * @param params.limitKey - The limit key (e.g. `max_accommodations`).
 * @returns The offer, or `null` when no purchasable add-on raises this limit.
 *
 * @example
 * ```ts
 * const offer = resolveLimitAddonOffer({ locale: 'es', limitKey: 'max_accommodations' });
 * // → { slug: 'extra-accommodations-5', href: '/es/mi-cuenta/addons/?focus=…' }
 *
 * resolveLimitAddonOffer({ locale: 'es', limitKey: 'max_favorites' });
 * // → null (nothing is sold for this cap; offering one would be a false promise)
 * ```
 */
export function resolveLimitAddonOffer({
    locale,
    limitKey
}: {
    readonly locale: SupportedLocale;
    readonly limitKey: string;
}): LimitAddonOffer | null {
    const slug = addonSlugForLimit(limitKey);

    if (slug === undefined) {
        return null;
    }

    return { slug, href: buildAddonFocusUrl({ locale, slug }) };
}
