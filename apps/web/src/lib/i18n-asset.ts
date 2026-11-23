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
 * The body carries only the namespaces browser code can name
 * (`./i18n-client-namespaces`) — 26.9% of the asset was namespaces no client
 * module can reach, since SSR reads the full catalog server-side and never
 * touches this file (HOS-369 W3-2).
 *
 * That client dictionary is served as TWO assets (HOS-2572), each with its own
 * content hash: a small CRITICAL part, linked parser-blocking, carrying the
 * keys of the islands allowed to hydrate early plus the hydration gate that
 * holds every other island back; and the REST, linked `defer`. Both parts MERGE
 * into the same `window.__HOSPEDA_I18N__[locale]` object, in whichever order
 * they run. Why the split is shaped this way is documented in
 * `./i18n-critical-prefixes`.
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
import { pickClientNamespaces, pickKeysByPrefixes } from './i18n-client-namespaces';
import { CRITICAL_I18N_KEY_PREFIXES, EARLY_HYDRATION_ISLANDS } from './i18n-critical-prefixes';
import { buildHydrationGateScript } from './i18n-hydration-gate';

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
 * endpoint has to put it back before calling {@link resolveI18nAsset}.
 * Sharing the constant keeps the two halves of that filename from drifting.
 */
export const I18N_ASSET_EXTENSION = '.js';

/**
 * The two halves of a locale's client dictionary (HOS-2572):
 *
 *  - `critical` — parser-blocking; the early islands' keys plus the gate.
 *  - `rest` — `defer`; every other client key.
 */
export const I18N_ASSET_PARTS = ['critical', 'rest'] as const;

/** One half of a locale's client dictionary. */
export type I18nAssetPart = (typeof I18N_ASSET_PARTS)[number];

/** Length of the content hash embedded in the filename. */
const HASH_LENGTH = 8;

/**
 * The only filename shape the endpoint accepts:
 * `<locale>.<part>.<8 lowercase hex>.js`. Anchored, so nothing else can reach
 * the hash comparison.
 */
const ASSET_FILE_PATTERN = /^([a-z]{2})\.(critical|rest)\.([0-9a-f]{8})\.js$/;

/** One asset: the exact bytes served, and the hash that names them. */
interface I18nAssetEntry {
    /** The JavaScript body served. */
    readonly body: string;
    /** First {@link HASH_LENGTH} hex chars of `sha256(body)`. */
    readonly hash: string;
}

/**
 * Serializes a dictionary fragment as a classic script that MERGES it into
 * `window.__HOSPEDA_I18N__[locale]`.
 *
 * Merging (never assigning) is what lets two parts share one object: the
 * reader (`getClientLocaleDict`) sees the critical keys as soon as that script
 * runs and every other key once the deferred one has, whichever ran first.
 *
 * Keyed BY LOCALE so several locales can coexist in the global — a browser that
 * kept the previous locale's script alive across a soft navigation still
 * resolves both.
 *
 * Every `<` is rewritten to its unicode-escape form (backslash + `u003c`). That
 * sequence is a valid escape in both JSON and JavaScript string literals, so
 * the payload is unchanged, and no translation value can close the script
 * element of whatever document eventually embeds this text.
 */
function serializeMerge(input: {
    readonly locale: SupportedLocale;
    readonly messages: Readonly<Record<string, string>>;
}): string {
    const json = JSON.stringify(input.messages).replace(/</g, '\\u003c');
    return `(function(d,l,m){Object.assign(d[l]||(d[l]={}),m)})(window.__HOSPEDA_I18N__||(window.__HOSPEDA_I18N__={}),${JSON.stringify(input.locale)},${json});`;
}

/**
 * Builds both parts of one locale's client dictionary.
 *
 * The source is narrowed to the client prefixes first (HOS-369 W3-2), then cut
 * in two by {@link CRITICAL_I18N_KEY_PREFIXES}: every key lands in exactly one
 * part. The critical part is prefixed with the hydration gate.
 *
 * @param input.locale - Locale whose dictionary should be serialized.
 * @param input.messages - That locale's full flattened dictionary.
 * @returns The two script bodies, ready to serve verbatim.
 */
export function buildI18nAssetBodies(input: {
    readonly locale: SupportedLocale;
    readonly messages: Readonly<Record<string, string>>;
}): Readonly<Record<I18nAssetPart, string>> {
    const { locale } = input;
    const client = pickClientNamespaces(input.messages);
    const critical = pickKeysByPrefixes({ messages: client, prefixes: CRITICAL_I18N_KEY_PREFIXES });
    const rest: Record<string, string> = {};
    for (const [key, value] of Object.entries(client)) {
        if (!Object.hasOwn(critical, key)) rest[key] = value;
    }
    const gate = buildHydrationGateScript({ earlyIslands: EARLY_HYDRATION_ISLANDS });
    return {
        critical: `${gate}${serializeMerge({ locale, messages: critical })}`,
        rest: serializeMerge({ locale, messages: rest })
    };
}

/** Hashes a body into the entry that names it. */
function toEntry(body: string): I18nAssetEntry {
    const hash = createHash('sha256').update(body, 'utf8').digest('hex').slice(0, HASH_LENGTH);
    return { body, hash };
}

/**
 * Builds both entries for one locale.
 *
 * @param locale - Locale to build the assets for.
 * @returns Each part's body plus the truncated sha256 that names it.
 */
function buildEntries(locale: SupportedLocale): Readonly<Record<I18nAssetPart, I18nAssetEntry>> {
    const bodies = buildI18nAssetBodies({ locale, messages: getInlineLocaleMessages(locale) });
    return { critical: toEntry(bodies.critical), rest: toEntry(bodies.rest) };
}

/**
 * Every locale's assets, built ONCE at module load.
 *
 * Serializing an 8,000-key dictionary and hashing 632 KB is not something a
 * request may pay for: the endpoint would do it on every hit, and the component
 * on every render of every page. The process is long-lived (the standalone Node
 * server), so this is paid once per boot per locale.
 */
const ASSETS = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, buildEntries(locale)])
) as Readonly<Record<SupportedLocale, Readonly<Record<I18nAssetPart, I18nAssetEntry>>>>;

/**
 * The immutable, content-addressed URL of one part of a locale's dictionary.
 *
 * @param input.locale - Locale to link.
 * @param input.part - Which half.
 * @returns A path of the form `/i18n/<locale>.<part>.<8 hex>.js`.
 *
 * @example
 * ```ts
 * i18nAssetUrl({ locale: 'es', part: 'critical' }); // "/i18n/es.critical.9f3a1c07.js"
 * ```
 */
export function i18nAssetUrl(input: {
    readonly locale: SupportedLocale;
    readonly part: I18nAssetPart;
}): string {
    const { locale, part } = input;
    const { hash } = ASSETS[locale][part];
    return `${I18N_ASSET_PATH_PREFIX}${locale}.${part}.${hash}${I18N_ASSET_EXTENSION}`;
}

/**
 * The exact JavaScript body served for one part of a locale's dictionary.
 *
 * @param input.locale - Locale whose dictionary is requested.
 * @param input.part - Which half.
 * @returns The classic-script source that merges into `window.__HOSPEDA_I18N__`.
 */
export function getI18nAssetBody(input: {
    readonly locale: SupportedLocale;
    readonly part: I18nAssetPart;
}): string {
    return ASSETS[input.locale][input.part].body;
}

/** A filename resolved back to what it names. */
export interface ResolvedI18nAsset {
    readonly locale: SupportedLocale;
    readonly part: I18nAssetPart;
}

/**
 * Resolves a requested filename back to the locale and part it names,
 * verifying that the hash still matches what this process would serve.
 *
 * The hash check is load-bearing, not defensive tidiness. The response is
 * served `immutable` for a year, so answering a STALE URL with FRESH content
 * would pin the wrong dictionary in every browser and CDN that asked for it,
 * with no way to invalidate it. A URL whose hash no longer matches names
 * content this deployment does not have; the only correct answer is 404. The
 * hash is checked against the part the filename NAMES, so one part's hash
 * never unlocks the other part.
 *
 * @param file - The requested filename, e.g. `es.rest.9f3a1c07.js`.
 * @returns The locale and part when the filename is well-formed, known and
 *   current; `null` otherwise.
 */
export function resolveI18nAsset(file: string): ResolvedI18nAsset | null {
    const match = ASSET_FILE_PATTERN.exec(file);
    if (!match) return null;

    const [, localeCandidate = '', part = '', hash = ''] = match;
    if (!isValidLocale(localeCandidate)) return null;
    if (part !== 'critical' && part !== 'rest') return null;

    return ASSETS[localeCandidate][part].hash === hash ? { locale: localeCandidate, part } : null;
}
