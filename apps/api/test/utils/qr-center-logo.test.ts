/**
 * The centre mark's GEOMETRY (HOS-981 PR 5; disc and per-level size since
 * HOS-2672): the per-level ratios and how they tie back to the measurements, the
 * disc, the coverage quantities and the isotipo artwork's enclosing circle. The
 * painters' output is checked in `qr-center-logo.png.test.ts and qr-center-logo.svg.test.ts`.
 *
 * ## Why the expected values are frozen literals
 *
 * Deriving the expected disc from `computeCenterLogoDisc` and asserting that
 * something matches it would compare the module against itself. The literals in
 * `qr-center-logo.fixtures.ts` (and the intersecting-module counts below) were
 * computed out of band and are tied to `DATA`: change that string or a ratio and
 * they change together, which is a rewrite of the file rather than a silent pass.
 *
 * @module test/utils/qr-center-logo
 */

import {
    QR_CODE_CENTER_LOGO_CEILING_DIAMETER_RATIO,
    QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE,
    QR_CODE_CENTER_LOGO_DIAMETER_RATIO,
    QR_CODE_ERROR_CORRECTION_DECODE_CEILING
} from '@repo/schemas';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import {
    largestRatioWithin,
    meanCorpusCoverage,
    SWEEP_RATIO_GRID,
    withinPerSymbolBudget
} from '../../scripts/qr-center-logo-sweep-corpus.js';
import {
    centerLogoAreaCoverage,
    centerLogoCoverage,
    computeCenterLogoDisc
} from '../../src/utils/qr-center-logo.js';
import {
    HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE,
    HOSPEDA_ISOTIPO_MARKUP,
    HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE
} from '../../src/utils/qr-hospeda-isotipo.js';
import { ALL_LEVELS, ALL_QR_MODULE_COUNTS, FROZEN_DISCS } from './qr-center-logo.fixtures.js';

describe('the per-level diameter ratios', () => {
    it('are the frozen values, one per level', () => {
        for (const { level, ratio } of FROZEN_DISCS) {
            expect(QR_CODE_CENTER_LOGO_DIAMETER_RATIO[level]).toBe(ratio);
        }
    });

    it('grow with the level: L < M < Q < H', () => {
        const ratios = ALL_LEVELS.map((level) => QR_CODE_CENTER_LOGO_DIAMETER_RATIO[level]);
        for (let index = 1; index < ratios.length; index += 1) {
            expect(ratios[index] as number).toBeGreaterThan(ratios[index - 1] as number);
        }
    });

    /**
     * The ratios are DERIVED from the measured ceiling ratios, and this test is
     * what ties them back, per SYMBOL and not on average: for each level, on every
     * corpus symbol the shipped ratio touches at most the budget share of the
     * modules the ceiling disc touched on that same symbol, and the NEXT grid step
     * would exceed it on at least one. Without the second half a ratio typed in at
     * half its derived value would pass as the "safe" one.
     */
    it.each(ALL_LEVELS)('%s is the largest grid ratio within the per-symbol budget', (level) => {
        const ceilingRatio = QR_CODE_CENTER_LOGO_CEILING_DIAMETER_RATIO[level];
        const share = QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE;
        const ratio = QR_CODE_CENTER_LOGO_DIAMETER_RATIO[level];

        expect(withinPerSymbolBudget({ level, diameterRatio: ratio, ceilingRatio, share })).toBe(
            true
        );
        expect(
            withinPerSymbolBudget({
                level,
                diameterRatio: Number((ratio + SWEEP_RATIO_GRID).toFixed(3)),
                ceilingRatio,
                share
            })
        ).toBe(false);
        expect(largestRatioWithin({ level, ceilingRatio, share })).toBe(ratio);
    });

    /**
     * The informational mean ceiling really is the mean damage of the ceiling disc
     * on the corpus (floored to three decimals), so the table in the schema
     * docblock cannot drift from the measurement it quotes.
     */
    it.each(ALL_LEVELS)('%s records the mean damage of its ceiling disc', (level) => {
        const mean = meanCorpusCoverage({
            level,
            diameterRatio: QR_CODE_CENTER_LOGO_CEILING_DIAMETER_RATIO[level]
        });

        expect(QR_CODE_ERROR_CORRECTION_DECODE_CEILING[level]).toBe(Math.floor(mean * 1000) / 1000);
    });
});

describe('computeCenterLogoDisc', () => {
    it('centres the disc on the symbol and sizes it from the ratio', () => {
        const disc = computeCenterLogoDisc({ moduleCount: 33, diameterRatio: 0.305 });

        expect(disc?.center).toBe(16.5);
        expect(disc?.radius).toBeCloseTo(5.0325, 9);
    });

    /**
     * Every version, every level: either no disc (the symbol is too small for the
     * level's ratio to reach the 3-module minimum, which only the smallest
     * versions at the lowest level do) or a disc strictly inside the symbol. The
     * counts are asserted, because a loop that skipped everything passes as
     * loudly as a correct one.
     */
    it('stays strictly inside the symbol at every version and every level', () => {
        let drawn = 0;
        let declined = 0;
        for (const level of ALL_LEVELS) {
            const diameterRatio = QR_CODE_CENTER_LOGO_DIAMETER_RATIO[level];
            for (const moduleCount of ALL_QR_MODULE_COUNTS) {
                const disc = computeCenterLogoDisc({ moduleCount, diameterRatio });

                if (moduleCount * diameterRatio < 3) {
                    expect(disc, `a smudge-sized disc at ${moduleCount}, ${level}`).toBeNull();
                    declined += 1;
                    continue;
                }

                expect(disc, `no disc at ${moduleCount} modules, ${level}`).not.toBeNull();
                const { center, radius } = disc as { center: number; radius: number };
                expect(center - radius, `${level} ${moduleCount}`).toBeGreaterThan(0);
                expect(center + radius, `${level} ${moduleCount}`).toBeLessThan(moduleCount);
                drawn += 1;
            }
        }
        expect(drawn + declined).toBe(4 * 40);
        // Only the 21-module symbol at L is too small: 21 x 0.135 = 2.8 modules.
        expect(declined).toBe(1);
    });

    it('declines to draw on a symbol too small to carry a disc, or a ratio that swallows it', () => {
        expect(computeCenterLogoDisc({ moduleCount: 9, diameterRatio: 0.2 })).toBeNull();
        expect(computeCenterLogoDisc({ moduleCount: 29, diameterRatio: 1 })).toBeNull();
        expect(centerLogoCoverage({ moduleCount: 9, diameterRatio: 0.2 })).toBe(0);
    });
});

describe('the coverage quantities', () => {
    /**
     * Frozen intersecting-module counts, computed out of band: a disc of 10.065
     * modules across on a 33-module symbol touches 101 modules.
     */
    it.each([
        { moduleCount: 33, diameterRatio: 0.305, touched: 101 },
        { moduleCount: 29, diameterRatio: 0.2, touched: 37 },
        { moduleCount: 33, diameterRatio: 0.27, touched: 77 }
    ])('counts $touched touched modules at $moduleCount x $diameterRatio', (sample) => {
        expect(centerLogoCoverage(sample) * sample.moduleCount ** 2).toBeCloseTo(sample.touched, 9);
    });

    it('is never below the disc area: the conservative reading', () => {
        for (const level of ALL_LEVELS) {
            const diameterRatio = QR_CODE_CENTER_LOGO_DIAMETER_RATIO[level];
            for (const moduleCount of ALL_QR_MODULE_COUNTS) {
                expect(
                    centerLogoCoverage({ moduleCount, diameterRatio }),
                    `${level} ${moduleCount}`
                ).toBeGreaterThanOrEqual(centerLogoAreaCoverage({ moduleCount, diameterRatio }));
            }
        }
    });

    it('keeps the disc AREA the same fraction of the symbol at every version', () => {
        const expected = (Math.PI / 4) * 0.305 ** 2;
        for (const moduleCount of ALL_QR_MODULE_COUNTS) {
            expect(centerLogoAreaCoverage({ moduleCount, diameterRatio: 0.305 })).toBeCloseTo(
                expected,
                10
            );
        }
    });
});

describe('the isotipo artwork', () => {
    /**
     * Re-measures the enclosing circle from the artwork itself, so editing the
     * artwork without updating `HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE` is a red test.
     * Every non-transparent pixel of a 4-px-per-unit raster must lie inside the
     * circle, and the farthest one must be close to its edge (the constant is a
     * tight bound, not an arbitrarily large one that would shrink the logo).
     */
    it('lies entirely inside its declared enclosing circle, and fills most of it', () => {
        const pixels = 2068;
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
            `viewBox="${HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE}">${HOSPEDA_ISOTIPO_MARKUP}</svg>`;
        const rgba = new Resvg(svg).render().pixels;
        const unit = 517 / pixels;
        const { cx, cy, radius } = HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE;

        let painted = 0;
        let farthest = 0;
        for (let y = 0; y < pixels; y += 1) {
            for (let x = 0; x < pixels; x += 1) {
                if ((rgba[(y * pixels + x) * 4 + 3] as number) === 0) continue;
                painted += 1;
                // Farthest CORNER of the pixel, the worst case for containment.
                for (const [dx, dy] of [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [1, 1]
                ] as const) {
                    farthest = Math.max(
                        farthest,
                        Math.hypot(7 + (x + dx) * unit - cx, 8 + (y + dy) * unit - cy)
                    );
                }
            }
        }

        expect(painted, 'the artwork rasterised to nothing').toBeGreaterThan(100000);
        expect(farthest).toBeLessThanOrEqual(radius);
        expect(farthest).toBeGreaterThan(0.995 * radius);
    });
});
