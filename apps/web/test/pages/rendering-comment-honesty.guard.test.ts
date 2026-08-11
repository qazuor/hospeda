/**
 * @fileoverview HOS-369 W2-7 guard: a page's `@rendering` comment must match
 * what the page actually does.
 *
 * Nineteen pages carried `@rendering SSR + ISR 24h`. Astro ISR is not used
 * anywhere in this app, and the real mechanism — a Cloudflare edge cache with
 * `s-maxage=300` and tag-based purge — has a TTL two orders of magnitude
 * shorter. Three of the nineteen were not cached at all, and one claimed
 * "no ISR — user profile may change" while opting into the cache on every
 * request.
 *
 * A comment promising a mechanism that does not exist is worse than no comment:
 * two reviewers already agreed with one of these instead of reading the code
 * (see the `destinos` filter-gate bug in #2630, cleared on exactly that basis).
 *
 * The check is derived in BOTH directions from the source — a page that claims
 * the edge cache must call `applyCacheHeaders`, and a page that disclaims it
 * must not. Neither half is a maintained list, so neither can rot silently.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages');

/** Every `.astro` page under `src/pages`, recursively. */
function astroPages(dir: string): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...astroPages(full));
        else if (entry.endsWith('.astro')) out.push(full);
    }
    return out;
}

const PAGES = astroPages(PAGES_ROOT).map((p) => ({
    path: relative(PAGES_ROOT, p),
    source: readFileSync(p, 'utf8')
}));

/** The leading JSDoc block, where `@rendering` lives. */
function headerComment(source: string): string {
    const start = source.indexOf('/**');
    if (start === -1) return '';
    const end = source.indexOf('*/', start);
    return end === -1 ? '' : source.slice(start, end);
}

/**
 * Whether the page actually CALLS `applyCacheHeaders`.
 *
 * Deliberately not `source.includes('applyCacheHeaders')`: the header comment
 * of an uncached page names the function while explaining that it is missing,
 * and a substring test reads that explanation as evidence of the opposite. This
 * guard reported exactly that on its first run — the prose was the only match.
 * So: skip the header, and require the call parenthesis.
 */
function callsApplyCacheHeaders(source: string): boolean {
    const header = headerComment(source);
    const body = header ? source.slice(source.indexOf(header) + header.length) : source;
    return /applyCacheHeaders\s*\(/.test(body);
}

const claimsEdgeCache = (header: string) =>
    /edge cache/i.test(header) && !/never (opts into the edge cache|edge-cached)/i.test(header);

const disclaimsEdgeCache = (header: string) =>
    /never (opts into the edge cache|edge-cached)/i.test(header);

describe('@rendering comments match reality (HOS-369 W2-7)', () => {
    it('walks a real set of pages — a broken glob must fail, not pass silently', () => {
        expect(PAGES.length).toBeGreaterThan(30);
        expect(PAGES.filter((p) => callsApplyCacheHeaders(p.source)).length).toBeGreaterThan(10);
    });

    it('no page claims ISR — this app has never used it', () => {
        const offenders = PAGES.filter((p) => /\bISR\b/.test(headerComment(p.source))).map(
            (p) => p.path
        );

        expect(
            offenders,
            `These headers promise Astro ISR, which this app does not use. The real mechanism is a Cloudflare edge cache with s-maxage=300 (not 24h) and tag-based purge: ${offenders.join(', ')}.`
        ).toEqual([]);
    });

    it('every page claiming the edge cache actually opts into it', () => {
        const liars = PAGES.filter(
            (p) => claimsEdgeCache(headerComment(p.source)) && !callsApplyCacheHeaders(p.source)
        ).map((p) => p.path);

        expect(
            liars,
            `These headers advertise the edge cache but never call applyCacheHeaders, so nothing they render is ever cached: ${liars.join(', ')}.`
        ).toEqual([]);
    });

    it('every page disclaiming the edge cache really stays out of it', () => {
        // The reverse direction matters just as much: `publicaciones/autor/`
        // claimed "no ISR — user profile may change" while calling
        // applyCacheHeaders on every request. A one-directional check would
        // have passed it.
        const liars = PAGES.filter(
            (p) => disclaimsEdgeCache(headerComment(p.source)) && callsApplyCacheHeaders(p.source)
        ).map((p) => p.path);

        expect(
            liars,
            `These headers say the page is never edge-cached, but it calls applyCacheHeaders: ${liars.join(', ')}.`
        ).toEqual([]);
    });
});
