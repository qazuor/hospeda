import { describe, expect, it } from 'vitest';
import {
    AVATAR_ALLOWED_MIME_TYPES,
    ENTITY_ALLOWED_MIME_TYPES,
    validateMediaFile
} from '../validate-media-file.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal 1x1 red PNG (67 bytes, base64-encoded).
 * Used as the canonical valid image buffer in all tests that need a parseable image.
 */
function createMinimalPng(): Buffer {
    return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
    );
}

/**
 * Creates a buffer of the given byte count filled with zeros.
 * Safe to use for size-limit tests because the size check runs before image parsing.
 */
function createZeroBuffer(bytes: number): Buffer {
    return Buffer.alloc(bytes);
}

/**
 * Minimal 1x1 JPEG (~125 bytes). Hand-crafted SOI + APP0/JFIF + SOF0 + DQT + DHT + SOS + EOI.
 * Used to assert magic-byte happy path for `image/jpeg`.
 */
function createMinimalJpeg(): Buffer {
    return Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAH//2Q==',
        'base64'
    );
}

/**
 * Creates a synthetic PNG header buffer that declares an arbitrary width/height.
 * This is enough for `image-size` to read the IHDR chunk without needing real image data.
 *
 * Used to test the decompression-bomb guard: we need a buffer whose dimensions
 * parse to an arbitrary large value, regardless of payload.
 */
function createPngWithDimensions(width: number, height: number): Buffer {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR chunk: length(4) + 'IHDR'(4) + data(13) + crc(4) = 25 bytes
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 2; // color type (RGB)
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace

    const ihdrLen = Buffer.alloc(4);
    ihdrLen.writeUInt32BE(13, 0);
    const ihdrType = Buffer.from('IHDR', 'ascii');
    const ihdrCrc = Buffer.alloc(4); // CRC not validated by image-size

    return Buffer.concat([signature, ihdrLen, ihdrType, ihdrData, ihdrCrc]);
}

/**
 * Builds a minimal ISO Base Media (`ftyp`) header with the given brand.
 * Padded to 12 bytes so it satisfies `detectMimeFromMagic`'s length guard.
 * Used to prove that the magic-byte detector recognises the brand without
 * needing real codec payload (GAP-078-205).
 */
function createIsoFtypHeader(brand: string): Buffer {
    // 4 bytes box size (placeholder) + 'ftyp' (4) + 4-char brand = 12 bytes
    const sizeAndType = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const brandBytes = Buffer.from(brand.padEnd(4, ' ').slice(0, 4), 'ascii');
    return Buffer.concat([sizeAndType, brandBytes]);
}

/**
 * Builds a minimal RIFF/WEBP container header (12 bytes), enough for the
 * magic-byte detector to identify the format without any VP8 payload.
 */
function createWebpHeader(): Buffer {
    return Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // 'RIFF'
        0x00,
        0x00,
        0x00,
        0x00, // file size (placeholder)
        0x57,
        0x45,
        0x42,
        0x50 // 'WEBP'
    ]);
}

const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateMediaFile', () => {
    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('valid inputs', () => {
        it('should return valid: true with dimensions for a PNG with matching MIME', () => {
            // Arrange — declared MIME matches buffer magic bytes
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(true);
            if (result.valid) {
                expect(result.width).toBe(1);
                expect(result.height).toBe(1);
            }
        });

        it('should return valid: true for a valid avatar PNG', () => {
            // Arrange
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'avatar' });

            // Assert
            expect(result.valid).toBe(true);
        });

        it('should return valid: true with dimensions for a valid JPEG buffer', () => {
            // Arrange — minimal valid JPEG (SOI + APP0/JFIF + SOF0 1x1 + SOS + EOI)
            const buffer = createMinimalJpeg();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

            // Assert
            expect(result.valid).toBe(true);
            if (result.valid) {
                expect(result.width).toBe(1);
                expect(result.height).toBe(1);
            }
        });
    });

    // -----------------------------------------------------------------------
    // FILE_TOO_LARGE
    // -----------------------------------------------------------------------

    describe('FILE_TOO_LARGE', () => {
        it('should fail when entity buffer exceeds the default 10 MB limit', () => {
            // Arrange — 10 MB + 1 byte exceeds the limit
            const buffer = createZeroBuffer(10 * MB + 1);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('FILE_TOO_LARGE');
                expect(result.details.maxBytes).toBe(10 * MB);
                expect(result.details.actualBytes).toBe(10 * MB + 1);
            }
        });

        it('should fail when avatar buffer exceeds the fixed 5 MB limit', () => {
            // Arrange — 5 MB + 1 byte
            const buffer = createZeroBuffer(5 * MB + 1);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'avatar' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('FILE_TOO_LARGE');
                expect(result.details.maxBytes).toBe(5 * MB);
            }
        });

        it('should fail with custom maxFileSizeMb when buffer exceeds it', () => {
            // Arrange — 6 MB buffer, custom limit 5 MB
            const buffer = createZeroBuffer(6 * MB);

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/jpeg',
                context: 'entity',
                maxFileSizeMb: 5
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('FILE_TOO_LARGE');
                expect(result.details.maxBytes).toBe(5 * MB);
            }
        });

        it('should ignore maxFileSizeMb for avatar context and enforce 5 MB', () => {
            // Arrange — 6 MB buffer, maxFileSizeMb would allow 10 MB but avatar overrides it
            const buffer = createZeroBuffer(6 * MB);

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/png',
                context: 'avatar',
                maxFileSizeMb: 10
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('FILE_TOO_LARGE');
                expect(result.details.maxBytes).toBe(5 * MB);
            }
        });

        it('should pass when buffer is exactly at the default 10 MB entity limit', () => {
            // Arrange — prepend a valid PNG header to force a parseable image at limit size
            const pngBuffer = createMinimalPng();
            const paddingSize = 10 * MB - pngBuffer.length;
            const buffer = Buffer.concat([pngBuffer, Buffer.alloc(paddingSize)]);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert — the size check is strict (> not >=), so exactly at limit passes
            // If image-size fails on the padded buffer that is fine; size check passed.
            expect(['valid', 'INVALID_IMAGE'].includes(result.valid ? 'valid' : result.error)).toBe(
                true
            );
            // The important thing: error must NOT be FILE_TOO_LARGE
            if (!result.valid) {
                expect(result.error).not.toBe('FILE_TOO_LARGE');
            }
        });

        // GAP-078-216: avatar 5 MB byte-exact off-by-one boundary.
        // The avatar context enforces a fixed 5 MB cap regardless of the
        // caller-supplied `maxFileSizeMb`. The size check uses strict `>`,
        // so EXACTLY 5 MB must pass and 5 MB + 1 byte must fail with
        // FILE_TOO_LARGE (never INVALID_IMAGE, never IMAGE_TOO_LARGE).
        describe('GAP-078-216: avatar 5 MB byte-exact boundary', () => {
            it('passes a PNG-padded buffer weighing EXACTLY 5 MB (5 * 1024 * 1024 bytes)', () => {
                // Arrange — concatenate a real PNG header with padding to reach
                // the exact byte count. byteLength MUST be 5 * 1024 * 1024.
                const pngBuffer = createMinimalPng();
                const padding = Buffer.alloc(5 * MB - pngBuffer.length);
                const buffer = Buffer.concat([pngBuffer, padding]);

                expect(buffer.byteLength).toBe(5 * MB);

                // Act
                const result = validateMediaFile({
                    buffer,
                    mimeType: 'image/png',
                    context: 'avatar'
                });

                // Assert — strict `>` size check accepts exactly 5 MB. Either
                // the parser tolerates the padded image (valid: true) or it
                // rejects it as INVALID_IMAGE — but it MUST NOT be FILE_TOO_LARGE.
                if (!result.valid) {
                    expect(result.error).not.toBe('FILE_TOO_LARGE');
                }
            });

            it('fails a PNG-padded buffer weighing EXACTLY 5 MB + 1 byte with FILE_TOO_LARGE', () => {
                // Arrange — same padding strategy, +1 byte over the avatar cap.
                const pngBuffer = createMinimalPng();
                const padding = Buffer.alloc(5 * MB - pngBuffer.length + 1);
                const buffer = Buffer.concat([pngBuffer, padding]);

                expect(buffer.byteLength).toBe(5 * MB + 1);

                // Act
                const result = validateMediaFile({
                    buffer,
                    mimeType: 'image/png',
                    context: 'avatar'
                });

                // Assert — exact code MUST be FILE_TOO_LARGE.
                expect(result.valid).toBe(false);
                if (!result.valid) {
                    expect(result.error).toBe('FILE_TOO_LARGE');
                    expect(result.details.maxBytes).toBe(5 * MB);
                    expect(result.details.actualBytes).toBe(5 * MB + 1);
                }
            });
        });

        // GAP-078-090: deterministic 10 MB boundary regression
        describe('GAP-078-090: 10 MB byte-exact boundary', () => {
            it('passes a PNG-padded buffer weighing EXACTLY 10 MB (10 * 1024 * 1024 bytes)', () => {
                // Arrange — concatenate a real PNG header with padding to reach the
                // exact byte count. byteLength MUST be 10 * 1024 * 1024.
                const pngBuffer = createMinimalPng();
                const padding = Buffer.alloc(10 * MB - pngBuffer.length);
                const buffer = Buffer.concat([pngBuffer, padding]);

                expect(buffer.byteLength).toBe(10 * MB);

                // Act
                const result = validateMediaFile({
                    buffer,
                    mimeType: 'image/png',
                    context: 'entity'
                });

                // Assert — size check uses strict `>`, so 10 MB exactly is allowed.
                // Either the parser tolerates the padded image (valid: true) or it
                // rejects it as INVALID_IMAGE — but it MUST NOT be FILE_TOO_LARGE.
                if (!result.valid) {
                    expect(result.error).not.toBe('FILE_TOO_LARGE');
                }
            });

            it('fails a PNG-padded buffer weighing EXACTLY 10 MB + 1 byte with FILE_TOO_LARGE', () => {
                // Arrange — same padding strategy, +1 byte over the limit.
                const pngBuffer = createMinimalPng();
                const padding = Buffer.alloc(10 * MB - pngBuffer.length + 1);
                const buffer = Buffer.concat([pngBuffer, padding]);

                expect(buffer.byteLength).toBe(10 * MB + 1);

                // Act
                const result = validateMediaFile({
                    buffer,
                    mimeType: 'image/png',
                    context: 'entity'
                });

                // Assert — exact code MUST be FILE_TOO_LARGE.
                expect(result.valid).toBe(false);
                if (!result.valid) {
                    expect(result.error).toBe('FILE_TOO_LARGE');
                    expect(result.details.maxBytes).toBe(10 * MB);
                    expect(result.details.actualBytes).toBe(10 * MB + 1);
                }
            });
        });
    });

    // -----------------------------------------------------------------------
    // INVALID_FILE_TYPE
    // -----------------------------------------------------------------------

    describe('INVALID_FILE_TYPE', () => {
        it('should fail for image/gif in entity context', () => {
            // Arrange
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/gif', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_FILE_TYPE');
                expect(result.details.actualType).toBe('image/gif');
            }
        });

        it('should fail for image/heic in avatar context', () => {
            // Arrange — HEIC is allowed for entity but NOT for avatar
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/heic', context: 'avatar' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_FILE_TYPE');
                expect(result.details.actualType).toBe('image/heic');
            }
        });

        it('should fail for image/avif in avatar context', () => {
            const buffer = createMinimalPng();
            const result = validateMediaFile({ buffer, mimeType: 'image/avif', context: 'avatar' });

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_FILE_TYPE');
            }
        });

        it('should fail for application/pdf in entity context', () => {
            const buffer = createMinimalPng();
            const result = validateMediaFile({
                buffer,
                mimeType: 'application/pdf',
                context: 'entity'
            });

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_FILE_TYPE');
            }
        });

        it('should include the allowed types list in the failure details', () => {
            const buffer = createMinimalPng();
            const result = validateMediaFile({ buffer, mimeType: 'image/gif', context: 'entity' });

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(Array.isArray(result.details.allowedTypes)).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // INVALID_IMAGE
    // -----------------------------------------------------------------------

    describe('INVALID_IMAGE', () => {
        it('should fail when buffer contains plain text (not a valid image)', () => {
            // Arrange
            const buffer = Buffer.from('this is definitely not an image', 'utf8');

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_IMAGE');
                expect(typeof result.details.message).toBe('string');
            }
        });

        it('should fail when buffer is empty', () => {
            const buffer = Buffer.alloc(0);
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            expect(result.valid).toBe(false);
            if (!result.valid) {
                // Empty buffer: could be FILE_TOO_LARGE (0 > 0 is false), then INVALID_IMAGE
                expect(['INVALID_IMAGE', 'INVALID_FILE_TYPE']).toContain(result.error);
            }
        });

        // GAP-078-213: exact assertion (no `.toContain`) for 0-byte input.
        // The `EMPTY_FILE` code lives at the route layer (T-032). At the validator
        // layer the resulting error is `INVALID_IMAGE` because the size check uses
        // strict `>` (0 > 0 is false), the MIME allowlist passes, magic-byte
        // detection returns null (buffer.length < 12), and `image-size` throws
        // when handed a 0-byte buffer.
        it('GAP-078-213: returns EXACTLY INVALID_IMAGE for a 0-byte buffer', () => {
            // Arrange
            const buffer = Buffer.alloc(0);

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/png',
                context: 'entity'
            });

            // Assert — strict `.toBe`, not `.toContain`.
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_IMAGE');
            }
        });

        it('should fail when buffer contains random binary data', () => {
            const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_IMAGE');
            }
        });
    });

    // -----------------------------------------------------------------------
    // MIME_MISMATCH (GAP-078-103, GAP-078-104)
    // -----------------------------------------------------------------------

    describe('MIME_MISMATCH', () => {
        it('should reject a buffer with PNG magic bytes when MIME is image/jpeg', () => {
            // Arrange — declared JPEG, but payload is a real PNG
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('MIME_MISMATCH');
                expect(result.details.declaredType).toBe('image/jpeg');
                expect(result.details.detectedType).toBe('image/png');
            }
        });

        it('should reject a JPEG payload declared as image/png', () => {
            // Arrange
            const buffer = createMinimalJpeg();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('MIME_MISMATCH');
                expect(result.details.detectedType).toBe('image/jpeg');
            }
        });
    });

    // -----------------------------------------------------------------------
    // DECOMPRESSION_BOMB (GAP-078-104)
    // -----------------------------------------------------------------------

    describe('DECOMPRESSION_BOMB', () => {
        it('should reject a 15001x15001 PNG with DECOMPRESSION_BOMB code', () => {
            // Arrange — 15001 * 15001 = 225,030,001 > 2e8
            const buffer = createPngWithDimensions(15001, 15001);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('DECOMPRESSION_BOMB');
                expect(result.details.maxPixelCount).toBe(2e8);
                expect(result.details.actualPixelCount).toBe(15001 * 15001);
                expect(result.details.width).toBe(15001);
                expect(result.details.height).toBe(15001);
            }
        });

        it('should accept an image whose pixel count is exactly at the threshold', () => {
            // Arrange — sqrt(2e8) ~ 14142.13, so 14142x14142 = 199,996,164 (under the cap)
            // but each side > ENTITY_MAX_DIMENSION (8000), so we expect IMAGE_TOO_LARGE
            // (NOT DECOMPRESSION_BOMB) — the bomb guard must defer to per-dim only when
            // pixel count is below 2e8.
            const buffer = createPngWithDimensions(14142, 14142);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('IMAGE_TOO_LARGE');
            }
        });
    });

    // -----------------------------------------------------------------------
    // IMAGE_TOO_LARGE (GAP-078-204)
    //
    // The decompression-bomb guard fires only above 2e8 pixels. Images
    // whose pixel count is below the bomb threshold but whose individual
    // dimensions exceed the per-context cap (8000 px for entity, 4000 px
    // for avatar) must surface as IMAGE_TOO_LARGE — never as a bomb and
    // never as INVALID_IMAGE.
    // -----------------------------------------------------------------------

    describe('IMAGE_TOO_LARGE (GAP-078-204)', () => {
        it('should reject an entity image wider than 8000 px', () => {
            // Arrange — 8001 x 100 = 800,100 pixels (well under bomb cap)
            const buffer = createPngWithDimensions(8001, 100);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('IMAGE_TOO_LARGE');
                expect(result.details.maxWidth).toBe(8000);
                expect(result.details.maxHeight).toBe(8000);
                expect(result.details.actualWidth).toBe(8001);
                expect(result.details.actualHeight).toBe(100);
            }
        });

        it('should reject an entity image taller than 8000 px', () => {
            // Arrange — 100 x 8001
            const buffer = createPngWithDimensions(100, 8001);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('IMAGE_TOO_LARGE');
                expect(result.details.actualHeight).toBe(8001);
            }
        });

        it('should reject an avatar image wider than 4000 px', () => {
            // Arrange — 4001 x 100, avatar context tightens the cap to 4000
            const buffer = createPngWithDimensions(4001, 100);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'avatar' });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('IMAGE_TOO_LARGE');
                expect(result.details.maxWidth).toBe(4000);
            }
        });

        it('should accept an avatar image exactly at the 4000 px boundary', () => {
            // Arrange — 4000 x 4000 = 16M pixels, well under both the
            // dimension cap (the check is strict `>`, so equal passes) and
            // the bomb cap.
            const buffer = createPngWithDimensions(4000, 4000);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'avatar' });

            // Assert — must NOT be IMAGE_TOO_LARGE; image-size on a synthetic
            // header may surface other errors but the dimension cap is satisfied.
            if (!result.valid) {
                expect(result.error).not.toBe('IMAGE_TOO_LARGE');
            }
        });
    });

    // -----------------------------------------------------------------------
    // Magic-byte detection: WEBP, HEIC, AVIF (GAP-078-205)
    //
    // GAP-078-205 originally requested real HEIC/AVIF binary fixtures to
    // replace PNG-with-MIME-spoof tests. We synthesize minimal ISO Base
    // Media (`ftyp` + brand) and RIFF/WEBP headers in-process instead of
    // committing binary fixtures. Rationale:
    //   - Real HEIC/AVIF binaries are 1-10 KB minimum and exercise codec
    //     details (HEVC tiles, AV1 sequence headers) that this validator
    //     never inspects. The validator only reads the first 12 bytes via
    //     `detectMimeFromMagic`, so a synthetic 12-byte buffer covers the
    //     same code paths that a real file would.
    //   - Keeps the test suite hermetic, the repository slim, and removes
    //     any dependency on third-party sample images with unclear licenses.
    // -----------------------------------------------------------------------

    describe('magic-byte detection (GAP-078-205)', () => {
        it('should detect AVIF brand in an ISO ftyp header', () => {
            // Arrange — declared MIME matches detected brand
            const buffer = createIsoFtypHeader('avif');

            // Act — image-size will fail to fully parse (synthetic header),
            // but the magic-byte check must NOT raise MIME_MISMATCH.
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/avif',
                context: 'entity'
            });

            // Assert — pass-through to dimension check (INVALID_IMAGE)
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).not.toBe('MIME_MISMATCH');
            }
        });

        it("should detect HEIC brand 'heic' in an ISO ftyp header", () => {
            // Arrange
            const buffer = createIsoFtypHeader('heic');

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/heic',
                context: 'entity'
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).not.toBe('MIME_MISMATCH');
            }
        });

        it("should detect HEIC brand 'mif1' in an ISO ftyp header", () => {
            // Arrange — newer HEIF files commonly use the 'mif1' brand
            const buffer = createIsoFtypHeader('mif1');

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/heic',
                context: 'entity'
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).not.toBe('MIME_MISMATCH');
            }
        });

        it("should reject an HEIC ftyp brand declared as 'image/jpeg' with MIME_MISMATCH", () => {
            // Arrange — real HEIC magic but client claims JPEG
            const buffer = createIsoFtypHeader('heic');

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/jpeg',
                context: 'entity'
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('MIME_MISMATCH');
                expect(result.details.declaredType).toBe('image/jpeg');
                expect(result.details.detectedType).toBe('image/heic');
            }
        });

        it('should detect WEBP magic bytes in a minimal RIFF/WEBP header', () => {
            // Arrange
            const buffer = createWebpHeader();

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/webp',
                context: 'entity'
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).not.toBe('MIME_MISMATCH');
            }
        });

        it("should treat an unknown ftyp brand as 'unknown magic' (passes through)", () => {
            // Arrange — 'xxxx' is not in the AVIF or HEIC brand sets
            const buffer = createIsoFtypHeader('xxxx');

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert — magic-byte check returns null and skips MIME_MISMATCH;
            // the dimension parser then fails the buffer as INVALID_IMAGE.
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_IMAGE');
            }
        });

        it('should treat a buffer shorter than 12 bytes as unknown magic', () => {
            // Arrange — too short for detectMimeFromMagic to inspect
            const buffer = Buffer.from([0x89, 0x50, 0x4e]);

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/png', context: 'entity' });

            // Assert — falls through to image-size which rejects as INVALID_IMAGE
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_IMAGE');
            }
        });

        it('should detect an AVIF sequence (image collection) brand', () => {
            // Arrange — 'avis' is the AVIF image-sequence brand
            const buffer = createIsoFtypHeader('avis');

            // Act
            const result = validateMediaFile({
                buffer,
                mimeType: 'image/avif',
                context: 'entity'
            });

            // Assert
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).not.toBe('MIME_MISMATCH');
            }
        });
    });

    // -----------------------------------------------------------------------
    // Exports: ENTITY_ALLOWED_MIME_TYPES / AVATAR_ALLOWED_MIME_TYPES
    // -----------------------------------------------------------------------

    describe('exported MIME type constants', () => {
        it('ENTITY_ALLOWED_MIME_TYPES should include jpeg, png, webp, heic, avif', () => {
            expect(ENTITY_ALLOWED_MIME_TYPES).toContain('image/jpeg');
            expect(ENTITY_ALLOWED_MIME_TYPES).toContain('image/png');
            expect(ENTITY_ALLOWED_MIME_TYPES).toContain('image/webp');
            expect(ENTITY_ALLOWED_MIME_TYPES).toContain('image/heic');
            expect(ENTITY_ALLOWED_MIME_TYPES).toContain('image/avif');
        });

        it('AVATAR_ALLOWED_MIME_TYPES should include jpeg, png, webp but not heic or avif', () => {
            expect(AVATAR_ALLOWED_MIME_TYPES).toContain('image/jpeg');
            expect(AVATAR_ALLOWED_MIME_TYPES).toContain('image/png');
            expect(AVATAR_ALLOWED_MIME_TYPES).toContain('image/webp');
            expect(AVATAR_ALLOWED_MIME_TYPES).not.toContain('image/heic');
            expect(AVATAR_ALLOWED_MIME_TYPES).not.toContain('image/avif');
        });
    });
});
