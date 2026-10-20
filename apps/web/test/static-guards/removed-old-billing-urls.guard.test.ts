/**
 * @file removed-old-billing-urls.guard.test.ts
 * @description Static half of TEST:B13a:22 (AC:B13a:20, AC:B13a:21): the web
 * pages of the old billing are gone, and no web source links to them.
 *
 * TEST:B13a:22 itself is an e2e (`apps/e2e/tests/guest/guest-09-old-billing-surfaces.spec.ts`):
 * it asks a running build for each removed URL and expects a 404, and reads the
 * rendered pages for links to them. This file is the fast, always-on twin of
 * the "nothing links to them" half, and it adds the half an e2e cannot see —
 * that the page FILES are gone, not merely unreachable.
 *
 * A link to a removed page is a 404 whose only witness is whoever clicks it.
 * The path strings are searched as text, not as symbols: a `buildUrl({ path })`
 * argument, an absolute href and a redirect target all spell the path the same
 * way.
 *
 * ## What it does not claim
 *
 * It matches source text, so it cannot see a URL assembled from fragments. And
 * it is scoped to `apps/web`: e-mail templates are covered by
 * `test/integration/email-link-targets.guard.test.ts`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(WEB_ROOT, '../..');
const PAGES = join(WEB_ROOT, 'src/pages/[lang]');

/** The page directories AC:B13a:20 and AC:B13a:21 remove, relative to `[lang]`. */
const REMOVED_PAGE_DIRS: readonly string[] = [
    'mi-cuenta/addons',
    'mi-cuenta/canjear',
    'partners/checkout',
    'planes/aliados'
];

/** The old MercadoPago return pages, removed with the checkout they returned to. */
const REMOVED_PAGE_FILES: readonly string[] = [
    'suscriptores/checkout/success.astro',
    'suscriptores/checkout/failure.astro',
    'suscriptores/checkout/pending.astro'
];

/** The URL paths no web source may link to. */
const REMOVED_PATHS: readonly string[] = [
    ...REMOVED_PAGE_DIRS,
    'suscriptores/checkout/success',
    'suscriptores/checkout/failure',
    'suscriptores/checkout/pending'
];

/** Prose about the removed URL rather than a link to it. */
const COMMENT_LINE = /^\s*(\*|\/\/|\/\*)/;

/**
 * Every tracked `apps/web` source naming `path` on a non-comment line, as
 * `file:line`. Tests are excluded: asserting a removed URL is how they guard it.
 */
function linesNaming(path: string): readonly string[] {
    let out: string;
    try {
        out = execFileSync(
            'git',
            [
                'grep',
                '-n',
                '--fixed-strings',
                path,
                '--',
                'apps/web/src/**/*.ts',
                'apps/web/src/**/*.tsx',
                'apps/web/src/**/*.astro',
                'apps/web/src/**/*.mjs',
                'apps/web/astro.config.mjs',
                'apps/web/scripts/**/*.ts',
                'apps/web/scripts/**/*.mjs',
                'apps/web/scripts/**/*.json'
            ],
            { cwd: REPO_ROOT, encoding: 'utf8' }
        );
    } catch (error) {
        // `git grep` exits 1 with no output when nothing matches — the good case.
        if ((error as { status?: number }).status === 1) return [];
        throw error;
    }
    return out
        .split('\n')
        .filter(Boolean)
        .filter((line) => {
            const firstColon = line.indexOf(':');
            const secondColon = line.indexOf(':', firstColon + 1);
            const file = line.slice(0, firstColon);
            if (/\.test\.(ts|tsx)$/.test(file) || file.includes('/__tests__/')) return false;
            return !COMMENT_LINE.test(line.slice(secondColon + 1));
        })
        .map((line) => line.split(':').slice(0, 2).join(':'));
}

describe('TEST:B13a:22 (static half) — the old billing web pages are gone', () => {
    it.each(REMOVED_PAGE_DIRS)('src/pages/[lang]/%s does not exist', (dir) => {
        expect(existsSync(join(PAGES, dir))).toBe(false);
    });

    it.each(REMOVED_PAGE_FILES)('src/pages/[lang]/%s does not exist', (file) => {
        expect(existsSync(join(PAGES, file))).toBe(false);
    });

    it('checks a real pages tree — a page that stays is found', () => {
        expect(existsSync(join(PAGES, 'mi-cuenta/suscripcion/index.astro'))).toBe(true);
        expect(existsSync(join(PAGES, 'suscriptores/checkout/index.astro'))).toBe(true);
    });
});

describe('TEST:B13a:22 (static half) — no web source links to a removed page', () => {
    it.each(REMOVED_PATHS)('nothing links to %s', (path) => {
        const found = linesNaming(path);
        expect(found, `These lines link to a removed page:\n  ${found.join('\n  ')}`).toEqual([]);
    });

    it('actually searches the tree — a live path is found', () => {
        // Without this, a `git grep` that silently matched nothing would make
        // every case above pass over an empty result.
        expect(linesNaming('mi-cuenta/suscripcion').length).toBeGreaterThan(0);
    });
});
