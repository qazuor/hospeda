/**
 * Does a code with the mark on it still SCAN? (HOS-981 PR 5)
 *
 * ## Why a real decoder, and not arithmetic
 *
 * The gate in `@repo/schemas` is a calculation: coverage against a share of a
 * measured tolerance. A calculation can be self-consistently wrong — the
 * numbers agree with each other and every symbol it approves is unreadable. The
 * only thing that answers the question the issue actually asks is a decoder
 * pointed at the bytes the platform ships. So this file feeds `jsqr` the exact
 * buffer `renderQrPng` returns and demands the original URL back.
 *
 * `jsqr` was chosen over `@zxing/library` for two reasons that both matter
 * here: it is a dependency-free ~30 KB pure-JS decoder (zxing pulls a large
 * tree and peers), and it takes raw RGBA — which is precisely what `pngjs`
 * hands back from a REAL PNG. That pairing is what lets this test decode the
 * shipped artefact rather than a reconstruction of it. `pngjs` is not a new
 * package in the tree either: `qrcode@1.5.4` already depends on `pngjs@5.0.0`,
 * so declaring it as a direct dependency downloaded nothing (`pnpm add` reported
 * `downloaded 0, added 0`).
 *
 * ## What is proved here, and what is NOT
 *
 * PROVED: the PNG that `renderQrPng` returns, with the mark painted on it,
 * decodes to the encoded URL — at three sizes and every correction level.
 *
 * NOT PROVED, and worth saying because a green suite invites the opposite
 * reading: that a marked code decodes for EVERY string. The failure point moves
 * with the content, because the string chooses the QR version and therefore how
 * much a given area costs in codewords. This file samples one URL; the corpus
 * that set the ceilings is seven, and even there the transition is a band
 * rather than a line (see `QR_CODE_ERROR_CORRECTION_DECODE_CEILING`).
 *
 * NOT PROVED: the same for the SVG. Rasterising an SVG needs a renderer this
 * repo does not have (`@resvg/resvg-wasm` exists only as a deep transitive of
 * `@vercel/og`, and pulling in `sharp` for a test is not a trade worth making).
 * The SVG is covered a different way, in `qr-center-logo.test.ts`: its plate is
 * parsed out of the markup and shown to cover the SAME MODULES the PNG's paint
 * actually touched, measured from pixels. So the chain is: the PNG decodes, and
 * the SVG damages the same modules as the PNG. That is one inference short of a
 * direct proof, and it is stated rather than glossed.
 *
 * @module test/utils/qr-center-logo.decode
 */

import { QrCodeCenterLogoEnum, QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { centerLogoCoverage, paintCenterLogoOnPng } from '../../src/utils/qr-center-logo.js';
import { renderQrMatrix, renderQrPng } from '../../src/utils/qr-render.js';

const DATA = 'https://hospeda.com.ar/q/k7Qm2XbT';
const MARGIN = 4;
const SIZES = [256, 512, 1024] as const;

const ALL_LEVELS = [
    QrCodeErrorCorrectionLevelEnum.L,
    QrCodeErrorCorrectionLevelEnum.M,
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

/** The gate's verdict, restated here so this file can be read on its own. */
const LEVELS_THE_GATE_ALLOWS = [
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

/** Feeds a PNG buffer to a real QR decoder. */
function decode(buffer: Buffer): string | null {
    const png = PNG.sync.read(buffer);
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    return result?.data ?? null;
}

describe('a code carrying the mark still scans', () => {
    it('decodes without the mark, which is the control for everything below', async () => {
        let checked = 0;
        for (const size of SIZES) {
            expect(await renderQrPng({ data: DATA, options: { size } }).then(decode)).toBe(DATA);
            checked += 1;
        }
        expect(checked).toBe(SIZES.length);
    });

    it.each(
        LEVELS_THE_GATE_ALLOWS
    )('decodes with the mark at %s, the levels the gate approves', async (errorCorrectionLevel) => {
        let checked = 0;
        for (const size of SIZES) {
            const buffer = await renderQrPng({
                data: DATA,
                options: {
                    errorCorrectionLevel,
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    margin: MARGIN,
                    size
                }
            });

            expect(
                decode(buffer),
                `A ${errorCorrectionLevel} code at ${size}px stopped decoding with the mark ` +
                    'on. The gate approves this configuration, so this is a code the panel ' +
                    'will happily let somebody print.'
            ).toBe(DATA);
            checked += 1;
        }
        expect(checked).toBe(SIZES.length);
    });

    /**
     * The levels the gate REFUSES also decode on a pristine render — and saying
     * so is the honest reading of the measurement.
     *
     * The gate is not "L and M produce an unreadable symbol". At the shipped
     * ratio all four levels decode from a clean 1024-px buffer. What the gate
     * refuses is spending MORE THAN HALF of a level's measured tolerance on
     * decoration, because the other half is what a printed sticker needs for
     * scuffing, folding, glare and a bad camera — and none of that is in this
     * buffer. Pinning the fact here stops a future reader from concluding the
     * gate is redundant on the strength of a screen test.
     */
    it.each(
        ALL_LEVELS
    )('still decodes at %s on a pristine render — the gate is about MARGIN, not about this', async (errorCorrectionLevel) => {
        const buffer = await renderQrPng({
            data: DATA,
            options: {
                errorCorrectionLevel,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                margin: MARGIN,
                size: 1024
            }
        });

        expect(decode(buffer)).toBe(DATA);
    });
});

/**
 * The negative control, without which none of the above proves anything.
 *
 * "It decodes" is only evidence if the same measurement can also come back
 * NEGATIVE. A decoder that returned the URL no matter what was painted over the
 * symbol — or a painter that quietly drew nothing — would satisfy every
 * assertion in the block above. So: paint an oversized plate onto the same real
 * buffer, through the same painter, and demand the decode FAIL.
 *
 * The oversized case goes through `paintCenterLogoOnPng` with an explicit
 * `sizeRatio` rather than through `renderQrPng`, because `renderQrPng` has no
 * way to be asked for a bad logo — which is the correct shape for production
 * code and the reason the seam exists.
 */
describe('the negative control: an oversized mark must STOP decoding', () => {
    it('fails to decode once the plate covers a third of the symbol', async () => {
        const errorCorrectionLevel = QrCodeErrorCorrectionLevelEnum.H;
        const moduleCount = renderQrMatrix({ data: DATA, errorCorrectionLevel }).size;

        const buffer = await renderQrPng({
            data: DATA,
            options: { errorCorrectionLevel, margin: MARGIN, size: 1024 }
        });
        const png = PNG.sync.read(buffer);

        // Sanity: the very same buffer decodes before it is damaged. Without
        // this, a decode failure below could be a broken fixture rather than
        // the damage doing its job.
        expect(decode(PNG.sync.write(png))).toBe(DATA);

        // 0.6, not 0.5. The 2026-09-04 re-sweep showed the failure is GRADUAL
        // (see `QR_CODE_ERROR_CORRECTION_DECODE_CEILING`), and at H a 15-module
        // plate — which is what 0.5 snaps to on this symbol — sits at 19.5%
        // coverage, inside the partial band where 10 of 35 sampled renders
        // still decoded. A negative control parked on a band edge is a flake
        // waiting for a different URL. 0.6 lands at ~33%, past the step where
        // nothing survived at all.
        const sizeRatio = 0.6;
        paintCenterLogoOnPng({
            png,
            moduleCount,
            margin: MARGIN,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            sizeRatio
        });

        const coverage = centerLogoCoverage({ moduleCount, sizeRatio });
        expect(coverage).toBeGreaterThan(0.3);

        expect(
            decode(PNG.sync.write(png)),
            `A plate covering ${(coverage * 100).toFixed(1)}% of the symbol still decoded. That ` +
                'does not mean QR codes are indestructible — it means this test cannot tell a ' +
                'readable code from an unreadable one, and every "it decodes" assertion in this ' +
                'file is therefore worth nothing.'
        ).toBeNull();
    });

    /**
     * The shipped mark sits well below the point where damage starts to bite —
     * measured, at the level the gate approves. A number, not a feeling: the
     * plate would have to be more than five times its area before this symbol
     * stopped decoding outright.
     *
     * "Outright" is doing work in that sentence. The failure is gradual, so the
     * honest statement is a ratio against the coverage where NOTHING survived,
     * not against a threshold — see `QR_CODE_ERROR_CORRECTION_DECODE_CEILING`
     * for the band this glosses over.
     */
    it('leaves a wide gap between the shipped coverage and the failure point', () => {
        const moduleCount = renderQrMatrix({
            data: DATA,
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H
        }).size;

        const shipped = centerLogoCoverage({ moduleCount });
        const breaking = centerLogoCoverage({ moduleCount, sizeRatio: 0.6 });

        expect(shipped).toBeGreaterThan(0);
        expect(breaking / shipped).toBeGreaterThan(5);
    });
});
