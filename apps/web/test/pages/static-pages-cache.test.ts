/**
 * @file static-pages-cache.test.ts
 * @description HOS-369 W2-2 — the twelve copy-only pages opt into the edge cache.
 *
 * These pages are the cleanest cache candidates in the app: none of them awaits
 * the API, none reads a session, and none is a `SESSION_OPTIONAL_SEGMENT`. Their
 * entire content comes from `@repo/i18n` plus the page source, which means the
 * only thing that can change them is a deploy.
 *
 * That is also why they are tagged `site-config` rather than a tag of their own.
 * `site-config` is the one vocabulary entry with a live purger
 * (`platform-settings.service.ts`), and a cacheable response whose tag nobody
 * emits a purge for is exactly the silent no-op the `home` tag suffered before
 * W2-1. A settings write purges these pages without needing to — the cost is a
 * re-render, and it is the right side to err on.
 *
 * THE DEPLOY PURGE IS NOW THESE PAGES' INVALIDATION PATH, NOT THE TTL.
 * This file used to argue that nothing purges the cache on deploy, so the
 * `s-maxage` doubled as the window in which a shipped copy change was still
 * invisible at the edge — the reason NOT to raise the TTL further. HOS-427
 * shipped that purge (`src/lib/cache/purge-on-deploy.ts`): the web container
 * purges the `<env>:all` catch-all once per deploy, `DEPLOY_PURGE_SETTLE_MS`
 * (45 s) after it serves its first request.
 *
 * That reversal is what let HOS-426 put these pages on a 24 h budget — and it
 * also means the TTL no longer forgives a missed purge. At 300 s a purge that
 * never fired self-corrected within minutes and nobody noticed. At 86 400 s the
 * purge IS the mechanism, so the caveat the source file states plainly now
 * matters: the clock only starts once something reaches the new container, so
 * on a fully idle deploy the purge can be delayed well past 45 s. HOS-428
 * (enabling Coolify's healthcheck) is what bounds that, and it is a precondition
 * of the 24 h value rather than a nice-to-have next to it.
 *
 * `cacheClass: 'static'` (HOS-426) is what pins the actual budget: it is
 * asserted below alongside the tag, so a page cannot silently drift onto a
 * different class's TTL.
 *
 * `.astro` frontmatter cannot render in Vitest, so these are source-based —
 * the established pattern here (see `home-cache.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every page W2-2 makes cacheable, relative to `src/pages/[lang]/`. */
const STATIC_PAGES = [
    'nosotros/index.astro',
    'beneficios/index.astro',
    'funcionalidades/index.astro',
    'contacto/index.astro',
    'preguntas-frecuentes/index.astro',
    'legal/cookies/index.astro',
    'legal/privacidad/index.astro',
    'legal/terminos/index.astro',
    'colaborar/index.astro',
    'colaborar/editores/index.astro',
    'colaborar/fotos/index.astro',
    'colaborar/reportar/index.astro'
] as const;

/** Argument text of a call, anchored on the call so it cannot match an import. */
function callArgsOf(source: string, call: string): string {
    const start = source.indexOf(`${call}(`);
    expect(start, `${call}( not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + call.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced parentheses after ${call}(`);
}

function readPage(relative: string): string {
    return readFileSync(resolve(__dirname, '../../src/pages/[lang]', relative), 'utf8');
}

describe('static pages — edge cacheability (HOS-369 W2-2)', () => {
    it.each(STATIC_PAGES)('%s opts in through applyCacheHeaders', (page) => {
        // Not by setting `Cache-Control` itself — that path is blocked by the
        // static guard, because it lets a page ship a cacheable response with
        // no purge tags.
        expect(readPage(page)).toContain('applyCacheHeaders({');
    });

    it.each(STATIC_PAGES)('%s declares the `site-config` tag', (page) => {
        const args = callArgsOf(readPage(page), 'applyCacheHeaders');
        // Anchored on a word boundary, not `toContain`: a bare substring match
        // also accepts `CACHE_TAG_SITE_CONFIG_ANYTHING`, so it would not fail
        // if the identifier were renamed to something that still contains this
        // one (verified by mutation).
        expect(args).toMatch(/\bCACHE_TAG_SITE_CONFIG\b/);
    });

    it.each(STATIC_PAGES)('%s declares the `static` cache class (HOS-426)', (page) => {
        // Pins the freshness budget these pages get from `cache-classes.ts` to
        // the class that matches what invalidates them: only a deploy, purged
        // now by `purge-on-deploy.ts`, not a content write.
        const args = callArgsOf(readPage(page), 'applyCacheHeaders');
        expect(args).toMatch(/cacheClass:\s*'static'/);
    });

    it.each(STATIC_PAGES)('%s is cacheable unconditionally', (page) => {
        // These pages take no filter parameters and have no visitor-specific
        // render to guard against, so there is no condition to gate on. If a
        // future change introduces one, this assertion is the reminder to add
        // the gate rather than to relax the test.
        const args = callArgsOf(readPage(page), 'applyCacheHeaders');
        expect(args).toMatch(/cacheable:\s*true/);
    });

    it.each(STATIC_PAGES)('%s reads no session state', (page) => {
        // Also enforced fail-closed for every page by
        // `cacheable-pages-are-session-blind.guard.test.ts`. Repeated here so a
        // reader of THIS file sees the precondition the caching depends on.
        const source = readPage(page);
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });

    it.each(STATIC_PAGES)('%s fetches nothing from the API', (page) => {
        // The claim the `site-config` tag rests on: these responses cannot go
        // stale against entity data, because they never read any. A page that
        // grows an API call needs that entity's collection tag as well, or a
        // content write will leave it stale for the full TTL.
        expect(readPage(page)).not.toMatch(/\bawait\b/);
    });

    it.each(STATIC_PAGES)('%s stays off prerender, which would skip the header', (page) => {
        // `prerender = true` runs middleware once at build time; @astrojs/node
        // then serves the file off disk, so neither this `Cache-Control` nor the
        // CSP header would ever reach a visitor (HOS-74).
        expect(readPage(page)).not.toMatch(/export\s+const\s+prerender/);
    });
});
