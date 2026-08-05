/**
 * @file icon-sprite-shipped-weights.test.ts
 * @description Guard: `apps/web` must not use an icon weight the sprite does not
 * ship (HOS-369 W3-6).
 *
 * The sprite carries `regular`, `bold`, `fill` and `duotone` — the four weights
 * this app actually uses. Adding `thin` and `light` would take the download from
 * 73,969 B to 124,935 B brotli for weights nothing renders.
 *
 * A `thin`/`light` usage is NOT broken: `createPhosphorIcon` falls back to
 * inlining the glyph for any weight outside `SPRITE_WEIGHTS`, so it renders
 * correctly. It is silently HEAVIER — that icon goes back to shipping its full
 * path data in the HTML, on every instance, and nothing at runtime says so. This
 * guard is the only thing that would say so.
 *
 * ## What this guard proves, and what it does not
 *
 * It reads LITERAL weights only: `weight="thin"`, `weight={'thin'}`,
 * `weight: 'thin'`. It CANNOT resolve `weight={expression}`. There are 14 such
 * call sites in `apps/web/src` today (star ratings in six card/header
 * components, the compare and favorite toggles, the toast viewport, the
 * destinations island); every one of them is a ternary between `'fill'` and
 * `'regular'`, both shipped. If one is ever changed to produce `thin` or
 * `light`, this guard will NOT catch it — it will keep passing while that icon
 * quietly renders inline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SPRITE_WEIGHTS } from '@repo/icons';
import { describe, expect, it } from 'vitest';
import { countDynamicWeights, findLiteralWeights } from './icon-sprite-shipped-weights';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

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

describe('the icon-weight scan itself', () => {
    it('scans a non-trivial number of files', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('finds the literal weights that ARE used, so the scan is not blind', () => {
        // If the matcher silently stopped matching, the violation check below
        // would pass on an empty set forever.
        const weights = new Set(
            ALL_FILES.flatMap((file) =>
                findLiteralWeights({ source: fs.readFileSync(file, 'utf8') }).map((u) => u.weight)
            )
        );

        for (const shipped of SPRITE_WEIGHTS) {
            expect(weights.has(shipped), `no \`weight="${shipped}"\` found anywhere`).toBe(true);
        }
    });

    it('recognises every literal form a weight can be written in', () => {
        const found = findLiteralWeights({
            source: [
                '<StarIcon weight="thin" />',
                "<StarIcon weight='light' />",
                "<StarIcon weight={'thin'} />",
                "const props = { weight: 'light' };"
            ].join('\n')
        });

        expect(found.map((usage) => usage.weight)).toEqual(['thin', 'light', 'thin', 'light']);
    });
});

describe('apps/web uses only weights the sprite ships', () => {
    it('never names `thin` or `light` in a literal weight', () => {
        const violations = ALL_FILES.flatMap((file) =>
            findLiteralWeights({ source: fs.readFileSync(file, 'utf8') })
                .filter(
                    (usage) => !(SPRITE_WEIGHTS as ReadonlyArray<string>).includes(usage.weight)
                )
                .map(
                    (usage) =>
                        `${path.relative(WEB_SRC, file)}:${usage.line} weight="${usage.weight}"`
                )
        );

        expect(
            violations,
            `These weights have no <symbol> in the icon sprite, so each instance falls back to inlining its full glyph in the HTML — correct, but silently heavier. Use one of ${SPRITE_WEIGHTS.join(', ')}, or add the weight to SPRITE_WEIGHTS and accept the extra sprite bytes.`
        ).toEqual([]);
    });
});

describe('what this guard cannot see', () => {
    it('leaves `weight={expression}` call sites unchecked, and says so', () => {
        // Stated in numbers rather than prose so the claim stays true: if these
        // grow, the blind spot grew with them and this test is where that shows.
        // Every one of them is a `'fill'`/`'regular'` ternary today — both
        // shipped — but a static scan cannot know that, and this guard must not
        // imply it does.
        const dynamic = ALL_FILES.reduce(
            (total, file) => total + countDynamicWeights({ source: fs.readFileSync(file, 'utf8') }),
            0
        );

        expect(dynamic).toBeGreaterThan(0);
        expect(
            dynamic,
            "the number of unresolvable `weight={…}` call sites changed — re-read them and update this guard's docstring, which currently claims they are all fill/regular ternaries"
        ).toBe(14);
    });
});
