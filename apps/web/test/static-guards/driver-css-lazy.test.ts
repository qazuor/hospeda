/**
 * @file driver-css-lazy.test.ts
 * @description Guard: driver.js's stylesheet must stay OFF the global CSS
 * bundle (HOS-369 W3-4).
 *
 * The host onboarding tour is reachable from `/mi-cuenta` only, but its CSS used
 * to live in `global.css` — the vendor `@import "driver.js/dist/driver.css"` at
 * the top plus a themed block at the bottom. Every page on the site therefore
 * downloaded popover CSS it could never use.
 *
 * The fix has three moving parts and only holds if all three do:
 *   1. the rules live in `src/styles/driver-tour.css`, nowhere else;
 *   2. `src/lib/load-driver.ts` is the ONLY module that imports that file, and
 *      the only one that imports the `driver.js` package;
 *   3. every reference to `load-driver` is a dynamic `await import(...)`.
 *
 * Break (3) — a plain `import { driver } from '@/lib/load-driver'` in an island
 * — and Vite folds the CSS straight back into that island's eagerly linked
 * stylesheet. Nothing at runtime complains: the tour still works, the bytes are
 * just back on pages that never run it. This guard is the only thing that says
 * so.
 *
 * The positive assertions matter as much as the negative ones. "global.css has
 * no `.driver-` rule" also passes if someone deletes the tour theme outright
 * (which is BETA-121, an unstyled popover), so the themed rules are asserted to
 * exist in their new home.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

/** The single module allowed to pull in driver.js and its stylesheet. */
const LOADER = 'lib/load-driver.ts';

/** The stylesheet's own path, relative to `src/`. */
const TOUR_CSS = 'styles/driver-tour.css';

/** The two islands that start a tour. */
const TOUR_ISLANDS = [
    'components/account/RestartTour.client.tsx',
    'components/account/TourController.client.tsx'
];

type ScannedFile = {
    /** Path relative to `apps/web/src`, POSIX-separated. */
    readonly rel: string;
    readonly source: string;
};

/** Recursively collect every scannable file under `dir`. */
function collectFiles(dir: string): ScannedFile[] {
    if (!fs.existsSync(dir)) return [];

    const files: ScannedFile[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (!SCANNED_EXTENSIONS.has(path.extname(entry.name))) continue;
        files.push({
            rel: path.relative(WEB_SRC, full).split(path.sep).join('/'),
            source: fs.readFileSync(full, 'utf8')
        });
    }
    return files;
}

const ALL_FILES = collectFiles(WEB_SRC);

/** Files whose source mentions the given pattern, by relative path, sorted. */
function filesMatching(pattern: RegExp): string[] {
    return ALL_FILES.filter((file) => pattern.test(file.source))
        .map((file) => file.rel)
        .sort();
}

/**
 * Files that actually IMPORT `specifier` — CSS `@import`, static ESM import, or
 * dynamic `import()`. Deliberately import-shaped rather than a bare mention:
 * the pointer comments in `global.css` and `driver-tour.css` name these paths
 * on purpose, and a guard that flagged prose would push people into deleting
 * the very comments that explain the invariant.
 */
function filesImporting(specifier: string): string[] {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quoted = `["'][^"']*${escaped}[^"']*["']`;
    return filesMatching(
        new RegExp(`(@import\\s+${quoted}|\\bfrom\\s*${quoted}|\\bimport\\s*\\(?\\s*${quoted})`)
    );
}

function readSrc(rel: string): string {
    const file = ALL_FILES.find((candidate) => candidate.rel === rel);
    if (!file) throw new Error(`${rel} was not found by the scan`);
    return file.source;
}

describe('the driver.js scan itself', () => {
    it('scans a non-trivial number of files', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('scans the three files the invariant is about', () => {
        // Without this, every "no file does X" assertion below would pass
        // vacuously if the scan stopped reaching src/, or if `.css` were
        // dropped from SCANNED_EXTENSIONS.
        for (const rel of [LOADER, TOUR_CSS, 'styles/global.css', ...TOUR_ISLANDS]) {
            expect(
                ALL_FILES.some((file) => file.rel === rel),
                `${rel} is not in the scanned set`
            ).toBe(true);
        }
    });
});

describe('the tour theme still exists, in its own stylesheet', () => {
    const source = readSrc(TOUR_CSS);

    it('imports the vendor base stylesheet', () => {
        expect(source).toMatch(/@import\s+["']driver\.js\/dist\/driver\.css["']/);
    });

    it('keeps the themed overrides that BETA-121 added', () => {
        // Not exhaustive — a spot check on the rules that turn the popover from
        // an unstyled block into a themed card.
        expect(source).toMatch(/\.driver-popover\s*\{/);
        expect(source).toContain('max-width: 340px;');
        expect(source).toMatch(/\.driver-popover-footer\s*\{/);
        expect(source).toMatch(/\.driver-overlay\s*\{/);
    });
});

describe('nothing eagerly loads the tour stylesheet', () => {
    it('leaves no driver.js rule or import in global.css', () => {
        const source = readSrc('styles/global.css');

        expect(
            source,
            'global.css is linked by every layout — a `.driver-` rule here ships tour CSS on every page. Put it in styles/driver-tour.css instead.'
        ).not.toMatch(/^\s*\.driver-/m);
        expect(source).not.toMatch(/@import\s+["']driver\.js/);
    });

    it('routes every driver.js package import through the lazy loader', () => {
        expect(filesImporting('driver.js')).toEqual([LOADER, TOUR_CSS].sort());
    });

    it('lets only the lazy loader import the tour stylesheet', () => {
        expect(filesImporting('driver-tour.css').filter((rel) => rel !== TOUR_CSS)).toEqual([
            LOADER
        ]);
    });

    it('is imported only by the two tour islands', () => {
        expect(filesImporting('load-driver').filter((rel) => rel !== LOADER)).toEqual(TOUR_ISLANDS);
    });

    it.each(TOUR_ISLANDS)('%s reaches the loader through a dynamic import', (rel) => {
        const source = readSrc(rel);

        expect(source).toMatch(/await import\(\s*["']@\/lib\/load-driver["']\s*\)/);
        expect(
            source,
            'a static import folds the tour CSS into this island\'s eagerly linked stylesheet — use `await import("@/lib/load-driver")`'
        ).not.toMatch(/^\s*import\b[^\n]*load-driver/m);
    });
});
