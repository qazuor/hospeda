/**
 * Shared MercadoPago return/notification URL builders for the paid-checkout
 * contract (HOS-114 T-005/T-006).
 *
 * Extracted from `start-paid.ts` so both the first-subscription checkout
 * route (`/start-paid`) and the paid-reactivation routes
 * (`/billing/trial/reactivate`, `/billing/trial/reactivate-subscription`)
 * build the exact same `back_url` / webhook-destination URLs — one source of
 * truth for the locale-aware return path and the notification endpoint, so
 * the two entry points can never drift on where MercadoPago redirects the
 * user or where it posts webhooks.
 *
 * @module routes/billing/checkout-return-urls
 */

import type { Context } from 'hono';
import { env } from '../../utils/env.js';

/**
 * Supported locale values for the user-facing return URLs.
 *
 * Must stay in sync with `apps/web/src/lib/i18n.ts` SUPPORTED_LOCALES.
 * The checkout pages (`[lang]/suscriptores/checkout/{success,failure,pending}`)
 * exist for all three locales via Astro's `[lang]` routing.
 */
export const SUPPORTED_RETURN_URL_LOCALES = ['es', 'en', 'pt'] as const;
export type ReturnUrlLocale = (typeof SUPPORTED_RETURN_URL_LOCALES)[number];

/** Fallback locale when the user has no preference or the preference is unknown. */
export const DEFAULT_RETURN_URL_LOCALE: ReturnUrlLocale = 'es';

/**
 * Resolves the locale to embed in MP return URLs from the authenticated user's
 * web language preference (`user.settings.languageWeb`).
 *
 * Falls back to `'es'` when:
 * - There is no authenticated user on the context.
 * - The user has no `settings.languageWeb` value.
 * - The stored value is not one of the three supported locales.
 *
 * @param c - Hono context carrying the Better Auth session user.
 * @returns A supported locale string for use in URL path prefixes.
 */
export function resolveReturnUrlLocale(c: Context): ReturnUrlLocale {
    const user = c.get('user') as { settings?: Record<string, unknown> } | null | undefined;
    const rawLocale = user?.settings?.languageWeb;

    if (
        typeof rawLocale === 'string' &&
        (SUPPORTED_RETURN_URL_LOCALES as readonly string[]).includes(rawLocale)
    ) {
        return rawLocale as ReturnUrlLocale;
    }

    return DEFAULT_RETURN_URL_LOCALE;
}

/**
 * MercadoPago `back_url` for the preapproval (monthly subscriptions).
 *
 * MP requires a non-empty `back_url` at preapproval-create time and
 * redirects the user there after they authorise the recurring charge.
 * The URL MUST land on an existing route — Astro's locale middleware
 * rewrites unknown segments (e.g. `/billing/return`) into a 404 surface,
 * so we point directly at the checkout success page which already exists
 * at `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro` and
 * is set up to read `?status=` / `?preapproval_id=` query parameters MP
 * appends post-authorise.
 *
 * History: until 2026-05-21 this returned
 * `${HOSPEDA_SITE_URL}/billing/return`, which Astro's middleware rewrote
 * to `/es/return/` (404). Surfaced during staging smoke as Finding #8.
 *
 * @param locale - User's preferred return-URL locale (e.g. `'es'`, `'en'`, `'pt'`).
 */
export function buildPaymentMethodReturnUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/success/`;
}

/**
 * Webhook destination for the MP preapproval. We pass the application-wide
 * URL explicitly so MercadoPago always reaches this API, even when a
 * legacy app-wide URL exists in the MP dashboard.
 */
export function buildNotificationUrl(): string {
    return `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`;
}

/**
 * Hosted-checkout `success` redirect for an ANNUAL (one-time charge)
 * checkout — used by both `/start-paid` (first-time annual subscription)
 * and the annual reactivation routes (HOS-123). Points directly at the
 * existing localized checkout success page to avoid Astro's
 * locale-middleware rewrite that bit the monthly flow (Finding #8).
 *
 * The front-end persists `localSubscriptionId` from the response body in
 * sessionStorage BEFORE redirecting to MP, so the URL carries no id; MP
 * appends `?status=approved` / `?payment_id=...` / `?preference_id=...` at
 * redirect time.
 *
 * @param locale - User's preferred return-URL locale (e.g. `'es'`, `'en'`, `'pt'`).
 */
export function buildAnnualSuccessUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/success/`;
}

/**
 * Hosted-checkout `cancel` redirect for an ANNUAL (one-time charge)
 * checkout (HOS-123). Points at the existing localized checkout failure
 * page.
 *
 * NOTE: a `pending` outcome URL would point at
 * `${HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/pending/` but the
 * subscription-checkout service currently only accepts success + cancel;
 * pending payments fall back to the cancel URL until the service threads a
 * `back_urls.pending` through to MP. Tracked as a follow-up.
 *
 * @param locale - User's preferred return-URL locale.
 */
export function buildAnnualCancelUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/failure/`;
}
