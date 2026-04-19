import { describe, expect, it } from 'vitest';
import { ImageAttributionSchema, ImageSchema, MediaSchema } from '../../src/common/media.schema.js';

describe('media.schema (SPEC-078-GAPS additive changes)', () => {
    describe('MediaSchema.featuredImage — GAP-078-185', () => {
        it('accepts an empty object (featuredImage optional)', () => {
            const result = MediaSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('accepts an empty gallery without featuredImage', () => {
            const result = MediaSchema.safeParse({ gallery: [] });
            expect(result.success).toBe(true);
        });

        it('still accepts a populated featuredImage', () => {
            const result = MediaSchema.safeParse({
                featuredImage: {
                    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hero.jpg',
                    moderationState: 'APPROVED'
                }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ImageSchema.publicId — GAP-078-196', () => {
        it('accepts an image without publicId', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED'
            });
            expect(result.success).toBe(true);
        });

        it('accepts an image with a Cloudinary publicId', () => {
            const result = ImageSchema.safeParse({
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/dev/x.jpg',
                moderationState: 'APPROVED',
                publicId: 'hospeda/dev/x'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.publicId).toBe('hospeda/dev/x');
            }
        });

        it('rejects an empty-string publicId', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED',
                publicId: ''
            });
            expect(result.success).toBe(false);
        });
    });

    describe('ImageSchema.attribution — GAP-078-116', () => {
        it('accepts an image without attribution', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED'
            });
            expect(result.success).toBe(true);
        });

        it('accepts partial attribution (photographer only)', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED',
                attribution: { photographer: 'Alice' }
            });
            expect(result.success).toBe(true);
        });

        it('accepts full attribution (photographer, sourceUrl, license)', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED',
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/photos/abc',
                    license: 'Unsplash License'
                }
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid sourceUrl', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'APPROVED',
                attribution: { sourceUrl: 'not-a-url' }
            });
            expect(result.success).toBe(false);
        });

        it('ImageAttributionSchema accepts an empty object', () => {
            const result = ImageAttributionSchema.safeParse({});
            expect(result.success).toBe(true);
        });
    });
});
