/**
 * @file home-cache.test.ts
 * @description HOS-369 W2-1 — the home page opts into the edge cache.
 *
 * The `home` tag was already being PURGED before anything emitted it:
 * `entity-tag-mapper.ts` adds it to every accommodation write (the home shows
 * featured accommodations) and `platform-settings.service.ts` purges it
 * alongside `site-config`. Until the page declared it, those purges evicted
 * nothing — a silent no-op. These assertions pin the emitter side so the two
 * halves cannot drift apart again.
 *
 * `.astro` frontmatter cannot render in Vitest, so these are source-based —
 * the established pattern here (see `alojamiento-detail-cache.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOME_PAGE = resolve(__dirname, '../../src/pages/[lang]/index.astro');

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

describe('home page — edge cacheability (HOS-369 W2-1)', () => {
    const source = readFileSync(HOME_PAGE, 'utf8');

    it('opts into the edge cache through applyCacheHeaders', () => {
        // Not by setting `Cache-Control` itself — that path is blocked by the
        // static guard, because it lets a page ship a cacheable response with
        // no purge tags.
        expect(source).toContain('applyCacheHeaders({');
    });

    it('declares the `home` tag, which the purge side already emits', () => {
        const args = callArgsOf(source, 'applyCacheHeaders');
        expect(args).toContain('CACHE_TAG_HOME');
    });

    it('is cacheable unconditionally', () => {
        // Unlike the listings and the accommodation detail, the home takes no
        // filter parameters and has no visitor-specific render to guard
        // against, so there is no condition to gate on. If a future change
        // introduces one, this assertion is the reminder to add the gate.
        const args = callArgsOf(source, 'applyCacheHeaders');
        expect(args).toMatch(/cacheable:\s*true/);
    });

    it('reads no session state, which is what makes the response shareable', () => {
        // Also enforced fail-closed for every page by
        // `cacheable-pages-are-session-blind.guard.test.ts`. Repeated here so a
        // reader of THIS file sees the precondition the caching depends on.
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });
});
