/**
 * Single, product-wide precedence rule for resolving which locale a visitor
 * should see, used by every redirect/return-URL builder in the platform
 * (HOS-605, HOS-609, HOS-617).
 *
 * Before this module existed, three places decided the display locale on
 * their own, with three different (and in two cases contradictory) rules:
 * the API's MercadoPago return-URL builder read only the account's saved
 * preference, the admin panel read only `Accept-Language`, and the public
 * web never negotiated at all. The owner's decision (2026-08-21, HOS-617)
 * fixed ONE precedence order for the whole product:
 *
 * ```
 * 1. Explicit locale in the URL (or an equivalent explicit signal, e.g. the
 *    page the visitor was on when they triggered a server-side action)
 * 2. The account's saved preference (`user.settings.languageWeb`)
 * 3. The `Accept-Language` request header
 * 4. The default locale
 * ```
 *
 * Every caller supplies whichever of the first three signals it actually
 * has (all are optional) — {@link resolveDisplayLocale} never fetches
 * anything itself, it only decides given what it is handed.
 *
 * @module locale-resolution
 */

import {
    defaultLocale as DEFAULT_LOCALE,
    locales as DEFAULT_SUPPORTED_LOCALES
} from './config.shared';

/** A parsed `Accept-Language` header entry, before it is ranked by `q`. */
interface ParsedAcceptLanguageEntry {
    readonly tag: string;
    readonly q: number;
}

/**
 * Parses a raw `Accept-Language` header value into ranked `{ tag, q }`
 * entries, sorted by descending quality. Malformed entries (empty tag,
 * non-numeric `q`) are dropped rather than defaulted, so they cannot outrank
 * a well-formed lower-priority entry.
 *
 * @param header - The raw header value.
 * @returns Entries sorted by descending `q` (ties keep header order).
 */
const parseAcceptLanguageEntries = (header: string): ParsedAcceptLanguageEntry[] => {
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
            return { tag, q } satisfies ParsedAcceptLanguageEntry;
        })
        .filter((entry): entry is ParsedAcceptLanguageEntry => entry !== null)
        .sort((a, b) => b.q - a.q);
};

/**
 * Case-insensitively looks up `value` in `supportedLocales`, returning the
 * entry's canonical casing from the list (never the caller's raw casing).
 *
 * @param params - Arguments object (RO-RO).
 * @returns The canonical supported-locale string, or `null` when unmatched.
 */
const findSupportedLocale = (params: {
    readonly value: string;
    readonly supportedLocales: readonly string[];
}): string | null => {
    const { value, supportedLocales } = params;
    const lower = value.toLowerCase();
    const index = supportedLocales.findIndex((candidate) => candidate.toLowerCase() === lower);
    return index === -1 ? null : (supportedLocales[index] as string);
};

/** Arguments for {@link matchAcceptLanguage}. */
export interface MatchAcceptLanguageArgs {
    /** Raw `Accept-Language` header value, or `null`/`undefined` when absent. */
    readonly header?: string | null;
    /** Every locale the caller can actually serve. */
    readonly supportedLocales: readonly string[];
    /** Locale to fall back to when nothing in the header matches. */
    readonly defaultLocale: string;
}

/** Result of {@link matchAcceptLanguage}. */
export interface MatchAcceptLanguageResult {
    /** The matched locale, or `defaultLocale` when nothing matched. */
    readonly locale: string;
    /**
     * Whether `locale` came from an actual header match (`true`) or from
     * falling back to `defaultLocale` because nothing matched (`false`).
     */
    readonly matched: boolean;
}

/**
 * Parses an `Accept-Language` header and returns the highest-`q` supported
 * locale it names, folding a regional tag to its primary subtag
 * (`pt-BR` → `pt`) when the region-specific tag itself is not supported.
 *
 * Pure function — no I/O, case-insensitive, tolerant of malformed `q`
 * values and stray whitespace.
 *
 * @param args - Arguments object (RO-RO).
 * @returns The matched locale plus whether a match was actually found.
 */
export const matchAcceptLanguage = (args: MatchAcceptLanguageArgs): MatchAcceptLanguageResult => {
    const { header, supportedLocales, defaultLocale } = args;

    if (!header || typeof header !== 'string') {
        return { locale: defaultLocale, matched: false };
    }

    const entries = parseAcceptLanguageEntries(header);
    if (entries.length === 0) {
        return { locale: defaultLocale, matched: false };
    }

    for (const { tag } of entries) {
        const exact = findSupportedLocale({ value: tag, supportedLocales });
        if (exact) {
            return { locale: exact, matched: true };
        }
        const primary = tag.split('-')[0];
        if (primary) {
            const byPrimary = findSupportedLocale({ value: primary, supportedLocales });
            if (byPrimary) {
                return { locale: byPrimary, matched: true };
            }
        }
    }

    return { locale: defaultLocale, matched: false };
};

/** Which precedence step produced the final locale in {@link resolveDisplayLocale}. */
export type LocaleResolutionSource = 'url' | 'account' | 'accept-language' | 'default';

/** Arguments for {@link resolveDisplayLocale}. */
export interface ResolveDisplayLocaleArgs {
    /**
     * Step 1 — an explicit locale signal the caller already knows for a
     * fact: the locale segment of the URL the visitor is on/navigated from,
     * or an equivalent explicit-intent header the frontend sent. `null`,
     * `undefined`, or unsupported values are treated as "no signal" and fall
     * through to the next step.
     */
    readonly urlLocale?: string | null;
    /**
     * Step 2 — the account's saved preference (`user.settings.languageWeb`
     * or the admin-surface equivalent). `null`/`undefined` for guests or
     * accounts with no stored preference.
     */
    readonly accountLocale?: string | null;
    /** Step 3 — the raw `Accept-Language` request header, or `null`/`undefined`. */
    readonly acceptLanguageHeader?: string | null;
    /** Every locale the caller can actually serve. Defaults to the platform's full locale list. */
    readonly supportedLocales?: readonly string[];
    /** Step 4 — the locale to use when none of the above resolve. Defaults to the platform default. */
    readonly defaultLocale?: string;
}

/** Result of {@link resolveDisplayLocale}. */
export interface ResolveDisplayLocaleResult {
    /** The resolved locale — always one of `supportedLocales`. */
    readonly locale: string;
    /** Which precedence step produced {@link ResolveDisplayLocaleResult.locale}. */
    readonly source: LocaleResolutionSource;
}

/**
 * Resolves the locale to show a visitor, applying the single product-wide
 * precedence rule (HOS-605 / HOS-609 / HOS-617): explicit URL locale >
 * account preference > `Accept-Language` > default.
 *
 * Pure function — every input is a value the caller already has; this
 * function never reads a request, a cookie, or a database itself. That is
 * what keeps it usable from both a Hono `Context` (API) and a TanStack
 * Start server function (admin) without either depending on the other's
 * runtime.
 *
 * @param args - Arguments object (RO-RO). See {@link ResolveDisplayLocaleArgs}.
 * @returns The resolved locale and which step produced it.
 *
 * @example
 * ```ts
 * // HOS-605: paid from /es/, profile says 'en' — the URL of origin wins.
 * resolveDisplayLocale({ urlLocale: 'es', accountLocale: 'en' });
 * // => { locale: 'es', source: 'url' }
 *
 * // HOS-609: Spanish account, English browser, no locale in the target URL
 * // — the account preference wins.
 * resolveDisplayLocale({ accountLocale: 'es', acceptLanguageHeader: 'en-US' });
 * // => { locale: 'es', source: 'account' }
 * ```
 */
export function resolveDisplayLocale(
    args: ResolveDisplayLocaleArgs = {}
): ResolveDisplayLocaleResult {
    const {
        urlLocale,
        accountLocale,
        acceptLanguageHeader,
        supportedLocales = DEFAULT_SUPPORTED_LOCALES,
        defaultLocale = DEFAULT_LOCALE
    } = args;

    if (urlLocale) {
        const matched = findSupportedLocale({ value: urlLocale, supportedLocales });
        if (matched) {
            return { locale: matched, source: 'url' };
        }
    }

    if (accountLocale) {
        const matched = findSupportedLocale({ value: accountLocale, supportedLocales });
        if (matched) {
            return { locale: matched, source: 'account' };
        }
    }

    const { locale, matched } = matchAcceptLanguage({
        header: acceptLanguageHeader,
        supportedLocales,
        defaultLocale
    });
    if (matched) {
        return { locale, source: 'accept-language' };
    }

    return { locale: defaultLocale, source: 'default' };
}
