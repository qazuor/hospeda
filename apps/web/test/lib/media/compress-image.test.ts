/**
 * @file compress-image.test.ts
 * @description Tests for the client-side image resize/recompress pipeline
 * (HOS-332).
 *
 * jsdom has no real `<canvas>`/`createImageBitmap` implementation, so every
 * test here injects `decodeImage`/`encodeCanvas` test seams instead of
 * exercising the real browser APIs. Assertions focus on the DECISION logic —
 * does it compress, with which parameters, and what happens when a step
 * fails — never on a mocked canvas "drawing" anything.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    compressImageForUpload,
    computeScaledDimensions,
    DEFAULT_COMPRESSION_MAX_DIMENSION_PX,
    DEFAULT_COMPRESSION_QUALITY,
    DEFAULT_COMPRESSION_SKIP_BELOW_BYTES,
    isCompressionUnavailable,
    resolveCompressionOutputMimeType,
    shouldAttemptCompression
} from '@/lib/media/compress-image';

/** A big buffer over the default skip threshold, for a File constructor. */
const bigBuffer = (bytes: number) => new Uint8Array(bytes);

const makeFile = (params: {
    readonly name: string;
    readonly type: string;
    readonly bytes: number;
}) => new File([bigBuffer(params.bytes)], params.name, { type: params.type });

/** A stub `ImageBitmap` — only the properties this module reads. */
function makeBitmap(params: { readonly width: number; readonly height: number }): ImageBitmap {
    return {
        width: params.width,
        height: params.height,
        close: vi.fn()
    } as unknown as ImageBitmap;
}

describe('computeScaledDimensions', () => {
    it('leaves dimensions unchanged when already within the cap', () => {
        expect(computeScaledDimensions({ width: 800, height: 600, maxDimensionPx: 2560 })).toEqual({
            width: 800,
            height: 600
        });
    });

    it('scales the longer side down to the cap, preserving aspect ratio', () => {
        // 4000x3000 (4:3) capped at 2000 -> 2000x1500
        expect(
            computeScaledDimensions({ width: 4000, height: 3000, maxDimensionPx: 2000 })
        ).toEqual({ width: 2000, height: 1500 });
    });

    it('scales by height when the image is portrait', () => {
        // 3000x4000 portrait capped at 2000 -> 1500x2000
        expect(
            computeScaledDimensions({ width: 3000, height: 4000, maxDimensionPx: 2000 })
        ).toEqual({ width: 1500, height: 2000 });
    });

    it('never produces a zero dimension for an extreme aspect ratio', () => {
        const { width, height } = computeScaledDimensions({
            width: 10000,
            height: 1,
            maxDimensionPx: 100
        });
        expect(width).toBe(100);
        expect(height).toBeGreaterThanOrEqual(1);
    });
});

describe('resolveCompressionOutputMimeType', () => {
    it('keeps JPEG as JPEG', () => {
        expect(resolveCompressionOutputMimeType('image/jpeg')).toBe('image/jpeg');
    });

    it('keeps PNG as PNG', () => {
        expect(resolveCompressionOutputMimeType('image/png')).toBe('image/png');
    });

    it('keeps WebP as WebP', () => {
        expect(resolveCompressionOutputMimeType('image/webp')).toBe('image/webp');
    });

    it('falls back to JPEG for a format canvas cannot encode (HEIC)', () => {
        expect(resolveCompressionOutputMimeType('image/heic')).toBe('image/jpeg');
    });

    it('falls back to JPEG for AVIF', () => {
        expect(resolveCompressionOutputMimeType('image/avif')).toBe('image/jpeg');
    });
});

describe('shouldAttemptCompression', () => {
    it('is false for a file at or under the default threshold', () => {
        expect(
            shouldAttemptCompression({ fileSizeBytes: DEFAULT_COMPRESSION_SKIP_BELOW_BYTES })
        ).toBe(false);
        expect(shouldAttemptCompression({ fileSizeBytes: 100 })).toBe(false);
    });

    it('is true for a file over the default threshold', () => {
        expect(
            shouldAttemptCompression({ fileSizeBytes: DEFAULT_COMPRESSION_SKIP_BELOW_BYTES + 1 })
        ).toBe(true);
    });

    it('honors a caller-supplied threshold', () => {
        expect(shouldAttemptCompression({ fileSizeBytes: 500, skipBelowBytes: 100 })).toBe(true);
        expect(shouldAttemptCompression({ fileSizeBytes: 50, skipBelowBytes: 100 })).toBe(false);
    });
});

describe('compressImageForUpload', () => {
    it('skips compression for a file at or under the threshold, without touching decode/encode', async () => {
        const file = makeFile({ name: 'small.jpg', type: 'image/jpeg', bytes: 1000 });
        const decodeImage = vi.fn();
        const encodeCanvas = vi.fn();

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome).toEqual({ file, wasCompressed: false, reason: 'already-small' });
        expect(decodeImage).not.toHaveBeenCalled();
        expect(encodeCanvas).not.toHaveBeenCalled();
    });

    it('falls back to the original file, unmodified, when decoding fails (e.g. HEIC on Chrome)', async () => {
        const file = makeFile({
            name: 'photo.heic',
            type: 'image/heic',
            bytes: DEFAULT_COMPRESSION_SKIP_BELOW_BYTES + 1
        });
        const decodeImage = vi.fn().mockRejectedValue(new Error('unsupported format'));
        const encodeCanvas = vi.fn();

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome.wasCompressed).toBe(false);
        expect(outcome).toMatchObject({ reason: 'decode-unsupported' });
        // The EXACT same File instance is returned — nothing else may
        // silently substitute a different object for the upload to send.
        expect(outcome.file).toBe(file);
        expect(encodeCanvas).not.toHaveBeenCalled();
    });

    it('never rejects when decoding throws — the promise always resolves', async () => {
        const file = makeFile({
            name: 'photo.heic',
            type: 'image/heic',
            bytes: DEFAULT_COMPRESSION_SKIP_BELOW_BYTES + 1
        });
        const decodeImage = vi.fn().mockRejectedValue(new Error('boom'));

        await expect(compressImageForUpload({ file, decodeImage })).resolves.toMatchObject({
            wasCompressed: false
        });
    });

    it('decodes with imageOrientation "from-image" to preserve EXIF rotation', async () => {
        // This is the regression this module exists to prevent: a canvas
        // redraw with no orientation hint rotates every portrait phone photo
        // 90 degrees, because canvas has no concept of EXIF.
        const file = makeFile({
            name: 'portrait.jpg',
            type: 'image/jpeg',
            bytes: DEFAULT_COMPRESSION_SKIP_BELOW_BYTES + 1
        });
        let capturedOptions: ImageBitmapOptions | undefined;
        const realCreateImageBitmap = globalThis.createImageBitmap;
        globalThis.createImageBitmap = vi.fn(
            (_source: ImageBitmapSource, options?: ImageBitmapOptions) => {
                capturedOptions = options;
                return Promise.resolve(makeBitmap({ width: 100, height: 100 }));
            }
        ) as unknown as typeof createImageBitmap;

        try {
            const encodeCanvas = vi.fn().mockResolvedValue(new Blob(['x']));
            await compressImageForUpload({ file, encodeCanvas });
        } finally {
            globalThis.createImageBitmap = realCreateImageBitmap;
        }

        expect(capturedOptions).toEqual({ imageOrientation: 'from-image' });
    });

    it('produces a smaller File at the resolved dimensions and quality on the happy path', async () => {
        const file = makeFile({
            name: 'photo.jpg',
            type: 'image/jpeg',
            bytes: 5_000_000
        });
        const bitmap = makeBitmap({ width: 5000, height: 2500 });
        const decodeImage = vi.fn().mockResolvedValue(bitmap);
        const encodeCanvas = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));

        const outcome = await compressImageForUpload({
            file,
            decodeImage,
            encodeCanvas,
            maxDimensionPx: 2560,
            quality: 0.85
        });

        expect(encodeCanvas).toHaveBeenCalledWith({
            bitmap,
            width: 2560,
            height: 1280,
            mimeType: 'image/jpeg',
            quality: 0.85
        });
        expect(outcome.wasCompressed).toBe(true);
        if (outcome.wasCompressed) {
            expect(outcome.file.type).toBe('image/jpeg');
            expect(outcome.file.name).toBe('photo.jpg');
            expect(outcome.compressedBytes).toBeLessThan(outcome.originalBytes);
        }
        expect(bitmap.close).toHaveBeenCalled();
    });

    it('renames a HEIC input to .jpg when it decodes and re-encodes as JPEG', async () => {
        const file = makeFile({
            name: 'IMG_0001.heic',
            type: 'image/heic',
            bytes: 5_000_000
        });
        const decodeImage = vi.fn().mockResolvedValue(makeBitmap({ width: 1000, height: 1000 }));
        const encodeCanvas = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome.wasCompressed).toBe(true);
        if (outcome.wasCompressed) {
            expect(outcome.file.name).toBe('IMG_0001.jpg');
            expect(outcome.file.type).toBe('image/jpeg');
        }
    });

    it('falls back to the original when encoding produces null (unsupported environment)', async () => {
        const file = makeFile({ name: 'photo.jpg', type: 'image/jpeg', bytes: 5_000_000 });
        const decodeImage = vi.fn().mockResolvedValue(makeBitmap({ width: 1000, height: 1000 }));
        const encodeCanvas = vi.fn().mockResolvedValue(null);

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome).toEqual({ file, wasCompressed: false, reason: 'encode-unsupported' });
    });

    it('falls back to the original when encoding throws', async () => {
        const file = makeFile({ name: 'photo.jpg', type: 'image/jpeg', bytes: 5_000_000 });
        const decodeImage = vi.fn().mockResolvedValue(makeBitmap({ width: 1000, height: 1000 }));
        const encodeCanvas = vi.fn().mockRejectedValue(new Error('encode boom'));

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome).toEqual({ file, wasCompressed: false, reason: 'encode-unsupported' });
    });

    it('falls back to the original when the "compressed" blob is not actually smaller', async () => {
        const file = makeFile({ name: 'tiny-but-heavy.jpg', type: 'image/jpeg', bytes: 5_000_000 });
        const decodeImage = vi.fn().mockResolvedValue(makeBitmap({ width: 1000, height: 1000 }));
        // Bigger than the original 5_000_000 bytes.
        const encodeCanvas = vi.fn().mockResolvedValue(new Blob([bigBuffer(6_000_000)]));

        const outcome = await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(outcome).toEqual({ file, wasCompressed: false, reason: 'no-size-gain' });
    });

    it('closes the decoded bitmap even when encoding fails', async () => {
        const file = makeFile({ name: 'photo.jpg', type: 'image/jpeg', bytes: 5_000_000 });
        const bitmap = makeBitmap({ width: 1000, height: 1000 });
        const decodeImage = vi.fn().mockResolvedValue(bitmap);
        const encodeCanvas = vi.fn().mockRejectedValue(new Error('boom'));

        await compressImageForUpload({ file, decodeImage, encodeCanvas });

        expect(bitmap.close).toHaveBeenCalled();
    });
});

describe('isCompressionUnavailable', () => {
    it('is true when decoding was unsupported', () => {
        expect(
            isCompressionUnavailable({
                file: makeFile({ name: 'a.heic', type: 'image/heic', bytes: 10 }),
                wasCompressed: false,
                reason: 'decode-unsupported'
            })
        ).toBe(true);
    });

    it('is true when encoding was unsupported', () => {
        expect(
            isCompressionUnavailable({
                file: makeFile({ name: 'a.jpg', type: 'image/jpeg', bytes: 10 }),
                wasCompressed: false,
                reason: 'encode-unsupported'
            })
        ).toBe(true);
    });

    it('is false when the file was simply already small', () => {
        expect(
            isCompressionUnavailable({
                file: makeFile({ name: 'a.jpg', type: 'image/jpeg', bytes: 10 }),
                wasCompressed: false,
                reason: 'already-small'
            })
        ).toBe(false);
    });

    it('is false when compression genuinely succeeded', () => {
        expect(
            isCompressionUnavailable({
                file: makeFile({ name: 'a.jpg', type: 'image/jpeg', bytes: 10 }),
                wasCompressed: true,
                originalBytes: 100,
                compressedBytes: 10
            })
        ).toBe(false);
    });
});

// Sanity: defaults are what the module header claims, so a future edit to
// the tunables cannot silently drift without a test noticing.
describe('defaults', () => {
    it('exposes the documented defaults', () => {
        expect(DEFAULT_COMPRESSION_MAX_DIMENSION_PX).toBe(2560);
        expect(DEFAULT_COMPRESSION_QUALITY).toBe(0.85);
        expect(DEFAULT_COMPRESSION_SKIP_BELOW_BYTES).toBe(1_000_000);
    });
});

describe('real default decode/encode path (no injected seams — HOS-332 verification requirement)', () => {
    it('MANDATORY: falls back to the original file, with no error, when the environment cannot decode the image', async () => {
        // No `decodeImage`/`encodeCanvas` overrides here: this exercises the
        // REAL `createImageBitmap`-based default. jsdom provides no such API
        // (nor a real canvas), which is exactly the same failure shape as
        // Chrome trying to decode a HEIC file — so this doubles as a live
        // regression test for the mandatory "never blocks the upload" case,
        // without needing to fake a specific unsupported format.
        const file = new File(
            [new Uint8Array(new ArrayBuffer(DEFAULT_COMPRESSION_SKIP_BELOW_BYTES + 1))],
            'photo.jpg',
            { type: 'image/jpeg' }
        );

        const outcome = await compressImageForUpload({ file });

        expect(outcome.wasCompressed).toBe(false);
        expect(outcome.file).toBe(file);
        if (!outcome.wasCompressed) {
            expect(['decode-unsupported', 'encode-unsupported']).toContain(outcome.reason);
        }
    });
});
