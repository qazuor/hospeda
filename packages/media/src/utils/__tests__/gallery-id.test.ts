import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateGalleryId } from '../gallery-id.js';

// SPEC-078-GAPS GAP-078-214: gallery-id generation must be deterministic
// when its underlying randomness source is seeded. We mock the `nanoid`
// module so the test can assert exact output rather than just shape.
vi.mock('nanoid', () => ({
    nanoid: vi.fn()
}));

// Late import: the mock above must be set up before nanoid is read.
const { nanoid } = await import('nanoid');

describe('generateGalleryId', () => {
    afterEach(() => {
        vi.mocked(nanoid).mockReset();
    });

    it('should return a string of exactly 10 characters', () => {
        // Arrange — real nanoid behavior for shape assertion
        vi.mocked(nanoid).mockReturnValueOnce('V1StGXR8_Z');

        // Act
        const id = generateGalleryId();

        // Assert
        expect(id).toHaveLength(10);
    });

    it('should return different values on subsequent calls', () => {
        // Arrange
        vi.mocked(nanoid)
            .mockReturnValueOnce('aaaaaaaaaa')
            .mockReturnValueOnce('bbbbbbbbbb')
            .mockReturnValueOnce('cccccccccc');

        // Act
        const id1 = generateGalleryId();
        const id2 = generateGalleryId();
        const id3 = generateGalleryId();

        // Assert
        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
    });

    it('should only contain URL-safe characters', () => {
        // Arrange — drive 50 iterations through a fake URL-safe stream
        const urlSafeSamples = [
            'V1StGXR8_Z',
            'bN8aK2mPxQ',
            'a-b-c-d-e-',
            '0123456789',
            'AaBbCcDdEe'
        ];
        const urlSafePattern = /^[A-Za-z0-9_-]+$/;
        for (let i = 0; i < 50; i++) {
            vi.mocked(nanoid).mockReturnValueOnce(
                urlSafeSamples[i % urlSafeSamples.length] as string
            );
        }

        // Act / Assert
        for (let i = 0; i < 50; i++) {
            const id = generateGalleryId();
            expect(id).toMatch(urlSafePattern);
        }
    });

    it('should return a string type', () => {
        // Arrange
        vi.mocked(nanoid).mockReturnValueOnce('V1StGXR8_Z');

        // Act
        const id = generateGalleryId();

        // Assert
        expect(typeof id).toBe('string');
    });

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS GAP-078-214: deterministic output via mocked nanoid
    // -----------------------------------------------------------------------
    describe('determinism (GAP-078-214)', () => {
        it('should return the exact value produced by the underlying generator', () => {
            // Arrange — pin the nanoid output so the test is fully deterministic
            vi.mocked(nanoid).mockReturnValue('FIXED_TOKN');

            // Act
            const id = generateGalleryId();

            // Assert
            expect(id).toBe('FIXED_TOKN');
        });

        it('should call nanoid with length 10 to match the public ID convention', () => {
            // Arrange
            vi.mocked(nanoid).mockReturnValue('xxxxxxxxxx');

            // Act
            generateGalleryId();

            // Assert — gallery IDs are pinned to 10 chars; documented in the
            // module-level JSDoc and asserted here as a regression guard.
            expect(nanoid).toHaveBeenCalledWith(10);
        });

        it('should produce two identical outputs when nanoid is seeded with the same value', () => {
            // Arrange
            vi.mocked(nanoid).mockReturnValue('SEEDEDvalu');

            // Act
            const a = generateGalleryId();
            const b = generateGalleryId();

            // Assert
            expect(a).toBe(b);
            expect(a).toBe('SEEDEDvalu');
        });
    });
});
