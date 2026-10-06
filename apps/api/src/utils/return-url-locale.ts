/**
 * Locale resolution for user-facing generated URLs.
 *
 * `resolveReturnUrlLocale` used to live in `routes/billing/checkout-return-urls`
 * as part of the MercadoPago paid-checkout contract; the checkout builders went
 * down with the legacy billing system (HOS-1416) and this locale resolver was
 * the only non-billing piece, still used by the QR-sheet / brochure /
 * certificate routes to pick the language of their return links.
 *
 * @module utils/return-url-locale
 */

import { resolveDisplayLocale } from '@repo/i18n';
import type { Context } from 'hono';

/**
 * Request header the web app sends on every browser-initiated call so the
 * API knows which locale the visitor was ACTUALLY on when they triggered the
 * action (HOS-605) — the closest equivalent to "an explicit locale in the
 * URL" a server-to-server call has. Set centrally by `apps/web`'s API client
 * (`src/lib/api/client.ts`) from `window.location.pathname`'s locale segment;
 * never sent by SSR-to-API calls (no `window` there).
 */
const CLIENT_LOCALE_HEADER = 'x-client-locale';

/**
 * Supported locale values for user-facing return URLs.
 *
 * Must stay in sync with `apps/web/src/lib/i18n.ts` SUPPORTED_LOCALES.
 */
export const SUPPORTED_RETURN_URL_LOCALES = ['es', 'en', 'pt'] as const;
export type ReturnUrlLocale = (typeof SUPPORTED_RETURN_URL_LOCALES)[number];

/** Fallback locale when the user has no preference or the preference is unknown. */
export const DEFAULT_RETURN_URL_LOCALE: ReturnUrlLocale = 'es';

/**
 * Resolves the locale to embed in user-facing return URLs, applying the
 * product-wide precedence rule (HOS-605 / HOS-609 / HOS-617):
 *
 * 1. The `x-client-locale` header — the locale segment of the web page the
 *    visitor was ACTUALLY on when they triggered the action.
 * 2. The authenticated user's web language preference
 *    (`user.settings.languageWeb`).
 * 3. The `Accept-Language` request header.
 * 4. `DEFAULT_RETURN_URL_LOCALE` (`'es'`).
 *
 * `c.req` is read defensively (`c.req?.header`) so unit tests that stub a
 * minimal `Context` (`{ get: vi.fn() }`, no `req`) keep working unchanged —
 * a real Hono `Context` always has `req`.
 *
 * @param c - Hono context carrying the Better Auth session user and the
 *   inbound request headers.
 * @returns A supported locale string for use in URL path prefixes.
 */
export function resolveReturnUrlLocale(c: Context): ReturnUrlLocale {
    const user = c.get('user') as { settings?: Record<string, unknown> } | null | undefined;
    const rawAccountLocale = user?.settings?.languageWeb;
    const accountLocale = typeof rawAccountLocale === 'string' ? rawAccountLocale : null;

    const req = c.req as { header?: (name: string) => string | undefined } | undefined;
    const urlLocale = req?.header?.(CLIENT_LOCALE_HEADER) ?? null;
    const acceptLanguageHeader = req?.header?.('accept-language') ?? null;

    const { locale } = resolveDisplayLocale({
        urlLocale,
        accountLocale,
        acceptLanguageHeader,
        supportedLocales: SUPPORTED_RETURN_URL_LOCALES,
        defaultLocale: DEFAULT_RETURN_URL_LOCALE
    });

    return locale as ReturnUrlLocale;
}
