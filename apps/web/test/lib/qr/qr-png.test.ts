/**
 * @file qr-png.test.ts
 * @description Unit tests for the client-side SVG→PNG conversion used by the
 * gastronomy menu QR download button (HOS-1044 §6.6, §11 OQ-3).
 *
 * jsdom has no real `<canvas>`/`Image` decoding, so the browser-API-backed
 * steps are exercised through their injectable seams (mirrors
 * `lib/media/compress-image.ts`'s own test strategy).
 */

import { describe, expect, it } from 'vitest';
import {
    buildSvgDataUrl,
    DEFAULT_QR_PNG_SIZE_PX,
    renderSvgToPngBlob
} from '../../../src/lib/qr/qr-png';

describe('buildSvgDataUrl', () => {
    it('encodes raw SVG markup as a data: URL', () => {
        const svg = '<svg><rect width="1" height="1"/></svg>';
        const dataUrl = buildSvgDataUrl(svg);

        expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        expect(dataUrl).toContain(encodeURIComponent(svg));
    });
});

describe('renderSvgToPngBlob', () => {
    it('resolves a PNG blob using the injected load/encode steps', async () => {
        const fakeImage = {} as HTMLImageElement;
        const fakeBlob = new Blob(['fake-png-bytes'], { type: 'image/png' });

        const blob = await renderSvgToPngBlob({
            svg: '<svg></svg>',
            loadImage: async (dataUrl) => {
                expect(dataUrl.startsWith('data:image/svg+xml')).toBe(true);
                return fakeImage;
            },
            encodePng: async ({ image, sizePx }) => {
                expect(image).toBe(fakeImage);
                expect(sizePx).toBe(DEFAULT_QR_PNG_SIZE_PX);
                return fakeBlob;
            }
        });

        expect(blob).toBe(fakeBlob);
    });

    it('respects a custom sizePx', async () => {
        let receivedSize: number | undefined;

        await renderSvgToPngBlob({
            svg: '<svg></svg>',
            sizePx: 256,
            loadImage: async () => ({}) as HTMLImageElement,
            encodePng: async ({ sizePx }) => {
                receivedSize = sizePx;
                return null;
            }
        });

        expect(receivedSize).toBe(256);
    });

    it('returns null when the SVG fails to decode, without throwing', async () => {
        const blob = await renderSvgToPngBlob({
            svg: '<svg></svg>',
            loadImage: async () => {
                throw new Error('boom');
            },
            encodePng: async () => new Blob()
        });

        expect(blob).toBeNull();
    });

    it('returns null when encoding is unsupported, without throwing', async () => {
        const blob = await renderSvgToPngBlob({
            svg: '<svg></svg>',
            loadImage: async () => ({}) as HTMLImageElement,
            encodePng: async () => null
        });

        expect(blob).toBeNull();
    });

    it('returns null when the encode step itself throws', async () => {
        const blob = await renderSvgToPngBlob({
            svg: '<svg></svg>',
            loadImage: async () => ({}) as HTMLImageElement,
            encodePng: async () => {
                throw new Error('canvas exploded');
            }
        });

        expect(blob).toBeNull();
    });
});
