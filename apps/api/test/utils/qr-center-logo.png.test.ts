/**
 * The centre mark in the PNG OUTPUT, and its agreement with the SVG (HOS-981 PR 5;
 * disc since HOS-2672).
 *
 * The PNG painter writes RGBA bytes in PIXELS at a scale that is routinely
 * fractional (512 px over a 33-module symbol with a 4-module quiet zone is
 * 12.487...). If it disagrees with the SVG's module-unit geometry, the two
 * formats of the SAME configured code cover different modules. The two
 * observations here are independent: pixels scanned out of a decoded buffer
 * against attributes parsed out of markup.
 *
 * @module test/utils/qr-center-logo.png
 */

import { QrCodeCenterLogoEnum } from '@repo/schemas';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { HOSPEDA_ISOTIPO_RADIUS_SHARE } from '../../src/utils/qr-center-logo.js';
import { renderQrPng, renderQrSvg } from '../../src/utils/qr-render.js';
import {
    ALLOWED_LEVELS,
    DATA,
    FROZEN_DISCS,
    H,
    MARGIN,
    parseCircles,
    type SvgCircle
} from './qr-center-logo.fixtures.js';

/** How many pixels differ between two renders, and the farthest one from a centre. */
function changedPixelDistances(input: { marked: PNG; plain: PNG; centre: number }): {
    readonly count: number;
    readonly farthest: number;
} {
    const { marked, plain, centre } = input;
    let count = 0;
    let farthest = 0;

    for (let y = 0; y < marked.height; y += 1) {
        for (let x = 0; x < marked.width; x += 1) {
            const index = (marked.width * y + x) << 2;
            const same =
                marked.data[index] === plain.data[index] &&
                marked.data[index + 1] === plain.data[index + 1] &&
                marked.data[index + 2] === plain.data[index + 2] &&
                marked.data[index + 3] === plain.data[index + 3];
            if (same) continue;

            count += 1;
            farthest = Math.max(farthest, Math.hypot(x + 0.5 - centre, y + 0.5 - centre));
        }
    }

    return { count, farthest };
}

/** Euclidean distance in RGB from `point` to the segment `start`..`end`. */
function distanceToSegment(
    point: readonly number[],
    start: readonly number[],
    end: readonly number[]
): number {
    const edge = end.map((value, axis) => value - (start[axis] as number));
    const offset = point.map((value, axis) => value - (start[axis] as number));
    const lengthSquared = edge.reduce((sum, value) => sum + value * value, 0);
    const along =
        lengthSquared === 0
            ? 0
            : Math.min(
                  1,
                  Math.max(
                      0,
                      offset.reduce((sum, value, axis) => sum + value * (edge[axis] as number), 0) /
                          lengthSquared
                  )
              );

    return Math.hypot(...offset.map((value, axis) => value - along * (edge[axis] as number)));
}

describe('renderQrPng: the mark in the pixels, and its agreement with the SVG', () => {
    it('returns the library bytes untouched when the mark is NONE', async () => {
        const plain = await renderQrPng({ data: DATA });
        const explicit = await renderQrPng({
            data: DATA,
            options: { centerLogo: QrCodeCenterLogoEnum.NONE }
        });

        expect(explicit.equals(plain)).toBe(true);
    });

    /**
     * Nothing outside the disc is touched, observed by diffing the marked render
     * against the UNMARKED render of the same code: shape-agnostic, so it does
     * not restate the geometry it is checking. The anti-aliased rim reaches half
     * a pixel past the radius, and one more pixel of slack is allowed for the
     * fractional scale, and no more: a module is at least 6 px here.
     */
    it.each(
        ALLOWED_LEVELS.flatMap((frozen) => [256, 512, 1024].map((size) => ({ ...frozen, size })))
    )('changes pixels only inside the disc: $level at $size px', async ({
        level,
        moduleCount,
        radius,
        size
    }) => {
        const base = { errorCorrectionLevel: level, margin: MARGIN, size };
        const plain = PNG.sync.read(await renderQrPng({ data: DATA, options: base }));
        const marked = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: { ...base, centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
            })
        );

        const scale = marked.width / (moduleCount + 2 * MARGIN);
        const centre = (moduleCount / 2 + MARGIN) * scale;
        const { count, farthest } = changedPixelDistances({ marked, plain, centre });

        // Something was painted, a meaningful part of the disc: without this the
        // containment below holds vacuously for a renderer that draws nothing.
        expect(count).toBeGreaterThan(0.15 * Math.PI * (radius * scale) ** 2);
        expect(farthest).toBeLessThanOrEqual(radius * scale + 1.5);
        // And the paint REACHES the rim: a disc drawn much smaller than the SVG's
        // would also stay "inside", so the other bound is what proves its size.
        expect(farthest).toBeGreaterThan(0.95 * radius * scale);
    });

    /**
     * The disc in the SVG and the disc in the PNG are the SAME disc. The PNG's is
     * measured from pixels (the farthest changed pixel from the SVG's centre), the
     * SVG's is read from markup; neither number comes from the geometry module.
     * The disc blanks black modules at its rim, so the changed area really does
     * reach the edge.
     */
    it('draws the same disc in the SVG and in the PNG', async () => {
        const frozen = FROZEN_DISCS[3];
        const options = {
            errorCorrectionLevel: frozen.level,
            centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
            margin: MARGIN
        };

        const svgDisc = parseCircles(await renderQrSvg({ data: DATA, options }))[0] as SvgCircle;

        const plain = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: { errorCorrectionLevel: frozen.level, margin: MARGIN, size: 1024 }
            })
        );
        const marked = PNG.sync.read(
            await renderQrPng({ data: DATA, options: { ...options, size: 1024 } })
        );
        const scale = marked.width / (frozen.moduleCount + 2 * MARGIN);

        const { farthest } = changedPixelDistances({ marked, plain, centre: svgDisc.cx * scale });
        expect(farthest / scale).toBeLessThanOrEqual(svgDisc.r + 1.5 / scale);
        expect(farthest / scale).toBeGreaterThan(0.95 * svgDisc.r);
    });

    /**
     * The pixels carry the BRAND colours, composited over the disc, and none of
     * them lies outside the isotipo's enclosing circle (which sits inside the
     * disc). The plain QR is strictly grey, so ANY pixel with a colour cast is the
     * artwork: scanning the whole image for it is what makes "no logo pixel
     * outside the disc" an observation and not an assumption.
     */
    it.each(
        ALLOWED_LEVELS
    )('paints brand colours only inside the artwork circle at $level', async ({
        level,
        moduleCount,
        radius
    }) => {
        const marked = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: {
                    errorCorrectionLevel: level,
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    margin: MARGIN,
                    size: 1024,
                    foregroundColor: '#000000'
                }
            })
        );
        const scale = marked.width / (moduleCount + 2 * MARGIN);
        const centre = (moduleCount / 2 + MARGIN) * scale;
        const artRadius = HOSPEDA_ISOTIPO_RADIUS_SHARE * radius * scale;

        let orange = 0;
        let blue = 0;
        let green = 0;
        let coloured = 0;
        let farthestColoured = 0;
        for (let y = 0; y < marked.height; y += 1) {
            for (let x = 0; x < marked.width; x += 1) {
                const index = (marked.width * y + x) << 2;
                const r = marked.data[index] as number;
                const g = marked.data[index + 1] as number;
                const b = marked.data[index + 2] as number;

                if (r > 230 && g > 150 && g < 200 && b < 90) orange += 1; // #FFB02B
                if (r < 100 && g > 140 && g < 190 && b > 190) blue += 1; // #49A7CD
                if (r > 140 && r < 180 && g > 200 && b < 90) green += 1; // #A2D636

                if (Math.max(r, g, b) - Math.min(r, g, b) > 12) {
                    coloured += 1;
                    farthestColoured = Math.max(
                        farthestColoured,
                        Math.hypot(x + 0.5 - centre, y + 0.5 - centre)
                    );
                }
            }
        }

        expect(orange, 'no orange sun pixels').toBeGreaterThan(5);
        expect(blue, 'no blue pixels').toBeGreaterThan(50);
        expect(green, 'no green pixels').toBeGreaterThan(20);
        expect(coloured).toBeGreaterThan(200);
        // One pixel of slack for the anti-aliased rim of the artwork.
        expect(
            farthestColoured,
            `a coloured pixel lies ${farthestColoured.toFixed(1)} px from the centre, outside ` +
                `the artwork circle (${artRadius.toFixed(1)} px): the isotipo escaped its disc`
        ).toBeLessThanOrEqual(artRadius + 1.5);
    });

    /**
     * A translucent background (`#rrggbbaa` is accepted) must composite
     * correctly. With a fully transparent disc, every artwork pixel sits over
     * alpha 0, so its straight RGB must be the BRAND colour at a partial alpha.
     * Premultiplied bytes written as if straight would darken the rim (an
     * orange at alpha 128 would read as half-dark orange), and a channel-wise
     * lerp of the disc edge would do the same. Observed on pixels the artwork
     * actually painted (alpha strictly between 0 and 255).
     */
    it('composites correctly over a transparent background: brand colour, partial alpha', async () => {
        const frozen = FROZEN_DISCS[3];
        const marked = PNG.sync.read(
            await renderQrPng({
                data: DATA,
                options: {
                    errorCorrectionLevel: frozen.level,
                    centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                    margin: MARGIN,
                    size: 1024,
                    backgroundColor: '#ffffff00'
                }
            })
        );
        const brand = [
            [0x49, 0xa7, 0xcd],
            [0xa2, 0xd6, 0x36],
            [0x35, 0x9f, 0xa4],
            [0xff, 0xb0, 0x2b]
        ] as const;
        const scale = marked.width / (frozen.moduleCount + 2 * MARGIN);
        const centre = (frozen.moduleCount / 2 + MARGIN) * scale;
        const artRadius = HOSPEDA_ISOTIPO_RADIUS_SHARE * frozen.radius * scale;

        let partial = 0;
        let offBrand = 0;
        let opaqueArtwork = 0;
        for (let y = 0; y < marked.height; y += 1) {
            for (let x = 0; x < marked.width; x += 1) {
                if (Math.hypot(x + 0.5 - centre, y + 0.5 - centre) > artRadius - 1) continue;
                const index = (marked.width * y + x) << 2;
                const alpha = marked.data[index + 3] as number;
                if (alpha === 255) opaqueArtwork += 1;
                // Below 64 the 8-bit premultiplied quantisation alone is worth
                // several channel levels, so those pixels cannot discriminate.
                if (alpha < 64 || alpha === 255) continue;
                partial += 1;

                // A rim pixel is a brand colour, or a blend of two of them where
                // two shapes meet at the silhouette's edge (blue under green, say).
                // Three shapes can meet at one rim pixel, so 25 levels of slack are
                // allowed off the segments. Premultiplied bytes read as straight
                // would be off by `colour x (1 - alpha)`, at least 190 levels at the
                // alpha-64 floor used here, so the slack cannot hide that bug.
                const pixel = [
                    marked.data[index] as number,
                    marked.data[index + 1] as number,
                    marked.data[index + 2] as number
                ];
                const close = brand.some((first) =>
                    brand.some((second) => distanceToSegment(pixel, first, second) <= 25)
                );
                if (!close) offBrand += 1;
            }
        }

        expect(opaqueArtwork, 'the artwork body must be opaque').toBeGreaterThan(1000);
        expect(partial, 'no anti-aliased artwork rim to inspect').toBeGreaterThan(50);
        expect(
            offBrand,
            `${offBrand} of ${partial} rim pixels are not a brand colour: the compositing is ` +
                'treating premultiplied colour as straight (darkened rim)'
        ).toBe(0);
    });

    it('is still deterministic with the mark on', async () => {
        const options = {
            errorCorrectionLevel: H,
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
