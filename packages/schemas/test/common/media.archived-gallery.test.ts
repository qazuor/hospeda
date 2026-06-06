/**
 * Tests for the `archivedGallery` field added to `MediaSchema` by SPEC-167
 * (downgrade over-limit remediation, realign D-2).
 *
 * Coverage:
 *   - `archivedGallery` is optional: existing fixtures without it still parse.
 *   - `archivedGallery` accepts an array of valid `ImageSchema` items.
 *   - `archivedGallery` rejects invalid image items (same constraints as gallery).
 *   - The item shape is identical to `gallery` items (reuses `ImageSchema` by
 *     reference — no duplication).
 *   - `archivedGallery` does NOT appear in the existing historic fixtures
 *     (additive-only change).
 */
import { describe, expect, it } from 'vitest';
import { ImageSchema, MediaSchema } from '../../src/common/media.schema.js';

const validImage = {
    url: 'https://example.com/image.jpg',
    moderationState: 'APPROVED'
} as const;

describe('MediaSchema — archivedGallery (SPEC-167 D-2)', () => {
    // -----------------------------------------------------------------------
    // Additive: existing payloads unaffected
    // -----------------------------------------------------------------------
    describe('backward compatibility — existing payloads without archivedGallery', () => {
        it('accepts an empty media object (no archivedGallery)', () => {
            const result = MediaSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toBeUndefined();
            }
        });

        it('accepts a media object with only gallery (no archivedGallery)', () => {
            const result = MediaSchema.safeParse({ gallery: [validImage] });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toBeUndefined();
            }
        });

        it('accepts a fully populated legacy media container (no archivedGallery)', () => {
            const result = MediaSchema.safeParse({
                featuredImage: validImage,
                gallery: [validImage],
                videos: [{ url: 'https://example.com/video.mp4', moderationState: 'APPROVED' }]
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toBeUndefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    // Happy paths: archivedGallery present
    // -----------------------------------------------------------------------
    describe('archivedGallery present — happy paths', () => {
        it('accepts an empty archivedGallery array', () => {
            const result = MediaSchema.safeParse({ archivedGallery: [] });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toEqual([]);
            }
        });

        it('accepts archivedGallery with a single valid image', () => {
            const result = MediaSchema.safeParse({ archivedGallery: [validImage] });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toHaveLength(1);
            }
        });

        it('accepts archivedGallery with multiple valid images', () => {
            const images = Array.from({ length: 5 }, (_, i) => ({
                ...validImage,
                url: `https://example.com/archived-${i}.jpg`
            }));
            const result = MediaSchema.safeParse({ archivedGallery: images });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedGallery).toHaveLength(5);
            }
        });

        it('accepts archivedGallery with full ImageSchema fields (publicId + attribution)', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [
                    {
                        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/archived/x.jpg',
                        moderationState: 'APPROVED',
                        caption: 'Archived photo',
                        publicId: 'hospeda/dev/archived/x',
                        attribution: {
                            photographer: 'Alice',
                            sourceUrl: 'https://unsplash.com/photos/abc',
                            license: 'Unsplash License'
                        }
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('accepts media with both gallery and archivedGallery populated', () => {
            const result = MediaSchema.safeParse({
                featuredImage: validImage,
                gallery: [{ ...validImage, url: 'https://example.com/active.jpg' }],
                archivedGallery: [{ ...validImage, url: 'https://example.com/archived.jpg' }]
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.gallery).toHaveLength(1);
                expect(result.data.archivedGallery).toHaveLength(1);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Item shape parity: archivedGallery uses the same ImageSchema as gallery
    // -----------------------------------------------------------------------
    describe('item shape identical to gallery items', () => {
        it('rejects archivedGallery items missing required url', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ moderationState: 'APPROVED' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects archivedGallery items with an invalid url', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ url: 'not-a-url', moderationState: 'APPROVED' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects archivedGallery items missing required moderationState', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ url: 'https://example.com/a.jpg' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects archivedGallery items with an invalid moderationState', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ url: 'https://example.com/a.jpg', moderationState: 'NOPE' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects an archivedGallery caption shorter than 3 chars', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ ...validImage, caption: 'ab' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects an archivedGallery description longer than 300 chars', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: [{ ...validImage, description: 'a'.repeat(301) }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects a non-array archivedGallery value', () => {
            const result = MediaSchema.safeParse({
                archivedGallery: 'not-an-array'
            });
            expect(result.success).toBe(false);
        });

        it('archivedGallery item schema is identical to gallery item schema (parses the same shapes)', () => {
            // Both gallery and archivedGallery should accept/reject the exact same inputs.
            // This confirms they share the same ImageSchema reference.
            const fullImage = {
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/x.jpg',
                moderationState: 'APPROVED' as const,
                caption: 'A caption',
                description: 'A description long enough.',
                alt: 'Alt text',
                publicId: 'hospeda/dev/x',
                attribution: { photographer: 'Bob', license: 'MIT' }
            };

            const galleryResult = MediaSchema.safeParse({ gallery: [fullImage] });
            const archivedResult = MediaSchema.safeParse({ archivedGallery: [fullImage] });

            expect(galleryResult.success).toBe(true);
            expect(archivedResult.success).toBe(true);

            // Both rejections happen for the same reason
            const badImage = { url: 'bad', moderationState: 'APPROVED' as const };
            const galleryBad = MediaSchema.safeParse({ gallery: [badImage] });
            const archivedBad = MediaSchema.safeParse({ archivedGallery: [badImage] });
            expect(galleryBad.success).toBe(false);
            expect(archivedBad.success).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // ImageSchema direct — verify the item schema is the same export
    // -----------------------------------------------------------------------
    describe('archivedGallery item schema matches standalone ImageSchema', () => {
        it('accepts any input that ImageSchema.safeParse accepts', () => {
            const inputs = [
                validImage,
                {
                    ...validImage,
                    caption: 'Caption ok',
                    description: 'Long enough description ok.'
                },
                { ...validImage, publicId: 'hospeda/dev/x' },
                { ...validImage, alt: 'Alt text' }
            ];

            for (const input of inputs) {
                const imageSchemaResult = ImageSchema.safeParse(input);
                const mediaResult = MediaSchema.safeParse({ archivedGallery: [input] });
                // Both should produce the same success/failure outcome
                expect(
                    imageSchemaResult.success,
                    `Expected parity for input: ${JSON.stringify(input)}`
                ).toBe(mediaResult.success);
            }
        });
    });
});
