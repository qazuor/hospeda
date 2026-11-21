/**
 * HOS-2410 US-10 (AC-35 to AC-37) — the Markdown export for flyers.
 *
 * AC-35 runs the real command (`pnpm --filter @repo/help export`, which is what
 * `hops help export` spawns) against the committed index and reads its stdout.
 * The argument and file contracts (AC-36, AC-37) run in-process through
 * `runHelpExport`, so each case is cheap and can inspect what was written.
 *
 * @module test/export
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HelpArticle } from '../src/article.schema';
import { HELP_RELATED_HEADINGS, HELP_SECTION_HEADINGS, HELP_SECTION_KEYS } from '../src/constants';
import { renderHelpExport } from '../src/export/render-export';
import { runHelpExport } from '../src/export/run-export';
import { HELP_ARTICLES } from '../src/help-index';
import { parseHelpTokens } from '../src/tokens';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SITE = 'https://example.test';
const VALID = 'host, venue, experience, provider, partner, all';

/** Runs the export in-process, capturing both streams. */
function runInProcess({
    argv,
    cwd = process.cwd(),
    articles = HELP_ARTICLES
}: {
    argv: string[];
    cwd?: string;
    articles?: readonly HelpArticle[];
}) {
    let stdout = '';
    let stderr = '';
    const code = runHelpExport({
        argv,
        articles,
        stdout: (text) => {
            stdout += text;
        },
        stderr: (text) => {
            stderr += text;
        },
        cwd
    });
    return { code, stdout, stderr };
}

/** Every text of an article that may hold tokens. */
function textsOf(article: HelpArticle): string[] {
    const { canDo, howTo, expect, notExpect, troubleshooting } = article.sections;
    return [canDo, ...howTo.steps, howTo.after, expect, notExpect, troubleshooting];
}

describe('help export (HOS-2410 US-10)', () => {
    describe('AC-35 the venue bundle from the real command', () => {
        const venue = HELP_ARTICLES.filter((article) => article.audiences.includes('venue'));
        let stdout = '';

        beforeEach(() => {
            if (stdout !== '') return;
            stdout = execFileSync(
                'pnpm',
                [
                    '--silent',
                    '--filter',
                    '@repo/help',
                    'export',
                    '--audience',
                    'venue',
                    '--site-url',
                    SITE
                ],
                { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, CI: 'true' } }
            );
        }, 60_000);

        it('is one Markdown document that starts with the audience title', () => {
            expect(stdout.startsWith('# Ayuda Hospeda — Comer y salir\n\n## ')).toBe(true);
            expect(stdout.match(/^# /gm)).toHaveLength(1);
        });

        it('has one ## per venue article, sorted by title (es collation)', () => {
            const collator = new Intl.Collator('es');
            const expected = venue
                .map((article) => article.title)
                .sort((left, right) => collator.compare(left, right));
            const headings = [...stdout.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
            expect(headings.length).toBeGreaterThan(0);
            expect(headings).toEqual(expected);
        });

        it('gives every article its five sections in order, then its related list', () => {
            const headings = HELP_SECTION_HEADINGS.es;
            const blocks = stdout.split(/^## /m).slice(1);
            expect(blocks).toHaveLength(venue.length);
            for (const block of blocks) {
                const found = [...block.matchAll(/^### (.+)$/gm)].map((match) => match[1]);
                expect(found).toEqual([
                    ...HELP_SECTION_KEYS.map((key) => headings?.[key]),
                    HELP_RELATED_HEADINGS.es
                ]);
                expect(block).toMatch(/### Relacionados\n\n- «/);
            }
        });

        it('makes every link absolute under the site URL and leaves no token', () => {
            const urls = [...stdout.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1] ?? '');
            expect(urls.length).toBeGreaterThan(0);
            for (const url of urls) {
                expect(url.startsWith(`${SITE}/es/`)).toBe(true);
            }
            expect(stdout).not.toContain('{{');
        });

        it('reads every {{limit:*}} as "según tu plan"', () => {
            const limits = venue
                .flatMap(textsOf)
                .flatMap((text) => parseHelpTokens({ text }).tokens)
                .filter((token) => token.kind === 'limit');
            expect(limits.length).toBeGreaterThan(0);
            expect(stdout.split('según tu plan').length - 1).toBe(limits.length);
        });
    });

    describe('rendering', () => {
        it('escapes brackets in a link label', () => {
            const base = HELP_ARTICLES.find((article) => article.id === 'addons');
            if (base === undefined) throw new Error('no addons article');
            const article = {
                ...base,
                sections: { ...base.sections, canDo: 'Ir a {{link:addons|Comprar [ya]}}.' }
            };
            const out = renderHelpExport({ articles: [article], audience: 'all', siteUrl: SITE });
            expect(out).toContain(`[Comprar \\[ya\\]](${SITE}/es/mi-cuenta/complementos/)`);
        });

        it('leaves out the related heading when no related article is in the bundle', () => {
            const base = HELP_ARTICLES.find((article) => article.id === 'addons');
            if (base === undefined) throw new Error('no addons article');
            const out = renderHelpExport({ articles: [base], audience: 'all', siteUrl: SITE });
            expect(out).not.toContain('### Relacionados');
            expect(out).toContain('### Problemas comunes');
        });

        it('nests a section ### under the export ### and drops its explicit id', () => {
            const out = renderHelpExport({
                articles: HELP_ARTICLES,
                audience: 'host',
                siteUrl: SITE
            });
            expect(out).toContain('#### Un día sincronizado no se puede liberar\n');
            expect(out).not.toContain('{#');
        });

        it('points an editor section link at the list page of its vertical', () => {
            const out = renderHelpExport({
                articles: HELP_ARTICLES,
                audience: 'host',
                siteUrl: SITE
            });
            expect(out).toContain(`[Calendario](${SITE}/es/mi-cuenta/propiedades/)`);
            expect(out).not.toContain('/editar/');
        });

        it('writes an article reference as the target title in «»', () => {
            const out = renderHelpExport({
                articles: HELP_ARTICLES,
                audience: 'all',
                siteUrl: SITE
            });
            expect(out.startsWith('# Ayuda Hospeda — Todas las guías\n')).toBe(true);
            expect(out.match(/^## /gm)).toHaveLength(HELP_ARTICLES.length);
            expect(out).toContain('«Ver las reseñas de mis publicaciones»');
        });
    });

    describe('AC-36 a bad or missing audience', () => {
        it.each([
            [['--audience', 'tourist', '--site-url', SITE]],
            [['--site-url', SITE]]
        ])('exits 1 with the valid audiences and writes nothing (%j)', (argv) => {
            const result = runInProcess({ argv });
            expect(result.code).toBe(1);
            expect(result.stdout).toBe('');
            expect(result.stderr).toContain(VALID);
        });

        it.each([
            [['--audience', 'venue']],
            [['--audience', 'venue', '--site-url', 'not a url']],
            [['--audience', 'venue', '--site-url', SITE, '--bogus']]
        ])('exits 1 without a usable site URL or with an unknown flag (%j)', (argv) => {
            const result = runInProcess({ argv });
            expect(result.code).toBe(1);
            expect(result.stdout).toBe('');
        });
    });

    describe('site URL and empty audiences', () => {
        it.each([
            [`${SITE}/?ref=flyer`],
            [`${SITE}#top`],
            [`${SITE}/?`]
        ])('exits 1 with a clear message for a site URL with a query or fragment (%s)', (url) => {
            const result = runInProcess({ argv: ['--audience', 'venue', '--site-url', url] });
            expect(result.code).toBe(1);
            expect(result.stdout).toBe('');
            expect(result.stderr).toContain('must not carry a query (?) or a fragment (#)');
        });

        it('accepts a site URL with a path', () => {
            const result = runInProcess({
                argv: ['--audience', 'venue', '--site-url', `${SITE}/base`]
            });
            expect(result.code).toBe(0);
            expect(result.stdout).toContain(`](${SITE}/base/es/`);
        });

        it('exits 1 and writes nothing when the audience has no article', () => {
            const hostOnly = HELP_ARTICLES.filter(
                (article) => !article.audiences.includes('partner')
            );
            const result = runInProcess({
                argv: ['--audience', 'partner', '--site-url', SITE],
                articles: hostOnly
            });
            expect(result.code).toBe(1);
            expect(result.stdout).toBe('');
            expect(result.stderr).toContain('no article is written for the audience "partner"');
        });
    });

    describe('AC-37 --out', () => {
        let dir = '';

        beforeEach(() => {
            dir = mkdtempSync(join(tmpdir(), 'help-export-'));
        });

        afterEach(() => {
            rmSync(dir, { recursive: true, force: true });
        });

        it('writes the whole document to the file, relative to the cwd, and nothing to stdout', () => {
            const result = runInProcess({
                argv: ['--audience', 'venue', '--site-url', SITE, '--out', 'venue.md'],
                cwd: dir
            });
            expect(result.code).toBe(0);
            expect(result.stdout).toBe('');
            expect(readFileSync(join(dir, 'venue.md'), 'utf8')).toBe(
                renderHelpExport({ articles: HELP_ARTICLES, audience: 'venue', siteUrl: SITE })
            );
            expect(readdirSync(dir)).toEqual(['venue.md']);
        });

        it('writes nothing, and leaves no temp file, when the target cannot be replaced', () => {
            // Arrange: the target is a directory, so the final rename fails.
            mkdirSync(join(dir, 'taken'));

            // Act
            const result = runInProcess({
                argv: ['--audience', 'venue', '--site-url', SITE, '--out', join(dir, 'taken')],
                cwd: dir
            });

            // Assert
            expect(result.code).toBe(1);
            expect(readdirSync(dir)).toEqual(['taken']);
            expect(readdirSync(join(dir, 'taken'))).toEqual([]);
        });

        it('writes nothing when the directory does not exist', () => {
            const target = join(dir, 'missing', 'venue.md');
            const result = runInProcess({
                argv: ['--audience', 'venue', '--site-url', SITE, '--out', target]
            });
            expect(result.code).toBe(1);
            expect(existsSync(target)).toBe(false);
        });
    });
});
