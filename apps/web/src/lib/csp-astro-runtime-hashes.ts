/**
 * @file csp-astro-runtime-hashes.ts
 * @description CSP `sha256-` sources for the inline scripts Astro's own client
 * runtime emits, hash-allowed on EVERY response instead of only on the ones
 * whose body happens to contain them (HOS-798).
 *
 * ## The bug this fixes
 *
 * `buildCspHeader()` publishes the hashes `collectCspHashes()` found in THIS
 * response's body. That is correct for a full page load, and wrong for a
 * `<ClientRouter />` soft navigation: the soft nav never replaces the document,
 * so the CSP that stays in force is the one the ORIGIN page was served with,
 * while Astro injects the DESTINATION page's inline scripts into it. Any inline
 * script the destination carries and the origin did not is blocked.
 *
 * That is not hypothetical. `Astro.only` — the 130-byte runtime that backs the
 * `client:only` directive — ships on only 6 of 15 page types, so navigating to
 * a `client:only` island from a page without one blocked it. Because
 * `client:only` is the ONE directive with no SSR output, the component then
 * never rendered at all: the "Publicar" CTA on `/publicar/` and every Leaflet
 * map on the site were invisible until the visitor reloaded.
 *
 * ## Why hash-allowing them globally is safe
 *
 * These are fixed strings baked into Astro's runtime, not per-request output.
 * A hash source authorises exactly one byte sequence, so publishing it on every
 * response widens the policy by precisely those five scripts and nothing else.
 * An attacker cannot forge a payload that matches a SHA-256 they do not control.
 * This mirrors the `style-src` entry for Astro's
 * `astro-island{display:contents}` block, hardcoded in `buildCspHeader()` for
 * the same reason: `collectCspHashes()` only walks the initial SSR HTML.
 *
 * Do NOT "solve" this with a nonce. HOS-369 WB0-1 removed the per-request nonce
 * on purpose: Cloudflare caches the header alongside the body, so a nonce
 * survives into the cache as a static, publicly readable token for the whole
 * TTL. `scripts/check-no-inline-nonce.sh` enforces that.
 *
 * ## Necessary but NOT sufficient: server islands
 *
 * `replaceServerIsland` is listed here for completeness, but authorising it does
 * NOT make `server:defer` survive a soft navigation. A server island emits TWO
 * inline scripts, and the second one carries the island URL with its props
 * ENCRYPTED (`/_server-islands/<Name>/?e=…&p=…`). That ciphertext uses a fresh
 * IV per render — five renders of the same page yield five different hashes —
 * so it can never be pre-authorised, by this constant or by any build-time
 * enumeration. Fixing a `server:defer` island reached by soft nav requires
 * removing the defer or forcing a hard navigation to that page.
 *
 * @see apps/web/src/lib/__tests__/csp-astro-runtime-hashes.test.ts — the guard
 *   that fails when an Astro upgrade changes any of these payloads.
 */

import { createHash } from 'node:crypto';

/**
 * The exact Astro release these payloads were captured from.
 *
 * The guard compares this against the version pnpm actually resolves. Astro
 * minifies these runtime snippets, so ANY version bump can change a byte and
 * silently invalidate every hash below — which would not break the build, it
 * would quietly reinstate HOS-798. When the guard fails: re-capture the
 * payloads from a built page, update `ASTRO_RUNTIME_INLINE_SCRIPTS`, and bump
 * this constant in the same commit.
 */
export const VERIFIED_ASTRO_VERSION = '7.1.6';

/**
 * One entry per inline script Astro's client runtime emits, keyed by the global
 * it installs. `source` is the byte-exact payload; the hash is derived from it
 * at module load, so the two can never drift apart.
 */
export const ASTRO_RUNTIME_INLINE_SCRIPTS: readonly {
    /** Human-readable name — the global the snippet installs. */
    readonly name: string;
    /** The client directive (or feature) this snippet backs. */
    readonly directive: string;
    /** Byte-exact payload as Astro emits it. */
    readonly source: string;
}[] = [
    {
        name: 'Astro.load',
        directive: 'client:load',
        source: '(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event("astro:load"));})();'
    },
    {
        name: 'Astro.only',
        directive: 'client:only',
        source: '(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event("astro:only"));})();'
    },
    {
        name: 'Astro.idle',
        directive: 'client:idle',
        source: '(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value=="object"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};"requestIdleCallback"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event("astro:idle"));})();'
    },
    {
        name: 'Astro.visible',
        directive: 'client:visible',
        source: '(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value=="object"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event("astro:visible"));})();'
    },
    {
        name: 'replaceServerIsland',
        directive: 'server:defer',
        source: "async function replaceServerIsland(id, r) { let s = document.querySelector(`script[data-island-id=\"${id}\"]`); if (!s || r.status !== 200 || r.headers.get('content-type')?.split(';')[0].trim() !== 'text/html') return; let html = await r.text(); while (s.previousSibling && s.previousSibling.nodeType !== 8 && s.previousSibling.data !== '[if astro]>server-island-start<![endif]') s.previousSibling.remove(); s.previousSibling?.remove(); s.before(document.createRange().createContextualFragment(html)); s.remove(); }"
    }
] as const;

/**
 * Derives a CSP `sha256-` source token from a script payload.
 *
 * @param source - The byte-exact inline script content
 * @returns The unquoted `sha256-…` token
 */
const toCspHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

/**
 * Unquoted `sha256-…` tokens for every Astro runtime snippet above, computed
 * once at module load. `buildCspHeader()` appends these to `script-src` on
 * every response so a soft navigation never lands on a page whose runtime the
 * in-force policy has not authorised.
 */
export const ASTRO_RUNTIME_SCRIPT_HASHES: readonly string[] = ASTRO_RUNTIME_INLINE_SCRIPTS.map(
    (entry) => toCspHash(entry.source)
);
