/**
 * Locale resolution for the admin app.
 *
 * `Accept-Language` parsing (the pure matching logic) is canonically
 * implemented once, in `@repo/i18n`'s `matchAcceptLanguage`, so the admin,
 * the API, and any future consumer never re-derive it independently
 * (HOS-617). This module keeps thin, admin-specific wrappers: reading the
 * request header (a TanStack Start server function), and reading the
 * admin's configured supported-locale list from its own env.
 *
 * The admin guard (`_authed.tsx`) combines this module's raw header with the
 * account's saved preference (from `fetchAuthSession`) via `@repo/i18n`'s
 * `resolveDisplayLocale` — the single product-wide precedence rule — to
 * decide which locale to embed in the web-app redirects it builds (signin,
 * tourist funnel).
 *
 * @module locale
 */

import { matchAcceptLanguage } from '@repo/i18n';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from '@/env';

/**
 * Arguments for {@link pickLocaleFromAcceptLanguage}.
 */
export interface PickLocaleFromAcceptLanguageArgs {
    readonly header: string | null | undefined;
    readonly supportedLocales: readonly string[];
    readonly defaultLocale: string;
}

/**
 * Result returned by {@link pickLocaleFromAcceptLanguage}.
 */
export interface PickLocaleResult {
    readonly locale: string;
}

/**
 * Pure function. Parses an `Accept-Language` header and returns the first
 * supported locale, or the default locale when nothing matches.
 *
 * Thin wrapper over `@repo/i18n`'s `matchAcceptLanguage` — kept as its own
 * export (rather than inlining the import at every call site) so this
 * module's existing consumers and tests are unaffected by where the
 * underlying parsing logic lives.
 *
 * - Q-values are honored (`en;q=0.9,es;q=0.8` ranks `en` first).
 * - Region tags fall back to their primary tag (`pt-BR` matches `pt`).
 * - Empty, missing, or malformed headers fall back to `defaultLocale`.
 *
 * @param args - Arguments object (RO-RO).
 * @returns Object containing the resolved locale.
 */
export const pickLocaleFromAcceptLanguage = (
    args: PickLocaleFromAcceptLanguageArgs
): PickLocaleResult => {
    const { locale } = matchAcceptLanguage(args);
    return { locale };
};

/**
 * Parses the comma-separated `VITE_SUPPORTED_LOCALES` env value into a tidy
 * array. Includes `pt` by default (HOS-617) — see `VITE_SUPPORTED_LOCALES`'s
 * default in `env-schema.ts` / `env.ts`.
 */
export const getSupportedLocales = (): readonly string[] => {
    return env.VITE_SUPPORTED_LOCALES.split(',')
        .map((locale) => locale.trim())
        .filter((locale) => locale.length > 0);
};

/**
 * Result of {@link fetchPreferredLocale}.
 */
export interface FetchPreferredLocaleResult extends PickLocaleResult {
    /**
     * The raw `Accept-Language` header value, or `null` when absent. Exposed
     * so callers that also know the account's saved preference (HOS-609)
     * can combine both signals through `resolveDisplayLocale` instead of
     * re-deriving the precedence themselves.
     */
    readonly header: string | null;
}

/**
 * Server function. Reads the current request's `Accept-Language` header and
 * returns both the header-only resolved locale (falling back to
 * `VITE_DEFAULT_LOCALE` when absent/unmatched) and the raw header value.
 */
export const fetchPreferredLocale = createServerFn({ method: 'GET' }).handler(
    async (): Promise<FetchPreferredLocaleResult> => {
        const request = getRequest();
        const header = request?.headers.get('accept-language') ?? null;

        const { locale } = pickLocaleFromAcceptLanguage({
            header,
            supportedLocales: getSupportedLocales(),
            defaultLocale: env.VITE_DEFAULT_LOCALE
        });

        return { locale, header };
    }
);
