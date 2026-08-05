/**
 * @file i18n-asset.ts
 * @description Single source of truth for the hashed, immutable JavaScript asset
 * that delivers one locale's flattened translation dictionary to the browser
 * (HOS-369 Wave D).
 *
 * The dictionary used to be inlined into every page as a
 * `<script type="application/json">` data block. For `es` that block is ~632 KB
 * raw and byte-identical on every page — 46.4% of the HTML of a listing page —
 * so the browser paid for it on every single navigation. Served as a
 * content-addressed asset instead, it is downloaded once per session per locale
 * and then read from the HTTP cache.
 *
 * Two properties make that safe, and both live here rather than being split
 * between the endpoint and the component:
 *
 *  - The URL and the served content are derived from the SAME string. The
 *    endpoint answers with `getI18nAssetBody`, the page links to
 *    `i18nAssetUrl`, and both are computed from one memoized entry, so the two
 *    cannot desynchronize.
 *  - The asset is a CLASSIC script that assigns a global, never JSON fetched at
 *    runtime. `getClientLocaleDict` (in `./i18n`) is synchronous and is called
 *    while islands render; anything asynchronous would hand them an empty
 *    dictionary and every key would silently degrade to its fallback.
 *
 * Server-only by construction: `getInlineLocaleMessages` reads the full
 * `@repo/i18n` catalog behind an `import.meta.env.SSR` guard, which is what
 * keeps that catalog out of the client bundle.
 *
 * @module lib/i18n-asset
 */

import { createHash } from 'node:crypto';
import type { SupportedLocale } from './i18n';
import { getInlineLocaleMessages, isValidLocale, SUPPORTED_LOCALES } from './i18n';

/**
 * URL path prefix the dictionary assets are served under.
 *
 * NOT `/_i18n/`: Astro excludes every `src/pages/_*` path from routing, so an
 * underscored directory would never produce a route at all.
 */
export const I18N_ASSET_PATH_PREFIX = '/i18n/';

/**
 * Extension every asset filename ends in.
 *
 * Exported because the route that serves them is `src/pages/i18n/[file].js.ts`
 * — Astro strips that `.js` route suffix before filling `params.file`, so the
 * endpoint has to put it back before calling {@link resolveI18nAssetLocale}.
 * Sharing the constant keeps the two halves of that filename from drifting.
 */
export const I18N_ASSET_EXTENSION = '.js';

/** Length of the content hash embedded in the filename. */
const HASH_LENGTH = 8;

/**
 * The only filename shape the endpoint accepts: `<locale>.<8 lowercase hex>.js`.
 * Anchored, so nothing else can reach the hash comparison.
 */
const ASSET_FILE_PATTERN = /^([a-z]{2})\.([0-9a-f]{8})\.js$/;

/** One locale's asset: the exact bytes served, and the hash that names them. */
interface I18nAssetEntry {
    /** The JavaScript body served for this locale. */
    readonly body: string;
    /** First {@link HASH_LENGTH} hex chars of `sha256(body)`. */
    readonly hash: string;
}

/**
 * Serializes one locale's dictionary as a classic-script global assignment.
 *
 * Keyed BY LOCALE (`window.__HOSPEDA_I18N__['es'] = {...}`) rather than
 * overwriting a single slot, so several locales can coexist in the global — a
 * page that ever links two of them, or a browser that kept the previous
 * locale's script alive across a soft navigation, still resolves both.
 *
 * Every `<` is rewritten to its unicode-escape form (backslash + `u003c`),
 * exactly as the inline data block did. That sequence is a valid escape in both
 * JSON and JavaScript string literals, so the payload is unchanged, and no
 * translation value can close the script element of whatever document
 * eventually embeds this text.
 *
 * @param locale - Locale whose dictionary should be serialized.
 * @returns The script body, ready to serve verbatim.
 */
function buildBody(locale: SupportedLocale): string {
    const json = JSON.stringify(getInlineLocaleMessages(locale)).replace(/</g, '\\u003c');
    return `(window.__HOSPEDA_I18N__||={})[${JSON.stringify(locale)}]=${json};`;
}

/**
 * Builds the body and its hash for one locale.
 *
 * @param locale - Locale to build the asset for.
 * @returns The body plus the truncated sha256 that names it.
 */
function buildEntry(locale: SupportedLocale): I18nAssetEntry {
    const body = buildBody(locale);
    const hash = createHash('sha256').update(body, 'utf8').digest('hex').slice(0, HASH_LENGTH);
    return { body, hash };
}

/**
 * Every locale's asset, built ONCE at module load.
 *
 * Serializing an 8,000-key dictionary and hashing 632 KB is not something a
 * request may pay for: the endpoint would do it on every hit, and the component
 * on every render of every page. The process is long-lived (the standalone Node
 * server), so this is paid once per boot per locale.
 */
const ASSETS = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, buildEntry(locale)])
) as Readonly<Record<SupportedLocale, I18nAssetEntry>>;

/**
 * The immutable, content-addressed URL of a locale's dictionary asset.
 *
 * @param locale - Locale to link.
 * @returns A path of the form `/i18n/<locale>.<8 hex>.js`.
 *
 * @example
 * ```ts
 * i18nAssetUrl('es'); // "/i18n/es.9f3a1c07.js"
 * ```
 */
export function i18nAssetUrl(locale: SupportedLocale): string {
    return `${I18N_ASSET_PATH_PREFIX}${locale}.${ASSETS[locale].hash}${I18N_ASSET_EXTENSION}`;
}

/**
 * The exact JavaScript body served for a locale.
 *
 * @param locale - Locale whose dictionary is requested.
 * @returns The classic-script source that assigns `window.__HOSPEDA_I18N__`.
 */
export function getI18nAssetBody(locale: SupportedLocale): string {
    return ASSETS[locale].body;
}

/**
 * Resolves a requested filename back to the locale it names, verifying that the
 * hash still matches the dictionary this process would serve.
 *
 * The hash check is load-bearing, not defensive tidiness. The response is
 * served `immutable` for a year, so answering a STALE URL with FRESH content
 * would pin the wrong dictionary in every browser and CDN that asked for it,
 * with no way to invalidate it. A URL whose hash no longer matches names
 * content this deployment does not have; the only correct answer is 404.
 *
 * @param file - The requested filename, e.g. `es.9f3a1c07.js`.
 * @returns The locale when the filename is well-formed, known and current;
 *   `null` otherwise.
 */
export function resolveI18nAssetLocale(file: string): SupportedLocale | null {
    const match = ASSET_FILE_PATTERN.exec(file);
    if (!match) return null;

    const [, localeCandidate = '', hash = ''] = match;
    if (!isValidLocale(localeCandidate)) return null;

    return ASSETS[localeCandidate].hash === hash ? localeCandidate : null;
}
