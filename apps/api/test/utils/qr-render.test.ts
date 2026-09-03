/**
 * Tests for the configurable QR render engine (HOS-981).
 *
 * @module test/utils/qr-render
 */

import { QrCodeErrorCorrectionLevelEnum, QrCodeFormatEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    renderQr,
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
            backgroundColor: '#ffffff'
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
                    backgroundColor: '#eeddcc'
                }
            })
        ).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 1,
            size: 256,
            foregroundColor: '#112233',
            backgroundColor: '#eeddcc'
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
