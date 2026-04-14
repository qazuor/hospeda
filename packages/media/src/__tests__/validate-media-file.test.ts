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

const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateMediaFile', () => {
    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('valid inputs', () => {
        it('should return valid: true with dimensions for a valid entity JPEG', () => {
            // Arrange
            const buffer = createMinimalPng();

            // Act
            const result = validateMediaFile({ buffer, mimeType: 'image/jpeg', context: 'entity' });

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

        it('should return valid: true for entity context with webp MIME type', () => {
            const buffer = createMinimalPng();
            const result = validateMediaFile({ buffer, mimeType: 'image/webp', context: 'entity' });
            expect(result.valid).toBe(true);
        });

        it('should return valid: true for entity context with HEIC MIME type', () => {
            // HEIC shares the PNG signature when parsed through a minimal buffer;
            // image-size will recognise the PNG format regardless of declared MIME.
            const buffer = createMinimalPng();
            const result = validateMediaFile({ buffer, mimeType: 'image/heic', context: 'entity' });
            expect(result.valid).toBe(true);
        });

        it('should return valid: true for entity context with AVIF MIME type', () => {
            const buffer = createMinimalPng();
            const result = validateMediaFile({ buffer, mimeType: 'image/avif', context: 'entity' });
            expect(result.valid).toBe(true);
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
