/**
 * The centre mark in the SVG OUTPUT (HOS-981 PR 5; disc since HOS-2672).
 *
 * The SVG writer emits markup in MODULE units; the PNG painter (see
 * `qr-center-logo.png.test.ts`) writes pixels at a routinely fractional scale.
 * They are two independent conversions of one geometry, and these tests read the
 * disc and the isotipo box back out of the markup, independently of the geometry
 * module, so the two outputs can be compared through observations rather than
 * through the code that produced them.
 *
 * @module test/utils/qr-center-logo.svg
 */

import { QrCodeCenterLogoEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { HOSPEDA_ISOTIPO_RADIUS_SHARE } from '../../src/utils/qr-center-logo.js';
import { renderQrSvg } from '../../src/utils/qr-render.js';
import {
    DATA,
    enclosingCircleOf,
    FROZEN_DISCS,
    H,
    type LogoBox,
    MARGIN,
    parseCircles,
    parseLogoBoxes,
    type SvgCircle
} from './qr-center-logo.fixtures.js';

describe('renderQrSvg: the mark in the markup', () => {
    it('draws nothing at all when the mark is NONE', async () => {
        const plain = await renderQrSvg({ data: DATA });
        const explicit = await renderQrSvg({
            data: DATA,
            options: { centerLogo: QrCodeCenterLogoEnum.NONE }
        });

        expect(explicit).toBe(plain);
        expect(plain).not.toContain('<circle');
        expect(plain).not.toContain('<svg x=');
    });

    it.each(FROZEN_DISCS)('places the disc at the frozen position for $level', async ({
        level,
        centre,
        radius
    }) => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: level,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                margin: MARGIN
            }
        });

        const circles = parseCircles(svg);
        expect(circles.length, 'exactly one disc is expected').toBe(1);
        const disc = circles[0] as SvgCircle;

        expect(disc.cx).toBe(centre);
        expect(disc.cy).toBe(centre);
        expect(disc.r).toBeCloseTo(radius, 6);
    });

    /**
     * The disc is bounded by the symbol and the viewBox: nothing of the mark may
     * reach the quiet zone, whose white border is how a scanner finds the symbol.
     */
    it.each(
        FROZEN_DISCS
    )('keeps the disc inside the symbol, quiet zone excluded, at $level', async ({
        level,
        moduleCount
    }) => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: level,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                margin: MARGIN
            }
        });

        const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
        expect(viewBox, 'no viewBox to bound anything against').not.toBeNull();
        const extent = Number((viewBox as RegExpExecArray)[1]);
        expect(extent).toBe(moduleCount + 2 * MARGIN);

        const disc = parseCircles(svg)[0] as SvgCircle;
        expect(disc.cx - disc.r).toBeGreaterThan(MARGIN);
        expect(disc.cy - disc.r).toBeGreaterThan(MARGIN);
        expect(disc.cx + disc.r).toBeLessThan(extent - MARGIN);
        expect(disc.cy + disc.r).toBeLessThan(extent - MARGIN);
    });

    /**
     * The ARTWORK is bounded by the disc: the assertion that makes the budgeted
     * coverage true. The isotipo's enclosing circle, mapped through the emitted
     * box into module units, must be concentric with the disc, sit inside it, and
     * be exactly the frozen share of its radius. A wrong scale in the box
     * computation overflows here while every constant is still in range.
     */
    it.each(FROZEN_DISCS)('keeps the isotipo inside the disc at $level', async ({ level }) => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: level,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                margin: MARGIN
            }
        });

        const boxes = parseLogoBoxes(svg);
        expect(boxes.length, 'exactly one nested logo <svg> is expected').toBe(1);
        const box = boxes[0] as LogoBox;
        expect(box.viewBox).toBe('7 8 517 517');
        expect(box.width).toBe(box.height);

        const disc = parseCircles(svg)[0] as SvgCircle;
        const art = enclosingCircleOf(box);

        // Concentric...
        expect(Math.hypot(art.cx - disc.cx, art.cy - disc.cy)).toBeLessThan(1e-4);
        // ...inside, with the whole circle (centre offset + radius) within the disc...
        expect(
            Math.hypot(art.cx - disc.cx, art.cy - disc.cy) + art.r,
            `the isotipo's enclosing circle (r=${art.r}) escapes the disc (r=${disc.r})`
        ).toBeLessThanOrEqual(disc.r);
        // ...and by the frozen share, so it is neither shrunk to nothing nor flush.
        expect(HOSPEDA_ISOTIPO_RADIUS_SHARE).toBe(0.9);
        expect(art.r / disc.r).toBeCloseTo(0.9, 4);
    });

    it('paints the disc in the background colour and keeps the isotipo in brand colours', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: H,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                foregroundColor: '#123456',
                backgroundColor: '#abcdef'
            }
        });

        expect((parseCircles(svg)[0] as SvgCircle).fill).toBe('#abcdef');

        for (const brand of ['#49A7CD', '#A2D636', '#359FA4', '#FFB02B']) {
            expect(svg, `missing brand colour ${brand}`).toContain(`fill="${brand}"`);
        }
        // The QR's foreground colour does NOT reach the logo.
        expect(svg.slice(svg.indexOf('<svg x='))).not.toContain('#123456');
    });

    /**
     * `qrcode` puts `shape-rendering="crispEdges"` on the root, right for square
     * modules and wrong for curves. Inherited, it would turn the disc and the
     * isotipo into staircases, so both opt back out explicitly.
     */
    it('opts the disc and the isotipo out of the root crispEdges', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: { errorCorrectionLevel: H, centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
        });

        expect(svg.slice(0, svg.indexOf('>'))).toContain('shape-rendering="crispEdges"');
        expect((parseCircles(svg)[0] as SvgCircle).shapeRendering).toBe('geometricPrecision');
        expect((parseLogoBoxes(svg)[0] as LogoBox).shapeRendering).toBe('geometricPrecision');
    });

    /** Six-digit hex plus `fill-opacity`, as `qrcode` writes colours; never `#rrggbbaa`. */
    it('writes a translucent background as six-digit hex plus fill-opacity', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: {
                errorCorrectionLevel: H,
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                backgroundColor: '#ABCDEF80'
            }
        });
        const disc = parseCircles(svg)[0] as SvgCircle;

        expect(disc.fill).toBe('#abcdef');
        expect(disc.fillOpacity).toBeCloseTo(128 / 255, 3);
        expect(svg).not.toMatch(/fill="#[0-9a-fA-F]{8}"/);
    });

    it('writes no fill-opacity for an opaque background', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: { errorCorrectionLevel: H, centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
        });

        expect((parseCircles(svg)[0] as SvgCircle).fillOpacity).toBeNull();
    });

    /**
     * An SVG `id` is document-global: several codes inlined in one page must not
     * all declare the source file's generic `silueta`.
     */
    it('namespaces the clip id, and every reference to it', async () => {
        const svg = await renderQrSvg({
            data: DATA,
            options: { errorCorrectionLevel: H, centerLogo: QrCodeCenterLogoEnum.HOSPEDA }
        });

        expect(svg).toContain('<clipPath id="hospeda-qr-isotipo-clip">');
        expect(svg).toContain('clip-path="url(#hospeda-qr-isotipo-clip)"');
        expect(svg).not.toContain('silueta');
        expect(svg.match(/\bid="/g)?.length).toBe(1);
    });

    it('is still deterministic with the mark on', async () => {
        const options = { errorCorrectionLevel: H, centerLogo: QrCodeCenterLogoEnum.HOSPEDA };

        expect(await renderQrSvg({ data: DATA, options })).toBe(
            await renderQrSvg({ data: DATA, options })
        );
    });
});
