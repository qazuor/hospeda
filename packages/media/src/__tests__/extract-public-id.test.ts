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

    // GAP-078-109: SSRF / subdomain-spoofing regression tests
    describe('GAP-078-109: strict hostname check', () => {
        it('returns null for subdomain-spoofed hostname', () => {
            const url =
                'https://evil.res.cloudinary.com.attacker.com/hospeda/image/upload/v1/x.jpg';
            expect(extractPublicId(url)).toBeNull();
        });

        it('returns null for hostname containing res.cloudinary.com as suffix prefix', () => {
            const url = 'https://notres.cloudinary.com/hospeda/image/upload/v1/x.jpg';
            expect(extractPublicId(url)).toBeNull();
        });

        it('returns null when res.cloudinary.com appears only in the path', () => {
            const url = 'https://attacker.com/res.cloudinary.com/image/upload/v1/x.jpg';
            expect(extractPublicId(url)).toBeNull();
        });

        it('returns null for malformed URLs (URL parser throws)', () => {
            expect(extractPublicId('not a url')).toBeNull();
            expect(extractPublicId('http://')).toBeNull();
            expect(extractPublicId('://res.cloudinary.com/x')).toBeNull();
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

    // GAP-078-088 / GAP-078-206 / GAP-078-207: additional URL shape edge cases
    describe('GAP-078-088: video and resource-type variants', () => {
        it('extracts public ID from a video upload URL (resource_type=video)', () => {
            // Arrange — Cloudinary serves videos under /video/upload/
            const url =
                'https://res.cloudinary.com/hospeda/video/upload/v1700000000/hospeda/prod/tours/intro.mp4';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/tours/intro');
        });

        it('extracts public ID from raw resource type URL', () => {
            // Arrange — raw is also a Cloudinary delivery type
            const url =
                'https://res.cloudinary.com/hospeda/raw/upload/v1700000000/hospeda/prod/docs/contract.pdf';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/docs/contract');
        });

        it('extracts public ID from fetch delivery type URL', () => {
            // Arrange — fetch delivery type proxies a remote URL through Cloudinary.
            // The "public ID" here is the remote URL fragment after /upload/.
            const url =
                'https://res.cloudinary.com/hospeda/image/fetch/v1/https://example.com/photo.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert — fetch URLs do not contain `/upload/` so result must be null.
            expect(result).toBeNull();
        });
    });

    describe('GAP-078-206: query strings and fragments', () => {
        it('strips file extension and ignores query string', () => {
            // Arrange — Cloudinary appends `?_a=...` analytics tokens on some URLs
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/acc/abc/featured.jpg?_a=BAMAH+AA0';

            // Act
            const result = extractPublicId(url);

            // Assert — query string lives outside `parsed.pathname`, so it is naturally ignored
            expect(result).toBe('hospeda/prod/acc/abc/featured');
        });

        it('ignores URL fragment (#anchor)', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/acc/abc/featured.jpg#section';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('hospeda/prod/acc/abc/featured');
        });
    });

    describe('GAP-078-207: ambiguous path segments', () => {
        it('uses the FIRST occurrence of /upload/ when it appears twice in the path', () => {
            // Arrange — pathologic case: a folder literally named "upload" lives under /upload/
            const url = 'https://res.cloudinary.com/hospeda/image/upload/v1/upload/file.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert — `indexOf('/upload/')` returns the first match, so the second
            // `upload` is treated as a folder segment within the public ID.
            expect(result).toBe('upload/file');
        });

        it('preserves a folder name containing dots', () => {
            // Arrange — folders with dots are valid in Cloudinary
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v1/folder.with.dot/file.jpg';

            // Act
            const result = extractPublicId(url);

            // Assert — only the LAST `.` of the LAST segment is treated as the
            // file extension; folder dots are preserved.
            expect(result).toBe('folder.with.dot/file');
        });

        it('strips only the last extension when the file name itself contains dots', () => {
            // Arrange
            const url =
                'https://res.cloudinary.com/hospeda/image/upload/v1/folder/file.name.with.dots.png';

            // Act
            const result = extractPublicId(url);

            // Assert
            expect(result).toBe('folder/file.name.with.dots');
        });
    });
});
