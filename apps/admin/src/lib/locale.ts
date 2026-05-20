/**
 * Locale resolution from the request's Accept-Language header.
 *
 * Used by the admin guard to pick the appropriate locale of the public web
 * funnel when redirecting an unauthorized tourist (USER role) out of the admin.
 *
 * @module locale
 */

import { env } from '@/env';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Arguments for {@link pickLocaleFromAcceptLanguage}.
 */
export interface PickLocaleFromAcceptLanguageArgs {
    readonly header: string | null | undefined;
    readonly supportedLocales: readonly string[];
    readonly defaultLocale: string;
}

/**
 * Result returned by {@link pickLocaleFromAcceptLanguage} and
 * {@link fetchPreferredLocale}.
 */
export interface PickLocaleResult {
    readonly locale: string;
}

interface ParsedLanguageEntry {
    readonly tag: string;
    readonly q: number;
}

const parseAcceptLanguageEntries = (header: string): ParsedLanguageEntry[] => {
    return header
        .split(',')
        .map((part) => {
            const trimmed = part.trim();
            if (!trimmed) return null;
            const [rawTag, ...params] = trimmed.split(';');
            const tag = rawTag?.trim().toLowerCase();
            if (!tag) return null;
            const qParam = params.find((p) => p.trim().startsWith('q='));
            const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1.0;
            if (Number.isNaN(q)) return null;
            return { tag, q } satisfies ParsedLanguageEntry;
        })
        .filter((entry): entry is ParsedLanguageEntry => entry !== null)
        .sort((a, b) => b.q - a.q);
};

/**
 * Pure function. Parses an `Accept-Language` header and returns the first
 * supported locale, or the default locale when nothing matches.
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
    const { header, supportedLocales, defaultLocale } = args;

    if (!header || typeof header !== 'string') {
        return { locale: defaultLocale };
    }

    const entries = parseAcceptLanguageEntries(header);
    if (entries.length === 0) {
        return { locale: defaultLocale };
    }

    const supportedLower = supportedLocales.map((locale) => locale.toLowerCase());

    for (const { tag } of entries) {
        const exactIndex = supportedLower.indexOf(tag);
        if (exactIndex !== -1) {
            return { locale: supportedLocales[exactIndex] as string };
        }
        const primary = tag.split('-')[0];
        if (primary) {
            const primaryIndex = supportedLower.indexOf(primary);
            if (primaryIndex !== -1) {
                return { locale: supportedLocales[primaryIndex] as string };
            }
        }
    }

    return { locale: defaultLocale };
};

/**
 * Parses the comma-separated `VITE_SUPPORTED_LOCALES` env value into a tidy array.
 */
const getSupportedLocales = (): readonly string[] => {
    return env.VITE_SUPPORTED_LOCALES.split(',')
        .map((locale) => locale.trim())
        .filter((locale) => locale.length > 0);
};

/**
 * Server function. Reads the current request's `Accept-Language` header and
 * returns the preferred admin-app locale, falling back to
 * `VITE_DEFAULT_LOCALE` when the header is absent or unmatched.
 */
export const fetchPreferredLocale = createServerFn({ method: 'GET' }).handler(
    async (): Promise<PickLocaleResult> => {
        const request = getWebRequest();
        const header = request?.headers.get('accept-language') ?? null;

        return pickLocaleFromAcceptLanguage({
            header,
            supportedLocales: getSupportedLocales(),
            defaultLocale: env.VITE_DEFAULT_LOCALE
        });
    }
);
