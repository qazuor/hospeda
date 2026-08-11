/**
 * @file card-view-transition-names.test.ts
 * @description Guard: no card component may declare `transition:name` while no
 * detail page declares the matching counterpart (HOS-369).
 *
 * ## Why the names were removed
 *
 * Four card components (`AccommodationCard`, `DestinationCard`, `GastronomyCard`,
 * `ExperienceCard`) carried `transition:name={`<kind>-${slug}`}` on their image
 * — seven declarations in all, since three of them render two image variants —
 * for a list → detail shared-element morph. **That morph could never happen**: a
 * `view-transition-name` only produces a shared-element transition when the SAME
 * name exists on an element in the destination document, and no detail page ever
 * declared one. Verified live on staging — `/es/alojamientos/casa-termas-federacion/`
 * carried zero elements named `accommodation-casa-termas-federacion`, and its hero
 * image computed `view-transition-name: none`. The eight inline blocks that page
 * did carry belonged to its "related accommodations" cards.
 *
 * What the names cost, measured on staging:
 *
 * | page | cards | inline CSS | share of HTML |
 * |---|---|---|---|
 * | `/es/` | 8 | 19,764 B | 4.8% of 412 KB |
 * | `/es/alojamientos/` | 20 | 50,184 B | 10.1% of 497 KB |
 *
 * 2,509 B per card, linear in card count, inline in the HTML — so it rides in
 * every edge-cached document. Each block also needs its own `sha256` in the CSP
 * header, computed per SSR render (`collectCspHashes`) and cached with the body:
 * the header went 2,698 B / 30 hashes on the home to 3,238 B / 40 on the listing.
 *
 * They were not neutral, either. `destinos/index.astro` had to suppress them with
 * `view-transition-name: none !important` plus a JS-toggled class, because the
 * named images snapshot independently and escape their parent's rounded
 * `overflow: hidden` mask mid-crossfade. Removing the names removed that
 * workaround too.
 *
 * ## If you are re-adding one
 *
 * Fine — but declare the counterpart on the detail page in the same change, and
 * update this guard to assert BOTH sides. A name with no counterpart is pure
 * weight. This guard cannot verify the pairing itself (the detail side is
 * assembled at runtime from a different component tree), so the pairing is a
 * review obligation, not a checked one — which is exactly why the guard fails
 * closed on any new `transition:name` instead of trying to be clever.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** The components that carried a name before HOS-369 removed them. */
const FORMERLY_NAMED = [
    'components/experience/ExperienceCard.astro',
    'components/gastronomy/GastronomyCard.astro',
    'components/shared/cards/AccommodationCard.astro',
    'components/shared/cards/DestinationCard.astro'
];

/** Recursively collect every `.astro` file under `dir`. */
function collectAstroFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectAstroFiles(full));
            continue;
        }
        if (path.extname(entry.name) === '.astro') files.push(full);
    }
    return files;
}

const ASTRO_FILES = collectAstroFiles(WEB_SRC);

const rel = (file: string) => path.relative(WEB_SRC, file).split(path.sep).join('/');

describe('the view-transition-name scan itself', () => {
    it('scans a non-trivial number of .astro files', () => {
        expect(ASTRO_FILES.length).toBeGreaterThan(50);
    });

    it('still reaches every component that used to carry a name', () => {
        // Without this, "no file declares a name" would pass vacuously if these
        // files were renamed or the scan stopped reaching them.
        const scanned = new Set(ASTRO_FILES.map(rel));
        for (const file of FORMERLY_NAMED) {
            expect(scanned.has(file), `${file} is not in the scanned set`).toBe(true);
        }
    });

    it('would detect a name if one were declared', () => {
        // Proves the matcher works, so the empty result below means "none",
        // not "the regex stopped matching".
        const sample = 'class="acc-card__img"\n\ttransition:name={`accommodation-${data.slug}`}\n';
        expect(/transition:name/.test(sample)).toBe(true);
    });
});

describe('no card declares an unpaired view transition name', () => {
    it('finds no `transition:name` anywhere in apps/web/src', () => {
        const violations = ASTRO_FILES.flatMap((file) => {
            const lines = fs.readFileSync(file, 'utf8').split('\n');
            return lines
                .map((line, i) => ({ line, n: i + 1 }))
                .filter((entry) => entry.line.includes('transition:name'))
                .map((entry) => `${rel(file)}:${entry.n}`);
        });

        expect(
            violations,
            'A `view-transition-name` with no matching name in the destination document produces no morph — it only adds ~2.5 KB of inline CSS per card to the HTML, plus a CSP style hash per render. Declare the detail-page counterpart in the same change and update this guard, or drop the name.'
        ).toEqual([]);
    });

    it('leaves no trace of the destinos suppression workaround', () => {
        // The workaround existed only because of the names. If it comes back
        // while no name exists, something is being papered over.
        //
        // Matched as CODE (a `classList` call or a CSS selector), not as a bare
        // mention: `destinos/index.astro` names the class in the comment that
        // explains why the workaround is gone, and a guard that flagged that
        // comment would push people into deleting the explanation.
        const USED_AS_CODE =
            /classList\.\w+\(\s*['"]is-attractions-transition|\.is-attractions-transition\b/;

        const leftovers = ASTRO_FILES.filter((file) =>
            USED_AS_CODE.test(fs.readFileSync(file, 'utf8'))
        ).map(rel);

        expect(leftovers).toEqual([]);
    });
});
