/**
 * @file cacheable-responses-declare-tags.test.ts
 * @description Static guard: no source file may declare a response
 * shared-cacheable without also producing the cache tags that purge it
 * (HOS-369 W1-1).
 *
 * Why a guard and not a review habit: the purge is moving from
 * `purge_everything` to purge-by-tag, so the cost of forgetting changes shape.
 * Today an untagged cacheable response is harmless because every write flushes
 * the whole zone. After W1-1 it is content that no write can invalidate until
 * its TTL expires — and nothing anywhere reports it. That is the exact profile
 * of a defect that ships and survives: silent, delayed, and invisible to every
 * test that only asserts the header is present.
 *
 * The scan covers ALL of `src/`, not just `src/pages`. A guard scoped to pages
 * certifies the page, not the RESPONSE — the WB0-7 incident (a layout baking
 * visitor PII into pages a page-scoped guard had certified as session-blind)
 * is the same mistake one level up, and it cost a whole wave to notice.
 *
 * WHAT THIS GUARD DOES NOT SEE, stated so nobody mistakes it for total coverage:
 *
 *   - Its granularity is the FILE, not the response. A file that writes two
 *     different `Cache-Control` values passes as soon as it produces tags for
 *     one of them. `src/middleware.ts` is exactly that case today: it sets an
 *     immutable header on `/_image` (which needs no tag — the transform is
 *     content-addressed by its query string, same reasoning as the `og.ts`
 *     exemption) and separately writes `Cache-Tag` at Step 11, so it passes on
 *     the second while the first is simply never examined.
 *   - It reads source text, so a `Cache-Control` assembled at runtime from
 *     pieces that never appear next to the header name is invisible to it.
 *   - It matches on the header NAME being adjacent to its value, so a response
 *     built as `new Response(body, { headers: SOME_SHARED_CONST })` matches
 *     nothing and is classified as harmless. That is not hypothetical: it is
 *     the shape of `SITEMAP_RESPONSE_HEADERS` (`src/lib/seo/sitemap-xml.ts`),
 *     which carries a tag today only because it was found and fixed by hand. A
 *     future copy of that pattern without one would be invisible here.
 *
 * @module test/static-guards/cacheable-responses-declare-tags
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    classifyCacheControl,
    producesCacheTags,
    stripComments,
    violatesTagRule
} from './cacheable-responses-declare-tags';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/**
 * Files allowed to write a cacheable `Cache-Control` without producing tags.
 *
 * Every entry must be load-bearing: removing it has to make the guard fail. The
 * honesty test below asserts exactly that, so an exemption that protects nothing
 * cannot quietly accumulate here and turn the guard fail-open.
 */
const EXEMPT: ReadonlyArray<{ readonly file: string; readonly why: string }> = [
    {
        file: 'pages/api/og.ts',
        why: 'Content-addressed by construction: every input that changes the image (title, description, type, subtitle, rating, image URL, seed) is a query param, and the query string is part of the Cloudflare cache key. An edit that changes the card also changes its URL, so the old entry is never served for the new content — there is nothing for a purge to invalidate.'
    }
];

/** Recursively collect every scannable file under `dir`. */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
    return files;
}

const ALL_FILES = collectFiles(WEB_SRC);
const EXEMPT_PATHS = new Set(EXEMPT.map((entry) => path.join(WEB_SRC, entry.file)));

describe('cacheable responses declare cache tags', () => {
    it('scans a non-trivial number of files (the scan itself is not vacuous)', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('finds at least one genuinely cacheable response to police', () => {
        // If this ever reaches zero, the guard has stopped watching anything —
        // which would let every assertion below pass on an empty set.
        const cacheable = ALL_FILES.filter(
            (file) =>
                classifyCacheControl({ source: fs.readFileSync(file, 'utf8') }).kind === 'cacheable'
        );
        expect(cacheable.length).toBeGreaterThan(0);
    });

    it('no file marks a response shared-cacheable without producing purge tags', () => {
        const violations = ALL_FILES.filter((file) => {
            if (EXEMPT_PATHS.has(file)) return false;
            return violatesTagRule({ source: fs.readFileSync(file, 'utf8') });
        }).map((file) => path.relative(WEB_SRC, file));

        expect(violations).toEqual([]);
    });

    it('every exemption is load-bearing — removing it makes the guard fail', () => {
        for (const entry of EXEMPT) {
            const full = path.join(WEB_SRC, entry.file);
            expect(fs.existsSync(full), `exempt file no longer exists: ${entry.file}`).toBe(true);
            expect(
                violatesTagRule({ source: fs.readFileSync(full, 'utf8') }),
                `exemption for ${entry.file} protects nothing and should be deleted`
            ).toBe(true);
        }
    });
});

describe('detector behaviour (non-vacuity)', () => {
    const CACHEABLE_NO_TAGS = `
        Astro.response.headers.set('Cache-Control', 'public, s-maxage=300');
    `;
    const CACHEABLE_WITH_TAGS = `
        applyCacheHeaders({ locals: Astro.locals, headers: Astro.response.headers,
            cacheable: true, tags: [CACHE_TAG_COLLECTIONS.accommodation] });
    `;

    it('FAILS a cacheable response with no tags', () => {
        expect(violatesTagRule({ source: CACHEABLE_NO_TAGS })).toBe(true);
    });

    it('PASSES the same response once it goes through applyCacheHeaders', () => {
        expect(violatesTagRule({ source: CACHEABLE_WITH_TAGS })).toBe(false);
    });

    it('PASSES a private response, which needs no tag', () => {
        const source = `Astro.response.headers.set('Cache-Control', 'private, no-cache');`;
        expect(classifyCacheControl({ source }).kind).toBe('private');
        expect(violatesTagRule({ source })).toBe(false);
    });

    it('treats `private` as decisive even alongside s-maxage', () => {
        const source = `headers.set('Cache-Control', 'private, s-maxage=300');`;
        expect(classifyCacheControl({ source }).kind).toBe('private');
    });

    it('catches the Response-init object form, not only headers.set', () => {
        const source = `return new Response(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });`;
        expect(violatesTagRule({ source })).toBe(true);
    });

    it('catches a template literal value', () => {
        const source =
            "headers.set('Cache-Control', `s-maxage=${TTL}, stale-while-revalidate=${SWR}`);";
        expect(violatesTagRule({ source })).toBe(true);
    });

    it('assumes an opaque value needs a tag rather than skipping it', () => {
        // "I cannot tell" must resolve to "police it". The opposite default is
        // how a fail-open hides inside an escape hatch.
        const source = `headers.set('Cache-Control', resolveSomethingDynamic);`;
        expect(classifyCacheControl({ source }).kind).toBe('cacheable');
        expect(violatesTagRule({ source })).toBe(true);
    });

    it('does not read prose as code, in all three comment forms', () => {
        const jsBlock = `/* headers.set('Cache-Control', 'public, s-maxage=300') */`;
        const jsLine = `// headers.set('Cache-Control', 'public, s-maxage=300')`;
        const html = `<!-- headers.set('Cache-Control', 'public, s-maxage=300') -->`;

        for (const source of [jsBlock, jsLine, html]) {
            expect(classifyCacheControl({ source }).kind).toBe('none');
            expect(violatesTagRule({ source })).toBe(false);
        }
    });

    it('strips HTML comments, the form .astro templates use and reviewers forget', () => {
        expect(stripComments({ source: `<!-- Cache-Control -->x` }).includes('Cache-Control')).toBe(
            false
        );
    });

    it('recognizes every tag producer the app actually uses', () => {
        for (const source of [
            'applyCacheHeaders({})',
            'declareCacheTags({})',
            'serializeCacheTags({})',
            "headers.set('Cache-Tag', value)",
            'headers.set(CACHE_TAG_HEADER_NAME, value)'
        ]) {
            expect(producesCacheTags({ source }), source).toBe(true);
        }
    });
});
