/**
 * @file public-redirect-paths.guard.test.ts
 * @description Every path exempted from the `/mi-cuenta` login gate must be a
 * pure redirect and nothing else (HOS-1156).
 *
 * ## Why this exists
 *
 * `PUBLIC_REDIRECT_PATHS` punches a hole in the only automatic authentication
 * boundary this app has. The hole is justified — a retired URL that holds
 * nothing but a 301 should not demand a login before revealing that its
 * destination no longer needs one — and it is justified ONLY while the page
 * behind it really holds nothing else.
 *
 * The dangerous edit is not adding a bad entry today; it is a page that is a
 * redirect today and grows a body next year, under a path whose `/mi-cuenta`
 * prefix makes every reader assume it is protected. Nothing would fail. This
 * guard is what fails.
 *
 * ## What "pure redirect" means here
 *
 * The page's frontmatter ends in `Astro.redirect(...)` (or a bare 404
 * `Response`), and it renders no template: no layout, no component, no session
 * read. Anything richer means the exemption is now un-protecting real content.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PUBLIC_REDIRECT_PATHS } from '@/lib/routes';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/**
 * Every `.astro` file that serves a path at or under `pathAfterLocale`.
 *
 * Resolved from the filesystem rather than listed, so a new page added under an
 * exempted prefix is covered the day it appears — which is the case this guard
 * is really about.
 */
function pagesUnder(pathAfterLocale: string): readonly string[] {
    const dir = resolve(PAGES_DIR, pathAfterLocale.replace(/^\//, ''));
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        if (statSync(full).isFile() && entry.endsWith('.astro')) {
            found.push(full);
        }
    }

    return found;
}

describe('HOS-1156 — every login-gate exemption is a pure redirect', () => {
    it('has exemptions to check at all', () => {
        // Non-vacuity: an empty list would satisfy every loop below.
        expect(PUBLIC_REDIRECT_PATHS.length).toBeGreaterThan(0);
    });

    for (const exemptedPath of PUBLIC_REDIRECT_PATHS) {
        const files = pagesUnder(exemptedPath);

        it(`${exemptedPath} resolves to at least one page file`, () => {
            // A path that matches no file means the exemption outlived the page
            // it was granted for, and is now a hole with nothing behind it.
            expect(files.length).toBeGreaterThan(0);
        });

        for (const file of files) {
            const name = file.slice(PAGES_DIR.length + 1);
            const src = readFileSync(file, 'utf8');

            it(`${name} redirects and nothing else`, () => {
                expect(src).toContain('Astro.redirect(');
                expect(src).toContain('export const prerender = false;');
            });

            it(`${name} renders no template`, () => {
                // The frontmatter fence closes the file: a pure redirect page has
                // nothing after the second `---`. Anything there is markup, which
                // is content this exemption would be un-protecting.
                const closingFence = src.indexOf('---', src.indexOf('---') + 3);
                expect(closingFence).toBeGreaterThan(-1);
                expect(src.slice(closingFence + 3).trim()).toBe('');
            });

            it(`${name} reads no session and no data`, () => {
                const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
                expect(body).not.toContain('Astro.locals.user');
                expect(body).not.toContain('Layout');
                expect(body).not.toMatch(/\bawait\b/);
            });
        }
    }
});
