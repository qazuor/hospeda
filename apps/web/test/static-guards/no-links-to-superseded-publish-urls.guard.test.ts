/**
 * @file no-links-to-superseded-publish-urls.guard.test.ts
 * @description No source file may link to a URL HOS-1156 retired (AC-18).
 *
 * ## Why a guard and not five repointed call sites
 *
 * The call sites were repointed in the same change; that is the fix. This is
 * what stops the SIXTH one — added next month by someone who reads a 301 as a
 * working link — from riding the redirect until its target moves again.
 *
 * That is not hypothetical, it is the history of this issue. HOS-1032 turned
 * `/publicar-restaurante/` and `/publicar-experiencia/` into 301s and repointed
 * eighteen call sites at the redirects' targets. Every one of those edits was
 * mechanically correct. One of them was the header's "Publicar" button, and the
 * target was a SALES page — so the button stopped leading to publishing, and
 * nothing failed, because a link to a redirect looks exactly like a link.
 *
 * **A link to a redirect is a link whose destination somebody else can move.**
 *
 * ## What is exempt, and why each one has to be
 *
 * - The four retired pages themselves. A redirect must name its own route.
 * - The sitemap's exclusion map, whose entire job is to classify retired URLs so
 *   the crawler is never handed one.
 * - This file.
 *
 * Nothing else. In particular the guard reads STRIPPED sources, so a comment
 * explaining a retirement — which several of these files carry, deliberately —
 * is neither a violation nor a way to hide one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

/**
 * The URLs this spec retired, as they appear inside a path string.
 *
 * Spelled without leading or trailing slashes because they are written both
 * ways: `buildUrl({ path: 'publicar/nueva' })` and `href="/es/publicar/nueva/"`.
 */
const SUPERSEDED_PATHS: ReadonlyArray<{ readonly path: string; readonly replacement: string }> = [
    { path: 'publicar/nueva', replacement: 'publicar' },
    { path: 'mi-cuenta/comercio/nuevo', replacement: 'publicar/{vertical page}' },
    { path: 'publicar-restaurante', replacement: 'publicar/gastronomia' },
    { path: 'publicar-experiencia', replacement: 'publicar/experiencias' }
];

/**
 * Files allowed to name a superseded URL, each for a stated reason.
 *
 * Paths are relative to `src/`. This list is the escape hatch, so it is short,
 * enumerated by hand, and every entry is a file that CANNOT do its job without
 * naming the retired URL.
 */
const EXEMPT: Readonly<Record<string, string>> = {
    'pages/[lang]/publicar/nueva.astro': 'The 301 itself — a redirect names its own route.',
    'pages/[lang]/publicar-restaurante/index.astro': 'The 301 itself.',
    'pages/[lang]/publicar-experiencia/index.astro': 'The 301 itself.',
    'pages/[lang]/mi-cuenta/comercio/nuevo/index.astro': 'The 301 itself.',
    'pages/[lang]/mi-cuenta/comercio/nuevo/[vertical].astro': 'The 301 itself.',
    'lib/seo/static-sitemap-pages.ts':
        'Classifies retired URLs as redirect-only so the sitemap never advertises one.',
    'lib/routes.ts': 'PUBLIC_REDIRECT_PATHS names the retired path it exempts from the login gate.'
};

/** Every source file the guard walks. */
function sourceFiles(dir: string): readonly string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...sourceFiles(full));
            continue;
        }
        if (/\.(ts|tsx|astro)$/.test(entry)) {
            found.push(full);
        }
    }

    return found;
}

/**
 * Source with block and line comments removed.
 *
 * A retirement is worth explaining in prose, and several of these files do
 * explain it. Stripping keeps that prose from failing the guard — and, more
 * importantly, from being a place to park a real link where the guard cannot see
 * it, since a commented-out link is not a link.
 */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('HOS-1156 AC-18 — nothing links to a superseded publish URL', () => {
    const files = sourceFiles(SRC_DIR);

    it('walks a realistic number of files', () => {
        // Non-vacuity: a broken walk would report a clean bill of health over an
        // empty set, which is the failure mode this whole class of guard has.
        expect(files.length).toBeGreaterThan(300);
    });

    it('every exemption still names a file that exists', () => {
        // An exemption for a deleted file is dead weight that quietly widens the
        // hatch if a new file ever takes that path.
        const relatives = new Set(files.map((file) => relative(SRC_DIR, file)));
        for (const exempt of Object.keys(EXEMPT)) {
            expect(relatives.has(exempt), `${exempt} is exempted but does not exist`).toBe(true);
        }
    });

    for (const { path, replacement } of SUPERSEDED_PATHS) {
        it(`no file links to /${path}/ (use /${replacement}/)`, () => {
            const offenders = files.filter((file) => {
                const rel = relative(SRC_DIR, file);
                if (EXEMPT[rel]) {
                    return false;
                }
                return stripComments(readFileSync(file, 'utf8')).includes(path);
            });

            expect(
                offenders.map((file) => relative(SRC_DIR, file)),
                `link(s) to the retired /${path}/ — repoint at /${replacement}/ rather than ` +
                    'riding the 301: a link to a redirect is a link whose destination somebody ' +
                    'else can move'
            ).toEqual([]);
        });
    }

    it('detects a violation when one is introduced', () => {
        // Reversion check: the guard is worth nothing unless it reports the exact
        // regression it exists to prevent. This is the shape a new call site
        // takes — a path string in a `buildUrl` call.
        const violating = "const url = buildUrl({ locale, path: 'publicar/nueva' });";
        expect(stripComments(violating)).toContain('publicar/nueva');
    });

    it('does not fire on a comment that merely mentions a retired URL', () => {
        const commented = '// moved off publicar/nueva by HOS-1156\nconst x = 1;';
        expect(stripComments(commented)).not.toContain('publicar/nueva');
    });
});
