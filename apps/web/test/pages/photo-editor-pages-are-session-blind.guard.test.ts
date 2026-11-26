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
 * Second requirement (AC-24, SSR helpers): the pages delegate to
 * `resolveEditorPage` / `resolveListingEditorPage`, so the guard also scans
 * every local module those pages import, transitively, under `src/lib`
 * (comments excluded). On those helpers it forbids only the PHOTO CAP data: the
 * allowance, its API client and the effective set. Their session reads
 * (`Astro.locals.user`, the forwarded cookie) are ALLOWED: they do the
 * authentication, ownership and navigation-state checks the account area
 * needs, which the general guard exempts by design. AC-24's photo-specific
 * promise is only "no SSR cap read", so the session checks stay scoped to the
 * two pages themselves.
 *
 * Traversal stops at the `lib/api/endpoints*` and `lib/api/transforms` barrels: they DEFINE every API
 * client, so scanning them would flag the definition. What matters is a
 * helper importing or calling the allowance client, and that is caught in the
 * helper's own text.
 *
 * What it does not see: reads through a module outside `src/lib` or reached by
 * a dynamic import.
 *
 * @module test/pages/photo-editor-pages-are-session-blind.guard
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

/** Photo cap reads that no SSR helper on the photo pages' path may perform. */
const FORBIDDEN_CAP_READS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
    { name: 'the photo allowance', pattern: /allowance/i },
    { name: 'the listing photo API client', pattern: /listing-photo-api|\blistingPhotoApi\b/i },
    {
        name: 'the effective set',
        pattern: /effective-?set|\bresolveListingAccess\b|\bgetMyPlan\b/i
    }
];

const SRC_ROOT = join(__dirname, '../../src');
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** Resolves a local import specifier to a file under `src`, or null. */
function resolveLocalImport(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = join(SRC_ROOT, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
        if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return candidate;
    }
    return null;
}

/** Every `src/lib` module reachable from `entries` by local imports. */
function collectLibClosure(entries: readonly string[]): ReadonlyMap<string, string> {
    const seen = new Map<string, string>();
    const queue = [...entries];
    while (queue.length > 0) {
        const file = queue.pop() as string;
        const source = stripComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(IMPORT_RE)) {
            const target = resolveLocalImport(file, match[1] as string);
            if (!target || seen.has(target)) continue;
            const rel = target.slice(SRC_ROOT.length + 1);
            if (!rel.startsWith('lib/') || /^lib\/api\/(endpoints|transforms)/.test(rel)) continue;
            seen.set(target, source);
            queue.push(target);
        }
    }
    return new Map([...seen.keys()].map((f) => [f, readFileSync(f, 'utf8')]));
}

/** Names of the cap reads found in `source`. */
function findCapReads(source: string): readonly string[] {
    const code = stripComments(source);
    return FORBIDDEN_CAP_READS.filter(({ pattern }) => pattern.test(code)).map(({ name }) => name);
}

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

    it('walks the real SSR helper chain (non-vacuous traversal)', () => {
        const closure = collectLibClosure(PHOTO_EDITOR_PAGES.map((p) => join(PAGES_ROOT, p)));
        const names = [...closure.keys()].map((f) => f.slice(SRC_ROOT.length + 1));
        expect(names).toContain('lib/editor/resolve-editor-page.ts');
        expect(names).toContain('lib/editor/resolve-listing-editor-page.ts');
    });

    it('no SSR helper reachable from the photo pages reads the photo cap', () => {
        const closure = collectLibClosure(PHOTO_EDITOR_PAGES.map((p) => join(PAGES_ROOT, p)));
        const offenders = [...closure.entries()]
            .map(([file, source]) => ({
                file: file.slice(SRC_ROOT.length + 1),
                reads: findCapReads(source)
            }))
            .filter(({ reads }) => reads.length > 0);
        expect(offenders).toEqual([]);
    });

    it('cap-read detection flags an allowance call in a helper but not auth reads', () => {
        expect(findCapReads('await listingPhotoAllowanceApi.getAllowance({ id });')).toEqual([
            'the photo allowance'
        ]);
        expect(findCapReads("import { x } from '@/lib/api/listing-photo-api';")).toEqual([
            'the listing photo API client'
        ]);
        expect(
            findCapReads('const u = astro.locals.user; cookie = headers.get("cookie");')
        ).toEqual([]);
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
