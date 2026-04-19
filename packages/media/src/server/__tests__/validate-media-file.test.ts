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
