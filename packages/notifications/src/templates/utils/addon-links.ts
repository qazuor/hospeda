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
 * Contract (HOS-729, implemented in parallel — this helper mirrors its
 * shape rather than importing it, since the two specs land concurrently):
 * `/{locale}/mi-cuenta/addons/?focus=<slug>`.
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

    return addonSlug ? `${path}?focus=${encodeURIComponent(addonSlug)}` : path;
}
