/**
 * Tests for the configurable QR render engine (HOS-981).
 *
 * @module test/utils/qr-render
 */

import {
    QrCodeCenterLogoEnum,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    renderQr,
    renderQrMatrix,
    renderQrPng,
    renderQrSvg,
    resolveQrRenderOptions
} from '../../src/utils/qr-render.js';

const DATA = 'https://hospeda.com.ar/q/k7Qm2XbT';

describe('resolveQrRenderOptions', () => {
    it('returns the full default set when nothing is supplied', () => {
        expect(resolveQrRenderOptions({})).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
            format: QrCodeFormatEnum.SVG,
            margin: 4,
            size: null,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            centerLogo: QrCodeCenterLogoEnum.NONE
        });
    });

    it('lets every field be overridden', () => {
        expect(
            resolveQrRenderOptions({
                options: {
                    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
                    format: QrCodeFormatEnum.PNG,
                    margin: 1,
                    size: 256,
                    foregroundColor: '#112233',
                    backgroundColor: '#eeddcc',
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA
                }
            })
        ).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 1,
            size: 256,
            foregroundColor: '#112233',
            backgroundColor: '#eeddcc',
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA
        });
    });

    it('keeps a margin of 0, which is falsy but meaningful', () => {
        expect(resolveQrRenderOptions({ options: { margin: 0 } }).margin).toBe(0);
    });
});

describe('renderQrSvg', () => {
    it('produces an SVG document', async () => {
        const svg = await renderQrSvg({ data: DATA });

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('viewBox=');
    });

    it('is deterministic for the same data and options', async () => {
        const a = await renderQrSvg({ data: DATA, options: { margin: 2 } });
        const b = await renderQrSvg({ data: DATA, options: { margin: 2 } });

        expect(a).toBe(b);
    });

    /** The whole reason the options exist: a different margin is a different image. */
    it('changes the output when the margin changes', async () => {
        const a = await renderQrSvg({ data: DATA, options: { margin: 4 } });
        const b = await renderQrSvg({ data: DATA, options: { margin: 1 } });

        // 29 modules of symbol, plus the quiet zone on both sides.
        expect(a).not.toBe(b);
        expect(a).toContain('viewBox="0 0 37 37"');
        expect(b).toContain('viewBox="0 0 31 31"');
    });

    /** Higher correction means more modules, so a strictly larger symbol. */
    it('changes the output when the error-correction level changes', async () => {
        const low = await renderQrSvg({
            data: DATA,
            options: { errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.L }
        });
        const high = await renderQrSvg({
            data: DATA,
            options: { errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H }
        });

        expect(low).not.toBe(high);
        expect(high.length).toBeGreaterThan(low.length);
    });

    it('honours explicit colours', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: { foregroundColor: '#ff0000', backgroundColor: '#00ff00' }
        });

        expect(svg).toContain('#ff0000');
        expect(svg).toContain('#00ff00');
        expect(svg).not.toContain('#000000');
    });

    /**
     * A `null` size must leave the SVG unconstrained; a number must stamp
     * dimensions on it. This is the pair that keeps the existing provider QR
     * byte-identical while still letting a caller ask for a fixed size.
     */
    it('omits width/height when size is null and emits them when it is set', async () => {
        const unconstrained = await renderQrSvg({ data: DATA, options: { size: null } });
        const sized = await renderQrSvg({ data: DATA, options: { size: 512 } });

        expect(unconstrained).not.toMatch(/<svg[^>]*\swidth=/);
        expect(sized).toMatch(/<svg[^>]*\swidth="512"/);
        expect(sized).toMatch(/<svg[^>]*\sheight="512"/);
    });
});

describe('renderQrPng', () => {
    it('produces a buffer carrying the PNG magic bytes', async () => {
        const png = await renderQrPng({ data: DATA });

        expect(Buffer.isBuffer(png)).toBe(true);
        expect(png.length).toBeGreaterThan(0);
        expect(png.subarray(0, 8)).toStrictEqual(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
    });

    it('honours the requested size', async () => {
        const png = await renderQrPng({ data: DATA, options: { size: 256 } });

        // IHDR width/height are big-endian uint32 at byte offsets 16 and 20.
        expect(png.readUInt32BE(16)).toBe(256);
        expect(png.readUInt32BE(20)).toBe(256);
    });
});

describe('renderQr', () => {
    it('returns an SVG result by default', async () => {
        const result = await renderQr({ data: DATA });

        expect(result.format).toBe(QrCodeFormatEnum.SVG);
        expect(result.format === QrCodeFormatEnum.SVG && result.svg.startsWith('<svg')).toBe(true);
    });

    it('returns a PNG result with a data URL when asked for PNG', async () => {
        const result = await renderQr({ data: DATA, options: { format: QrCodeFormatEnum.PNG } });

        expect(result.format).toBe(QrCodeFormatEnum.PNG);
        if (result.format !== QrCodeFormatEnum.PNG) throw new Error('unreachable');
        expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
        expect(Buffer.isBuffer(result.png)).toBe(true);
    });
});

/**
 * The module grid the two PDF renderers consume (HOS-1129).
 *
 * These matter more than they look: `renderQrMatrix` is the reason
 * `brochure-render.ts` and `certificate-render.ts` no longer import `qrcode`
 * themselves, and a grid that silently answered the wrong shape would print a
 * dead code onto paper with nothing on the page to say so.
 */
describe('renderQrMatrix (HOS-1129)', () => {
    it('returns a square grid whose side is a valid QR version', () => {
        const matrix = renderQrMatrix({ data: DATA });

        // Every QR version is 21 + 4n modules a side.
        expect(matrix.size).toBeGreaterThanOrEqual(21);
        expect((matrix.size - 21) % 4).toBe(0);
    });

    it('draws the three finder patterns, which is what makes it a QR at all', () => {
        const matrix = renderQrMatrix({ data: DATA });
        const last = matrix.size - 1;

        // A finder is 7×7: a dark outer ring, a light ring inside it, and a
        // 3×3 dark core. Read along the diagonal that is dark-light-dark. The
        // fourth corner never carries one, which is what orients the symbol.
        const corners: readonly (readonly [number, number])[] = [
            [0, 0],
            [0, last - 6],
            [last - 6, 0]
        ];
        for (const [row, col] of corners) {
            expect(matrix.isDark(row, col)).toBe(true);
            expect(matrix.isDark(row + 1, col + 1)).toBe(false);
            expect(matrix.isDark(row + 2, col + 2)).toBe(true);
        }
        expect(matrix.isDark(last, last)).toBe(false);
    });

    /**
     * Which index is the ROW (HOS-1129 review).
     *
     * Every other assertion in this suite is symmetric about the diagonal, so
     * reading the flat module array as `data[col * size + row]` — a
     * one-character slip — survived all of them: the three finder probes sit at
     * `[0,0]`, `[0,last-6]` and `[last-6,0]`, and transposing merely swaps the
     * last two, both of which are finders; `isDark(last,last) === false` holds
     * either way; and determinism and "encodes the string it was given" compare
     * the grid against itself. Measured: transposing left 39 tests green across
     * 2 files. A transposed QR is a mirrored QR, and a mirrored QR does not
     * scan — on paper, permanently.
     *
     * The timing patterns are NOT usable here, tempting as they look: row 6 and
     * column 6 are the same alternating string, so transposing swaps two
     * identical values (verified — `row6 === col6` for this symbol). What does
     * separate the two orientations:
     *
     * - the DARK MODULE, which the spec fixes dark at `(4·version + 9, 8)` in
     *   every symbol of every version, while its mirror `(8, size - 8)` is an
     *   ordinary format-information bit; and
     * - the two copies of the format information itself, which carry the same
     *   15 bits in opposite orders along row 8 and column 8.
     *
     * The two lines are frozen as literals rather than derived, because
     * anything derived from the grid is exactly what a transposed grid would
     * also satisfy. They are tied to `DATA`: change that string and both
     * change together, which is a rewrite of this test and not a silent pass.
     */
    it('fixes which index is the row, so a transposed read is not this grid', () => {
        const matrix = renderQrMatrix({ data: DATA });

        // `DATA` is a version-3 symbol; the goldens below are 29 characters.
        expect(matrix.size).toBe(29);

        // Spec-guaranteed dark, at any version. Its mirror is not.
        expect(matrix.isDark(matrix.size - 8, 8)).toBe(true);
        expect(matrix.isDark(8, matrix.size - 8)).toBe(false);

        const read = (at: (index: number) => boolean): string =>
            Array.from({ length: matrix.size }, (_, index) => (at(index) ? '#' : '.')).join('');
        const row8 = read((col) => matrix.isDark(8, col));
        const col8 = read((row) => matrix.isDark(row, 8));

        expect(row8).toBe('#.##.###...#.##.##.#..#..#.##');
        expect(col8).toBe('##.#..##..#.##.##....###.##.#');
        // Stated out loud: the pair above is only evidence because the two
        // strings differ. Two equal goldens would be a symmetric assertion
        // wearing a golden's clothes.
        expect(row8).not.toBe(col8);
    });

    it('reads light outside the grid instead of throwing or wrapping around', () => {
        const matrix = renderQrMatrix({ data: DATA });

        // The run-merging loops in both PDF renderers walk one column PAST the
        // edge to flush the last run. If that read wrapped to the next row's
        // first module the final run would be drawn one module too wide.
        expect(matrix.isDark(0, matrix.size)).toBe(false);
        expect(matrix.isDark(matrix.size, 0)).toBe(false);
        expect(matrix.isDark(-1, 0)).toBe(false);
        expect(matrix.isDark(0, -1)).toBe(false);
    });

    it('is deterministic: the same string yields the same grid', () => {
        const first = renderQrMatrix({ data: DATA });
        const second = renderQrMatrix({ data: DATA });

        expect(second.size).toBe(first.size);
        for (let row = 0; row < first.size; row += 1) {
            for (let col = 0; col < first.size; col += 1) {
                expect(second.isDark(row, col)).toBe(first.isDark(row, col));
            }
        }
    });

    it('encodes the string it was given, not some other one', () => {
        const mine = renderQrMatrix({ data: DATA });
        const other = renderQrMatrix({ data: `${DATA}/different` });

        const differs =
            other.size !== mine.size ||
            (() => {
                for (let row = 0; row < mine.size; row += 1) {
                    for (let col = 0; col < mine.size; col += 1) {
                        if (other.isDark(row, col) !== mine.isDark(row, col)) return true;
                    }
                }
                return false;
            })();

        expect(differs).toBe(true);
    });

    it('honours the error-correction level, defaulting to the engine default', () => {
        const defaulted = renderQrMatrix({ data: DATA });
        const explicitM = renderQrMatrix({
            data: DATA,
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M
        });
        const high = renderQrMatrix({
            data: DATA,
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H
        });

        expect(defaulted.size).toBe(explicitM.size);
        // H spends far more modules on recovery, so the same string needs a
        // bigger symbol. If the level were being dropped these would match.
        expect(high.size).toBeGreaterThan(explicitM.size);
    });
});
