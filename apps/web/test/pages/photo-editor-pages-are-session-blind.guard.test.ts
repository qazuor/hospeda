/**
 * @file photo-editor-pages-are-session-blind.guard.test.ts
 * @description Focused guard for HOS-2495 (AC-24). The two photo editor pages
 * render the shared `PhotoSection` island, and the island fetches its own cap
 * (`photo-allowance`) in the browser. Neither page may read the session, the
 * allowance or the effective set while it renders on the server.
 *
 * `cacheable-pages-are-session-blind.guard.test.ts` exempts everything under
 * `[lang]/mi-cuenta/` because the account area is personalized by design, so it
 * cannot notice a page there growing a server-side allowance read. This guard
 * is the narrow, second requirement: it keeps that exemption intact and only
 * pins what the two `fotos.astro` pages must not do.
 *
 * What it does not see: a read hidden behind a helper that these pages already
 * call (`resolveEditorPage`, `resolveListingEditorPage`). It checks the text of
 * the two pages, comments excluded.
 *
 * @module test/pages/photo-editor-pages-are-session-blind.guard
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = join(__dirname, '../../src/pages');

/** The two photo editor pages, relative to `src/pages`. */
const PHOTO_EDITOR_PAGES = [
    '[lang]/mi-cuenta/propiedades/[id]/editar/fotos.astro',
    '[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/fotos.astro'
] as const;

/** What a server-rendered photo page must never mention, with the reason. */
const FORBIDDEN: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
    { name: 'Astro.locals (session user)', pattern: /\bAstro\.locals\b/ },
    {
        name: 'the request cookie',
        pattern: /\bcookieHeader\b|\bAstro\.cookies\b|headers\.get\(\s*['"]cookie['"]/i
    },
    { name: 'a session read', pattern: /\bparseSessionUser\b|\bgetSession\b|\bsession\b/i },
    { name: 'the photo allowance', pattern: /allowance/i },
    {
        name: 'the effective set',
        pattern: /effective-?set|\bresolveListingAccess\b|\bgetMyPlan\b|\bentitlements?\b/i
    }
];

/** Removes block, line and HTML comments so prose cannot trip (or hide) a read. */
function stripComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/** The names of every forbidden read found in `source`. */
function findServerSideReads(source: string): readonly string[] {
    const code = stripComments(source);
    return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ name }) => name);
}

describe('photo editor pages stay session-blind (HOS-2495, AC-24)', () => {
    it.each(PHOTO_EDITOR_PAGES)('%s reads no session, allowance or effective set', (page) => {
        // Arrange
        const source = readFileSync(join(PAGES_ROOT, page), 'utf8');

        // Act
        const reads = findServerSideReads(source);

        // Assert
        expect(reads).toEqual([]);
    });

    it.each([
        [
            'Astro.locals.user in the frontmatter',
            'const user = Astro.locals.user;',
            ['Astro.locals (session user)']
        ],
        [
            'a forwarded cookie',
            'fetch(url, { headers: { cookie: cookieHeader } });',
            ['the request cookie']
        ],
        [
            'an allowance fetch',
            'const allowance = await getListingPhotoAllowance({ id });',
            ['the photo allowance']
        ],
        [
            'an effective set read',
            'const set = await resolveEffectiveSet({ userId });',
            ['the effective set']
        ],
        [
            'a prop carrying the cap',
            '<PhotoSection allowance={allowance} />',
            ['the photo allowance']
        ]
    ])('is not vacuous: flags %s', (_label, source, expected) => {
        expect(findServerSideReads(source)).toEqual(expected);
    });

    it('ignores prose in comments, which the pages use to explain the island', () => {
        const source =
            '/** its cap comes from `photo-allowance`, never Astro.locals */\n// session\n<!-- allowance -->';
        expect(findServerSideReads(source)).toEqual([]);
    });
});
