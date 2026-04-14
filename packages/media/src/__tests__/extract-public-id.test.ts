import { describe, expect, it } from 'vitest';
import { extractPublicId } from '../extract-public-id.js';

describe('extractPublicId', () => {
    describe('REQ-01.5-A: Standard URL with version', () => {
        it('should extract public ID from a standard Cloudinary URL with version', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v1234567890/hospeda/prod/accommodations/abc/featured.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/accommodations/abc/featured');
        });
    });

    describe('REQ-01.5-B: URL with transforms and version', () => {
        it('should skip transform segments and version when extracting public ID', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill/v1234567890/hospeda/prod/accommodations/abc/featured.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/accommodations/abc/featured');
        });
    });

    describe('REQ-01.5-C: URL without version', () => {
        it('should extract public ID from a Cloudinary URL without version segment', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/hospeda/prod/accommodations/abc/featured.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/accommodations/abc/featured');
        });
    });

    describe('REQ-01.5-D: Non-Cloudinary URL', () => {
        it('should return null for non-Cloudinary URLs', () => {
            // Arrange
            const url = 'https://images.unsplash.com/photo-abc';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('REQ-01.5-E: Nullish input', () => {
        it('should return null when input is null', () => {
            expect(extractPublicId(null)).toBeNull();
        });

        it('should return null when input is undefined', () => {
            expect(extractPublicId(undefined)).toBeNull();
        });

        it('should return null when input is empty string', () => {
            expect(extractPublicId('')).toBeNull();
        });
    });

    describe('Multiple transform segments', () => {
        it('should skip all transform segments when multiple are present', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300/q_auto,f_auto/v123/hospeda/prod/acc/abc/featured.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/acc/abc/featured');
        });
    });

    describe('URL with no file extension', () => {
        it('should return public ID as-is when last segment has no file extension', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v123/hospeda/prod/avatars/user-id';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/avatars/user-id');
        });
    });

    describe('URL with .webp extension', () => {
        it('should strip .webp extension from the last segment', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v123/hospeda/prod/acc/abc/gallery/a7x3k.webp';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/acc/abc/gallery/a7x3k');
        });
    });
});
