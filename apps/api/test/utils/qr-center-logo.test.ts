/**
 * The centre mark's geometry, and the agreement between the two painters
 * (HOS-981 PR 5).
 *
 * ## The failure this file exists to catch
 *
 * The SVG writer emits markup in MODULE units; the PNG painter writes RGBA
 * bytes in PIXELS, at a scale that is routinely fractional (512 px over a
 * 33-module symbol with a 4-module quiet zone is 12.487…). Those are two
 * independent conversions of one geometry, and if they disagree — by a module,
 * by an off-by-one in the quiet-zone offset, by reading the scale as an integer
 * — then the SVG and the PNG of the SAME configured code cover DIFFERENT
 * modules. One of them can still scan while the other does not, and the decode
 * suite next door would keep passing on whichever format it happened to test.
 *
 * ## Why the expected values are frozen integers
 *
 * Because the alternative is vacuous. Deriving the expected plate from
 * `computeCenterLogoPlate` and then asserting that the SVG matches it would
 * compare the module against itself: change the snapping rule and both sides
 * move together. The literals below were computed out of band (module counts
 * from `QRCode.create`, the plate arithmetic by hand) and are tied to `DATA` —
 * change that string and they change together, which is a rewrite of this file
 * rather than a silent pass. This is the same lesson HOS-1129 paid for when a
 * transposed matrix survived 39 green tests.
 *
 * The two OBSERVATIONS are genuinely independent: one parses attributes out of
 * markup, the other scans pixels out of a decoded buffer.
 *
 * @module test/utils/qr-center-logo
 */

import {
    QR_CODE_CENTER_LOGO_SIZE_RATIO,
    QrCodeCenterLogoEnum,
    QrCodeErrorCorrectionLevelEnum
} from '@repo/schemas';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
    centerLogoCoverage,
    computeCenterLogoPlate,
    HOSPEDA_MARK
} from '../../src/utils/qr-center-logo.js';
import { renderQrPng, renderQrSvg } from '../../src/utils/qr-render.js';

const DATA = 'https://hospeda.com.ar/q/k7Qm2XbT';
const MARGIN = 4;

/**
 * The plate, per correction level, for `DATA`. Frozen, not derived.
 *
 * `moduleCount` is the QR version the string lands on; `side` is
 * `floorToOdd(moduleCount × 0.2)`; `offset` is `(moduleCount − side) / 2`. All
 * three were computed outside this file. Note L and M share a version and Q and
 * H share a bigger one — the plate is 5 modules in every case, which is why the
 * SVG assertion below also pins the OFFSET and not only the size.
 */
const FROZEN_PLATES = [
    { level: QrCodeErrorCorrectionLevelEnum.L, moduleCount: 29, offset: 12, side: 5 },
    { level: QrCodeErrorCorrectionLevelEnum.M, moduleCount: 29, offset: 12, side: 5 },
    { level: QrCodeErrorCorrectionLevelEnum.Q, moduleCount: 33, offset: 14, side: 5 },
    { level: QrCodeErrorCorrectionLevelEnum.H, moduleCount: 33, offset: 14, side: 5 }
] as const;

/** Every QR version's side, in modules: 21, 25, … 177. */
const ALL_QR_MODULE_COUNTS = Array.from({ length: 40 }, (_, index) => 21 + 4 * index);

describe('computeCenterLogoPlate', () => {
    it('always returns an odd side, so the plate centres on whole modules', () => {
        let checked = 0;
        for (const moduleCount of ALL_QR_MODULE_COUNTS) {
            const plate = computeCenterLogoPlate({ moduleCount });
            expect(plate, `no plate at ${moduleCount} modules`).not.toBeNull();
            expect(
                (plate as { side: number }).side % 2,
                `An even plate at ${moduleCount} modules sits half a module off centre and blanks ` +
                    'a ragged extra row.'
            ).toBe(1);
            expect(Number.isInteger((plate as { offset: number }).offset)).toBe(true);
            checked += 1;
        }
        expect(checked).toBe(40);
    });

    it('centres the plate: the margins on both sides are equal', () => {
        for (const moduleCount of ALL_QR_MODULE_COUNTS) {
            const plate = computeCenterLogoPlate({ moduleCount });
            const { offset, side } = plate as { offset: number; side: number };
            expect(offset + side + offset, `not centred at ${moduleCount}`).toBe(moduleCount);
        }
    });

    /**
     * THE property the schema gate rests on.
     *
     * `qrCodeCenterLogoFits` compares a single number against the correction
     * level's tolerance, and it can only do that because coverage is bounded
     * independently of which QR version a given URL produces. That bound is a
     * consequence of snapping DOWN to odd; round to nearest instead and a
     * 21-module symbol covers 5.7% where the gate was told 4%. Forty versions
     * checked, and the count asserted, because a loop that silently iterated
     * zero times would pass this as loudly as a correct one.
     */
    it('never covers more than the size ratio squared, at any of the 40 versions', () => {
        const bound = QR_CODE_CENTER_LOGO_SIZE_RATIO ** 2;
        let checked = 0;
        let worst = 0;

        for (const moduleCount of ALL_QR_MODULE_COUNTS) {
            const coverage = centerLogoCoverage({ moduleCount });
            expect(
                coverage,
                `A ${moduleCount}-module symbol covers ${(coverage * 100).toFixed(2)}%, past the ` +
                    `${(bound * 100).toFixed(2)}% the schema gate was told to assume. The gate is ` +
                    'now approving marks it has not accounted for.'
            ).toBeLessThanOrEqual(bound + 1e-12);
            worst = Math.max(worst, coverage);
            checked += 1;
        }

        expect(checked).toBe(40);
        // The bound is REACHED, not merely respected: a snapping rule that
        // always produced a tiny plate would satisfy the assertion above while
        // making the gate meaningless.
        expect(worst).toBeGreaterThan(bound * 0.9);
    });

    it('declines to draw on a symbol too small to carry a plate', () => {
        expect(computeCenterLogoPlate({ moduleCount: 9 })).toBeNull();
        expect(centerLogoCoverage({ moduleCount: 9 })).toBe(0);
    });
});

describe('the mark itself', () => {
    it('stays inside its unit box on both axes', () => {
        expect(HOSPEDA_MARK.length).toBeGreaterThan(0);
        for (const rect of HOSPEDA_MARK) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(1);
            expect(rect.y + rect.height).toBeLessThanOrEqual(1);
        }
    });

    /**
     * The mark must not touch the plate's edge. A mark flush to its plate reads
     * as a smear against the surrounding modules rather than as a logo, and — a
     * concrete consequence — the plate would stop being the visual boundary
     * that tells a scanner-holding human this is intentional.
     */
    it('is inset from every edge of the plate', () => {
        const left = Math.min(...HOSPEDA_MARK.map((r) => r.x));
        const top = Math.min(...HOSPEDA_MARK.map((r) => r.y));
        const right = Math.max(...HOSPEDA_MARK.map((r) => r.x + r.width));
        const bottom = Math.max(...HOSPEDA_MARK.map((r) => r.y + r.height));

        expect(left).toBeGreaterThan(0.05);
        expect(top).toBeGreaterThan(0.05);
        expect(right).toBeLessThan(0.95);
        expect(bottom).toBeLessThan(0.95);
    });
});

describe('renderQrSvg — the mark in the markup', () => {
    it('draws nothing at all when the mark is NONE', async () => {
        const plain = await renderQrSvg({ data: DATA });
        const explicit = await renderQrSvg({
            data: DATA,
            options: { centerLogo: QrCodeCenterLogoEnum.NONE }
        });

        expect(explicit).toBe(plain);
        expect(plain).not.toContain('<rect');
    });

    it.each(FROZEN_PLATES)('places the plate at the frozen position for $level', async ({
        level,
        offset,
        side
    }) => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: level,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                margin: MARGIN
            }
        });

        // The plate is the FIRST rect: it has to be painted before the bars
        // that sit on top of it, and SVG paints in document order.
        const first = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(
            svg
        );

        expect(first, 'no plate rect in the SVG at all').not.toBeNull();
        const [, x, y, width, height] = first as RegExpExecArray;

        expect(Number(x)).toBe(offset + MARGIN);
        expect(Number(y)).toBe(offset + MARGIN);
        expect(Number(width)).toBe(side);
        expect(Number(height)).toBe(side);
    });

    it('paints the plate in the background colour and the bars in the foreground', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                foregroundColor: '#123456',
                backgroundColor: '#abcdef'
            }
        });

        const rects = [...svg.matchAll(/<rect [^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);

        expect(rects[0]).toBe('#abcdef');
        expect(rects.slice(1)).toStrictEqual(HOSPEDA_MARK.map(() => '#123456'));
    });

    it('is still deterministic with the mark on', async () => {
        const options = {
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        };

        expect(await renderQrSvg({ data: DATA, options })).toBe(
            await renderQrSvg({ data: DATA, options })
        );
    });
});

/** Bounding box of the pixels two renders of the same code disagree about. */
type DiffBox = {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly count: number;
};

/**
 * Where the PNG painter actually touched the image.
 *
 * Deliberately shape-agnostic: it diffs the marked render against the UNMARKED
 * render of the same code, so it observes the paint's real extent without
 * knowing anything about the plate's geometry or the mark's silhouette. That
 * independence is what makes the assertions below evidence rather than
 * restatement — and it means replacing `HOSPEDA_MARK` cannot quietly invalidate
 * this measurement.
 */
function diffAgainstUnmarked(marked: PNG, plain: PNG): DiffBox {
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    let count = 0;

    for (let y = 0; y < marked.height; y += 1) {
        for (let x = 0; x < marked.width; x += 1) {
            const index = (marked.width * y + x) << 2;
            const same =
                marked.data[index] === plain.data[index] &&
                marked.data[index + 1] === plain.data[index + 1] &&
                marked.data[index + 2] === plain.data[index + 2];
            if (same) continue;

            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
            count += 1;
        }
    }

    return { left, top, right, bottom, count };
}

describe('renderQrPng — the mark in the pixels, and its agreement with the SVG', () => {
    it('returns the library bytes untouched when the mark is NONE', async () => {
        const plain = await renderQrPng({ data: DATA });
        const explicit = await renderQrPng({
            data: DATA,
            options: { centerLogo: QrCodeCenterLogoEnum.NONE }
        });

        expect(explicit.equals(plain)).toBe(true);
    });

    it.each([
        256, 512, 1024
    ])('paints inside the frozen module rectangle and nowhere else, at %i px', async (size) => {
        const frozen = FROZEN_PLATES[3];
        const base = {
            errorCorrectionLevel: frozen.level,
            margin: MARGIN,
            size
        };

        const plain = PNG.sync.read(await renderQrPng({ data: DATA, options: base }));
        const marked = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: { ...base, centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
            })
        );

        const diff = diffAgainstUnmarked(marked, plain);
        const scale = marked.width / (frozen.moduleCount + 2 * MARGIN);
        const plateLeft = (frozen.offset + MARGIN) * scale;
        const plateRight = plateLeft + frozen.side * scale;

        // Something was actually painted. Without this the containment
        // assertions below hold vacuously for a renderer that draws nothing.
        expect(diff.count).toBeGreaterThan(0.2 * (frozen.side * scale) ** 2);

        // And it stayed inside the frozen rectangle. One pixel of slack for
        // the fractional scale, and one only — a module is 7 px even at the
        // smallest size here, so this cannot absorb a one-MODULE error,
        // which is the mistake that would make the SVG and the PNG damage
        // different codewords.
        expect(diff.left).toBeGreaterThanOrEqual(Math.floor(plateLeft) - 1);
        expect(diff.top).toBeGreaterThanOrEqual(Math.floor(plateLeft) - 1);
        expect(diff.right).toBeLessThanOrEqual(Math.ceil(plateRight) + 1);
        expect(diff.bottom).toBeLessThanOrEqual(Math.ceil(plateRight) + 1);
    });

    /**
     * The two painters, compared through their OUTPUTS.
     *
     * The SVG's plate is read out of markup in module units; the PNG's is
     * measured by diffing pixels and converted back to modules with the
     * buffer's own width. Neither number comes from `computeCenterLogoPlate`,
     * so this is two independent conversions being checked against each other
     * rather than one being checked against itself.
     */
    it('covers the same modules in the SVG and in the PNG', async () => {
        const frozen = FROZEN_PLATES[3];
        const options = {
            errorCorrectionLevel: frozen.level,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
            margin: MARGIN
        };

        const svg = await renderQrSvg({ data: DATA, options });
        const svgRect = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg);
        expect(svgRect).not.toBeNull();
        const [, svgX, svgY, svgWidth] = svgRect as RegExpExecArray;

        const plain = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: { errorCorrectionLevel: frozen.level, margin: MARGIN, size: 1024 }
            })
        );
        const marked = PNG.sync.read(
            await renderQrPng({ data: DATA, options: { ...options, size: 1024 } })
        );

        const diff = diffAgainstUnmarked(marked, plain);
        const scale = marked.width / (frozen.moduleCount + 2 * MARGIN);

        // The painted pixels sit inside the module square the SVG declares.
        expect(Math.floor(diff.left / scale)).toBeGreaterThanOrEqual(Number(svgX));
        expect(Math.floor(diff.top / scale)).toBeGreaterThanOrEqual(Number(svgY));
        expect(Math.ceil((diff.right + 1) / scale)).toBeLessThanOrEqual(
            Number(svgX) + Number(svgWidth)
        );
        expect(Math.ceil((diff.bottom + 1) / scale)).toBeLessThanOrEqual(
            Number(svgY) + Number(svgWidth)
        );
    });

    it('is still deterministic with the mark on', async () => {
        const options = {
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
            size: 256
        };

        expect(
            (await renderQrPng({ data: DATA, options })).equals(
                await renderQrPng({ data: DATA, options })
            )
        ).toBe(true);
    });
});
