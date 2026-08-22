/**
 * Locale-aware link builder for add-on lifecycle email templates (HOS-722).
 *
 * Before this module existed, every add-on template
 * (`templates/addon/*.tsx`) hardcoded its own CTA `href` as
 * `${baseUrl}/es/mi-cuenta/suscripcion` — wrong destination (the
 * subscription page, not the add-ons page) AND a locale baked in regardless
 * of the recipient's actual language. This helper centralizes the correct
 * shape so every add-on template builds the exact same link.
 *
 * @module templates/utils/addon-links
 */

import type { AddonLinkLocale } from '../../types/notification.types.js';

/** Fallback locale used when the recipient's locale is unknown or unsupported. */
export const DEFAULT_ADDON_LINK_LOCALE: AddonLinkLocale = 'es';

/**
 * Input for {@link buildAddonManagementUrl}.
 */
export interface BuildAddonManagementUrlInput {
    /** Site base URL (e.g. `https://hospeda.com.ar`), no trailing slash. */
    readonly baseUrl: string;
    /**
     * Recipient's preferred locale. Falls back to
     * {@link DEFAULT_ADDON_LINK_LOCALE} when omitted or not one of the three
     * supported locales.
     */
    readonly locale?: AddonLinkLocale;
    /**
     * When provided, the link focuses on this specific add-on via the
     * `?focus=` query param. When omitted, the link points at the general
     * add-ons management page.
     */
    readonly addonSlug?: string;
}

/**
 * Narrows an unknown value to a supported {@link AddonLinkLocale}.
 *
 * @param value - Candidate locale value.
 * @returns Whether the value is one of `'es' | 'en' | 'pt'`.
 */
function isAddonLinkLocale(value: unknown): value is AddonLinkLocale {
    return value === 'es' || value === 'en' || value === 'pt';
}

/**
 * Builds the URL to the self-service add-ons management page
 * (`mi-cuenta/addons`), optionally focused on a single add-on.
 *
 * Contract (HOS-729, `apps/web/src/lib/billing/addon-focus.ts` →
 * `buildAddonFocusUrl`): `/{locale}/mi-cuenta/addons/?focus=<slug>#addon-<slug>`.
 * This helper mirrors that shape rather than importing it — `@repo/notifications`
 * cannot depend on `apps/web` — so the two implementations must be kept in step
 * by hand; the exact-shape tests on both sides are what enforce it. They agree
 * character-for-character for every slug the catalog can actually emit
 * (`^[a-z0-9]+(?:-[a-z0-9]+)*$`); this side additionally percent-escapes, so a
 * hypothetical slug outside that alphabet stays a valid URL instead of a broken one.
 *
 * BOTH halves are load-bearing and neither is decorative:
 * - the `?focus=` query param is what reorders and highlights the card;
 * - the `#addon-<slug>` fragment is the pre-existing contract that native
 *   browser scroll uses to land the viewport on that card. Emitting the query
 *   param alone (as this helper originally did) leaves the deep link relying on
 *   the highlighted card happening to sort first, which is a rendering
 *   coincidence, not the contract.
 *
 * The query param is deliberately named `focus`, NOT `addon` — `addon` is
 * already used by the MercadoPago checkout-return banner
 * (`apps/api/src/routes/billing/checkout-return-urls.ts`,
 * `buildAddonSuccessUrl` / `buildAddonCancelUrl`) for a different purpose
 * (post-checkout success/failure banner), and reusing it here would collide.
 *
 * @param input - See {@link BuildAddonManagementUrlInput}.
 * @returns Locale-prefixed URL to the add-ons management page, with a
 *   trailing slash before the query string (required so Astro's `[lang]`
 *   locale middleware does not rewrite the path into a 404 — see
 *   `buildAddonSuccessUrl`'s doc comment for the precedent).
 */
export function buildAddonManagementUrl({
    baseUrl,
    locale,
    addonSlug
}: BuildAddonManagementUrlInput): string {
    const resolvedLocale = isAddonLinkLocale(locale) ? locale : DEFAULT_ADDON_LINK_LOCALE;
    const path = `${baseUrl}/${resolvedLocale}/mi-cuenta/addons/`;

    if (!addonSlug) {
        return path;
    }

    return `${path}?focus=${encodeURIComponent(addonSlug)}#addon-${encodeURIComponent(addonSlug)}`;
}
