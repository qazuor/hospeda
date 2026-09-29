/**
 * @file csp-soft-nav-check.mjs
 * @description Pure helpers for the over-the-wire soft-navigation CSP check
 * (HOS-807), used by `verify-csp-over-the-wire.mjs` and unit-tested on their
 * own.
 *
 * The property checked is the one a `<ClientRouter />` soft navigation needs:
 * the policy stays the ORIGIN page's while the DESTINATION page's inline
 * scripts run, so every executable inline script of every page must be
 * authorised by the CSP header of every OTHER page. Checking that pairwise over
 * real responses verifies the build-time union and the boot-time hashes
 * together, and that the boot-time hashes match the bytes actually rendered.
 */

import { createHash } from 'node:crypto';
import { parse } from 'parse5';

/** `type` values browsers execute; anything else is a data block (JSON-LD…). */
const EXECUTABLE_SCRIPT_TYPES = new Set([
    '',
    'module',
    'text/javascript',
    'application/javascript',
    'application/ecmascript',
    'text/ecmascript'
]);

/**
 * Ceiling for one served CSP header. Proxies cap the total header block (8 KB
 * is the conservative end of the nginx / Cloudflare range), and the union
 * grows with every inline script the app adds. Measured 2026-09-28: 3238 bytes.
 */
export const MAX_CSP_HEADER_BYTES = 8192;

/** The meta tag `<ClientRouter />` renders; a page without it is never soft-navigated to. */
const CLIENT_ROUTER_META = 'astro-view-transitions-enabled';

const toCspHash = (source) =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

/**
 * Returns every executable inline `<script>` in a document, hashed exactly as
 * a browser hashes it for `script-src` (the raw text content, untrimmed).
 *
 * @param {{ html: string }} args
 * @returns {{ hash: string, preview: string }[]} Deduplicated by hash.
 */
export function extractExecutableInlineScripts({ html }) {
    const found = new Map();
    const walk = (node, insideNoscript) => {
        const tagName = node.tagName ?? null;
        if (!insideNoscript && tagName === 'script') {
            const attrs = new Map(node.attrs.map((attr) => [attr.name, attr.value]));
            const type = (attrs.get('type') ?? '').trim().toLowerCase();
            if (!attrs.has('src') && EXECUTABLE_SCRIPT_TYPES.has(type)) {
                const text = node.childNodes
                    .filter((child) => child.nodeName === '#text')
                    .map((child) => child.value)
                    .join('');
                if (text.length > 0) {
                    const hash = toCspHash(text);
                    if (!found.has(hash)) {
                        found.set(hash, { hash, preview: text.trim().slice(0, 100) });
                    }
                }
            }
        }
        const nextInsideNoscript = insideNoscript || tagName === 'noscript';
        for (const child of node.childNodes ?? []) {
            walk(child, nextInsideNoscript);
        }
    };
    walk(parse(html), false);
    return [...found.values()];
}

/**
 * Whether the document mounts `<ClientRouter />` (and can therefore be the
 * origin or the destination of a soft navigation).
 *
 * @param {{ html: string }} args
 * @returns {boolean}
 */
export function hasClientRouter({ html }) {
    return html.includes(`name="${CLIENT_ROUTER_META}"`);
}

/**
 * Extracts the `sha256-` sources of the `script-src` directive.
 *
 * @param {{ csp: string }} args
 * @returns {Set<string>} Unquoted `sha256-…` tokens.
 */
export function parseScriptSrcHashes({ csp }) {
    const directive = csp
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('script-src '));
    if (!directive) return new Set();
    return new Set(
        directive
            .split(/\s+/)
            .filter((token) => token.startsWith("'sha256-"))
            .map((token) => token.slice(1, -1))
    );
}

/**
 * Turns router-manifest page patterns into concrete paths. Only routes whose
 * sole parameter is `[lang]` can be requested without data; the rest are
 * returned as skipped so the caller prints the size of its blind spot.
 *
 * @param {{ pageRoutes: { pattern: string, params: string[] }[], locale: string }} args
 * @returns {{ paths: string[], skipped: string[] }}
 */
export function resolveCheckablePaths({ pageRoutes, locale }) {
    const paths = [];
    const skipped = [];
    for (const route of pageRoutes) {
        const onlyLang = route.params.every((param) => param === 'lang');
        if (!onlyLang) {
            skipped.push(route.pattern);
            continue;
        }
        const concrete = route.pattern.replace('[lang]', locale);
        paths.push(concrete.endsWith('/') ? concrete : `${concrete}/`);
    }
    return { paths: [...new Set(paths)].sort(), skipped: skipped.sort() };
}

/**
 * Finds every inline script that some page carries and some OTHER page's CSP
 * does not authorise — i.e. a script blocked when that page is reached by soft
 * navigation from the other.
 *
 * @param {{ pages: { path: string, scripts: { hash: string, preview: string }[], headerHashes: Set<string> }[] }} args
 * @returns {{ hash: string, preview: string, destinations: string[], origins: string[] }[]}
 */
export function findSoftNavViolations({ pages }) {
    const byHash = new Map();
    for (const destination of pages) {
        for (const script of destination.scripts) {
            for (const origin of pages) {
                if (origin === destination || origin.headerHashes.has(script.hash)) continue;
                const entry = byHash.get(script.hash) ?? {
                    hash: script.hash,
                    preview: script.preview,
                    destinations: new Set(),
                    origins: new Set()
                };
                entry.destinations.add(destination.path);
                entry.origins.add(origin.path);
                byHash.set(script.hash, entry);
            }
        }
    }
    return [...byHash.values()].map((entry) => ({
        hash: entry.hash,
        preview: entry.preview,
        destinations: [...entry.destinations].sort(),
        origins: [...entry.origins].sort()
    }));
}
