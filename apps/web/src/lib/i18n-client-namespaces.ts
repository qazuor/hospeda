/**
 * @file i18n-client-namespaces.ts
 * @description The i18n namespaces that ship to the BROWSER, and the only place
 * that set is declared (HOS-369 W3-2).
 *
 * The dictionary has two consumers with very different needs:
 *
 *  - **SSR** reads the full `@repo/i18n` catalog directly through
 *    `getLocaleDict`. It is not affected by this list and never will be —
 *    server rendering must be able to resolve every key of every namespace.
 *  - **The browser** reads only what the hashed `/i18n/<locale>.<hash>.js`
 *    asset carries, and an island can only ever ask for a namespace some
 *    client-reachable module names. Everything else was pure download weight:
 *    measured at **28,113 bytes brotli — 26.9% of the asset** — paid by every
 *    visitor on every cold load, for strings no browser code can reach.
 *
 * **Read this before editing the list.** The failure mode is not a crash. A key
 * whose namespace is missing resolves to `undefined`, and
 * `resolve()` in `./i18n` then renders either the call site's inline fallback
 * (invisible — 154 call sites pass one) or, with no fallback, **the raw key
 * text in production**. `[MISSING: …]` only appears under `import.meta.env.DEV`,
 * so a wrong entry here looks perfect in dev and ships garbage.
 *
 * That is why the list is not maintained by hand-auditing components:
 * `test/lib/i18n-client-namespaces.guard.test.ts` recomputes it from the real
 * import graph out of the island entry points and fails CI on any divergence,
 * in BOTH directions. Add a `t('faq.…')` to an island without adding `faq`
 * here and CI fails; leave a namespace here that nothing reaches and CI fails
 * too, so dead weight cannot creep back.
 *
 * @module lib/i18n-client-namespaces
 */

import type { Namespace } from '@repo/i18n/web';

/**
 * Namespaces reachable from browser code, and therefore serialized into the
 * client dictionary asset.
 *
 * Derived from the import graph, not from intuition — see the guard test. The
 * ordering is alphabetical purely so diffs stay readable.
 */
export const CLIENT_I18N_NAMESPACES = [
    'accommodations',
    'account',
    'aiSearch',
    'alliance-leads',
    'auth',
    'auth-ui',
    'billing',
    'blog',
    'comments',
    'commerce',
    'common',
    'contact',
    'contributions',
    'conversations',
    'cookieConsent',
    'destinations',
    'events',
    'experience',
    'external-reputation',
    'footer',
    'home',
    'host',
    'host-trades',
    'maps',
    'nav',
    'newsletter',
    'pricing',
    'review',
    'search',
    'ui',
    'validation'
] as const satisfies readonly Namespace[];

/** Set form, for prefix tests on a flattened `"namespace.key"` dictionary. */
const CLIENT_I18N_NAMESPACE_SET: ReadonlySet<string> = new Set(CLIENT_I18N_NAMESPACES);

/**
 * Narrows a flattened `{ "namespace.key": value }` dictionary to the namespaces
 * the browser can actually name.
 *
 * A key with no dot has no namespace and is dropped: the catalog is built by
 * `flattenObject` over `{ [namespace]: … }`, so every legitimate key carries
 * one, and anything else is malformed rather than global.
 *
 * @param messages - The full flattened dictionary for one locale.
 * @returns A new dictionary containing only client-reachable namespaces.
 */
export function pickClientNamespaces(
    messages: Readonly<Record<string, string>>
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(messages)) {
        const dot = key.indexOf('.');
        if (dot === -1) continue;
        if (CLIENT_I18N_NAMESPACE_SET.has(key.slice(0, dot))) {
            out[key] = value;
        }
    }
    return out;
}
