/**
 * @file listing-detail-no-glyph-icons.guard.test.ts
 * @description HOS-2579 §6.7, AC-20: the three listing detail pages draw their
 * icons with `@repo/icons`, never with an emoji or a text glyph.
 *
 * ## The set it scans
 *
 * - the three pages (`alojamientos`, `comer-y-salir`, `experiencias` `[slug].astro`);
 * - every file under `components/listing/**`;
 * - every component the pages import from `components/{accommodation,venue,experience}/**`,
 *   followed TRANSITIVELY through imports that stay inside those folders or
 *   `components/listing/**`.
 *
 * Out of the set, on purpose: owner editors and managers (`*Manager.client.tsx`,
 * `components/listing/editor/**`). They are panels, not the public ficha.
 *
 * ## What fails
 *
 * Any character in the emoji ranges U+1F300–U+1FAFF and U+2600–U+27BF; any of
 * `★ ☆ ♥ ♡ → ← ↗ ↘ ↑ ↓ ✕ ✓`; the entities `&#9733;` / `&#9829;`; and a CSS
 * `content:` holding one of those glyphs as a `\XXXX` escape.
 *
 * ## What it does NOT see, so a green run is not mistaken for more
 *
 * - **Comments are exempt.** Block comments, HTML comments and full-line `//`
 *   comments are stripped first, so prose may name the glyph it replaced. A
 *   trailing `// ★` after code on the same line is NOT stripped and fails.
 * - **i18n strings.** A glyph inside a locale JSON value reaches the page
 *   without appearing in any scanned file.
 * - **Imports it cannot resolve.** Only `@/components/...` and relative
 *   specifiers are followed. A component reached through a barrel `index.ts`
 *   outside the listed folders, or through a shared folder (`components/shared`,
 *   `components/maps`), is not scanned.
 * - **Runtime data.** A glyph in an owner-typed field renders as content.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const COMPONENTS = join(SRC, 'components');

const PAGES = [
    'pages/[lang]/alojamientos/[slug].astro',
    'pages/[lang]/comer-y-salir/[slug].astro',
    'pages/[lang]/experiencias/[slug].astro'
] as const;

/** Folders whose components are followed from the pages. */
const FOLLOWED_DIRS = ['accommodation', 'venue', 'experience', 'listing'].map((dir) =>
    join(COMPONENTS, dir)
);

/** Editors and managers: out of the public ficha. */
function isExcluded(file: string): boolean {
    const rel = relative(COMPONENTS, file).split(sep).join('/');
    return rel.startsWith('listing/editor/') || /Manager\.client\.tsx$/.test(rel);
}

const EXTENSIONS = ['', '.astro', '.tsx', '.ts', '/index.ts', '/index.tsx'] as const;

/** Resolves an import specifier to a file under `src`, or `null`. */
function resolveImport({ from, specifier }: { from: string; specifier: string }): string | null {
    let base: string;
    if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2));
    else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
    else return null;
    for (const ext of EXTENSIONS) {
        const candidate = `${base}${ext}`;
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
}

/** Import specifiers of a source file (static `import ... from '...'`). */
function importsOf(source: string): string[] {
    return [...source.matchAll(/^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)]
        .filter(([statement]) => !/^\s*import\s+type\s/.test(statement))
        .map(([, specifier]) => specifier as string);
}

function isFollowed(file: string): boolean {
    return FOLLOWED_DIRS.some((dir) => file.startsWith(`${dir}${sep}`)) && !isExcluded(file);
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.(astro|tsx?|css)$/.test(entry) ? [full] : [];
    });
}

/** The scanned set: pages, all of `components/listing/**`, and the followed imports. */
function collectScannedFiles(): string[] {
    const seen = new Set<string>();
    const queue: string[] = [
        ...PAGES.map((page) => join(SRC, page)),
        ...walk(join(COMPONENTS, 'listing')).filter((file) => !isExcluded(file))
    ];
    while (queue.length > 0) {
        const file = queue.shift() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
            const target = resolveImport({ from: file, specifier });
            if (target && isFollowed(target) && !seen.has(target)) queue.push(target);
        }
    }
    return [...seen].sort();
}

/** Removes block, HTML and full-line `//` comments. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

const FORBIDDEN_GLYPHS = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}★☆♥♡←→↗↘↑↓✕✓]/u;
const FORBIDDEN_ENTITIES = /&#(9733|9829);/;
const FORBIDDEN_CSS_ESCAPES =
    /content:\s*['"][^'"]*\\(2605|2606|2665|2661|2190|2192|2197|2198|2191|2193|2715|2713)/i;

/** The offending lines of one file, `[]` when clean. */
function findGlyphs(source: string): string[] {
    return stripComments(source)
        .split('\n')
        .filter(
            (line) =>
                FORBIDDEN_GLYPHS.test(line) ||
                FORBIDDEN_ENTITIES.test(line) ||
                FORBIDDEN_CSS_ESCAPES.test(line)
        )
        .map((line) => line.trim());
}

describe('listing detail pages draw icons, never glyphs (HOS-2579 AC-20)', () => {
    const files = collectScannedFiles();

    it('scans the pages, the shared listing components and the vertical components they import', () => {
        const rels = files.map((file) => relative(SRC, file).split(sep).join('/'));
        for (const page of PAGES) expect(rels).toContain(page);
        for (const expected of [
            'components/venue/VenueReviewsPreview.astro',
            'components/experience/ExperiencePreparation.astro',
            'components/listing/header/ListingHeader.astro',
            'components/listing/location/LocationSection.astro'
        ]) {
            expect(rels).toContain(expected);
        }
        expect(rels.some((rel) => rel.startsWith('components/listing/editor/'))).toBe(false);
        expect(rels.some((rel) => rel.endsWith('Manager.client.tsx'))).toBe(false);
    });

    it.each(
        files.map((file) => [relative(SRC, file).split(sep).join('/'), file])
    )('%s carries no emoji or text glyph', (_rel, file) => {
        expect(findGlyphs(readFileSync(file, 'utf8'))).toEqual([]);
    });
});

describe('the glyph matcher itself', () => {
    it.each([
        ['a star', '<span>★</span>'],
        ['an emoji', '<span>🎒</span>'],
        ['a check emoji', '<span>✅</span>'],
        ['an arrow', 'label={menuLabel + " ↗"}'],
        ['an entity', '<span>&#9733;</span>'],
        ['a CSS arrow', "content: '→';"],
        ['a CSS escape', "content: '\\2192';"]
    ])('flags %s', (_label, line) => {
        expect(findGlyphs(line)).toHaveLength(1);
    });

    it('ignores glyphs inside comments', () => {
        expect(findGlyphs('/* the old ★ */\n<!-- 📍 -->\n// → was here')).toEqual([]);
    });
});
