/**
 * Tests for the common media schemas:
 *   - `ImageAttributionSchema`
 *   - `ImageSchema`
 *   - `VideoSchema`
 *   - `MediaSchema`
 *   - `BaseMediaFields` (object literal exposing the `media` field schema)
 *
 * Covers SPEC-078-GAPS additive changes (T-010 / T-031 / T-058):
 *   - GAP-078-185: `MediaSchema.featuredImage` is optional.
 *   - GAP-078-196: `ImageSchema.publicId` is optional and rejects empty strings.
 *   - GAP-078-116: `ImageSchema.attribution` is optional with optional sub-fields.
 *
 * Plus general coverage of happy / unhappy paths for url validation, caption
 * and description bounds, moderation state enum, and the standalone
 * `BaseMediaFields.media` shape used by entity schemas.
 */
import { describe, expect, it } from 'vitest';
import {
    BaseMediaFields,
    ImageAttributionSchema,
    ImageSchema,
    MediaSchema,
    VideoSchema
} from '../../src/common/media.schema.js';

const validImage = {
    url: 'https://example.com/image.jpg',
    moderationState: 'APPROVED'
} as const;

const validVideo = {
    url: 'https://example.com/video.mp4',
    moderationState: 'APPROVED'
} as const;

describe('media.schema', () => {
    // -----------------------------------------------------------------------
    // ImageAttributionSchema
    // -----------------------------------------------------------------------
    describe('ImageAttributionSchema', () => {
        it('accepts an empty object (all fields optional)', () => {
            const result = ImageAttributionSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('accepts a full attribution object', () => {
            const result = ImageAttributionSchema.safeParse({
                photographer: 'Alice',
                sourceUrl: 'https://unsplash.com/photos/abc',
                license: 'Unsplash License'
            });
            expect(result.success).toBe(true);
        });

        it('accepts partial attribution (photographer only)', () => {
            const result = ImageAttributionSchema.safeParse({ photographer: 'Bob' });
            expect(result.success).toBe(true);
        });

        it('rejects an empty-string photographer', () => {
            const result = ImageAttributionSchema.safeParse({ photographer: '' });
            expect(result.success).toBe(false);
        });

        it('rejects a photographer over 200 chars', () => {
            const result = ImageAttributionSchema.safeParse({ photographer: 'a'.repeat(201) });
            expect(result.success).toBe(false);
        });

        it('rejects an empty-string license', () => {
            const result = ImageAttributionSchema.safeParse({ license: '' });
            expect(result.success).toBe(false);
        });

        it('rejects a license over 200 chars', () => {
            const result = ImageAttributionSchema.safeParse({ license: 'a'.repeat(201) });
            expect(result.success).toBe(false);
        });

        it('rejects a malformed sourceUrl', () => {
            const result = ImageAttributionSchema.safeParse({ sourceUrl: 'not-a-url' });
            expect(result.success).toBe(false);
        });

        it('rejects a non-string photographer', () => {
            const result = ImageAttributionSchema.safeParse({ photographer: 123 });
            expect(result.success).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // ImageSchema
    // -----------------------------------------------------------------------
    describe('ImageSchema', () => {
        it('accepts a minimal image (url + moderationState)', () => {
            const result = ImageSchema.safeParse(validImage);
            expect(result.success).toBe(true);
        });

        it('accepts an image with all optional fields populated', () => {
            const result = ImageSchema.safeParse({
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hero.jpg',
                moderationState: 'APPROVED',
                caption: 'Hero photo',
                description: 'A long enough description for the hero photo.',
                publicId: 'hospeda/dev/hero',
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/photos/abc',
                    license: 'Unsplash License'
                }
            });
            expect(result.success).toBe(true);
        });

        it('rejects when url is missing', () => {
            const result = ImageSchema.safeParse({ moderationState: 'APPROVED' });
            expect(result.success).toBe(false);
        });

        it('rejects when url is not a valid URL', () => {
            const result = ImageSchema.safeParse({
                url: 'not-a-url',
                moderationState: 'APPROVED'
            });
            expect(result.success).toBe(false);
        });

        it('rejects when moderationState is missing', () => {
            const result = ImageSchema.safeParse({ url: 'https://example.com/a.jpg' });
            expect(result.success).toBe(false);
        });

        it('rejects an unknown moderationState value', () => {
            const result = ImageSchema.safeParse({
                url: 'https://example.com/a.jpg',
                moderationState: 'NOPE'
            });
            expect(result.success).toBe(false);
        });

        it('accepts each valid moderationState (PENDING, APPROVED, REJECTED)', () => {
            for (const state of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
                const result = ImageSchema.safeParse({
                    url: 'https://example.com/a.jpg',
                    moderationState: state
                });
                expect(result.success).toBe(true);
            }
        });

        it('rejects a caption shorter than 3 chars', () => {
            const result = ImageSchema.safeParse({ ...validImage, caption: 'ab' });
            expect(result.success).toBe(false);
        });

        it('rejects a caption longer than 100 chars', () => {
            const result = ImageSchema.safeParse({ ...validImage, caption: 'a'.repeat(101) });
            expect(result.success).toBe(false);
        });

        it('rejects a description shorter than 10 chars', () => {
            const result = ImageSchema.safeParse({ ...validImage, description: 'too short' });
            expect(result.success).toBe(false);
        });

        it('rejects a description longer than 300 chars', () => {
            const result = ImageSchema.safeParse({
                ...validImage,
                description: 'a'.repeat(301)
            });
            expect(result.success).toBe(false);
        });

        describe('alt — SPEC-154 a11y persistence', () => {
            it('accepts an image without alt', () => {
                const result = ImageSchema.safeParse(validImage);
                expect(result.success).toBe(true);
            });

            it('accepts an image with a populated alt', () => {
                const result = ImageSchema.safeParse({ ...validImage, alt: 'Vista al río' });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.alt).toBe('Vista al río');
                }
            });

            it('rejects an empty-string alt', () => {
                const result = ImageSchema.safeParse({ ...validImage, alt: '' });
                expect(result.success).toBe(false);
            });

            it('rejects an alt longer than 200 chars', () => {
                const result = ImageSchema.safeParse({ ...validImage, alt: 'a'.repeat(201) });
                expect(result.success).toBe(false);
            });
        });

        describe('publicId — GAP-078-196', () => {
            it('accepts an image without publicId', () => {
                const result = ImageSchema.safeParse(validImage);
                expect(result.success).toBe(true);
            });

            it('accepts an image with a Cloudinary publicId', () => {
                const result = ImageSchema.safeParse({
                    ...validImage,
                    publicId: 'hospeda/dev/x'
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.publicId).toBe('hospeda/dev/x');
                }
            });

            it('rejects an empty-string publicId', () => {
                const result = ImageSchema.safeParse({ ...validImage, publicId: '' });
                expect(result.success).toBe(false);
            });
        });

        describe('attribution — GAP-078-116', () => {
            it('accepts an image without attribution', () => {
                const result = ImageSchema.safeParse(validImage);
                expect(result.success).toBe(true);
            });

            it('accepts partial attribution (photographer only)', () => {
                const result = ImageSchema.safeParse({
                    ...validImage,
                    attribution: { photographer: 'Alice' }
                });
                expect(result.success).toBe(true);
            });

            it('accepts full attribution', () => {
                const result = ImageSchema.safeParse({
                    ...validImage,
                    attribution: {
                        photographer: 'Alice',
                        sourceUrl: 'https://unsplash.com/photos/abc',
                        license: 'Unsplash License'
                    }
                });
                expect(result.success).toBe(true);
            });

            it('rejects an invalid sourceUrl in attribution', () => {
                const result = ImageSchema.safeParse({
                    ...validImage,
                    attribution: { sourceUrl: 'not-a-url' }
                });
                expect(result.success).toBe(false);
            });
        });
    });

    // -----------------------------------------------------------------------
    // VideoSchema
    // -----------------------------------------------------------------------
    describe('VideoSchema', () => {
        it('accepts a minimal video (url + moderationState)', () => {
            const result = VideoSchema.safeParse(validVideo);
            expect(result.success).toBe(true);
        });

        it('accepts a full video with caption and description', () => {
            const result = VideoSchema.safeParse({
                ...validVideo,
                caption: 'A nice video',
                description: 'Long enough description for the video preview.'
            });
            expect(result.success).toBe(true);
        });

        it('rejects when url is missing', () => {
            const result = VideoSchema.safeParse({ moderationState: 'APPROVED' });
            expect(result.success).toBe(false);
        });

        it('rejects an invalid url', () => {
            const result = VideoSchema.safeParse({
                url: 'not-a-url',
                moderationState: 'APPROVED'
            });
            expect(result.success).toBe(false);
        });

        it('rejects when moderationState is missing', () => {
            const result = VideoSchema.safeParse({ url: 'https://example.com/v.mp4' });
            expect(result.success).toBe(false);
        });

        it('rejects an unknown moderationState value', () => {
            const result = VideoSchema.safeParse({
                url: 'https://example.com/v.mp4',
                moderationState: 'INVALID'
            });
            expect(result.success).toBe(false);
        });

        it('rejects a caption shorter than 3 chars', () => {
            const result = VideoSchema.safeParse({ ...validVideo, caption: 'ab' });
            expect(result.success).toBe(false);
        });

        it('rejects a caption longer than 100 chars', () => {
            const result = VideoSchema.safeParse({ ...validVideo, caption: 'a'.repeat(101) });
            expect(result.success).toBe(false);
        });

        it('rejects a description shorter than 10 chars', () => {
            const result = VideoSchema.safeParse({ ...validVideo, description: 'short' });
            expect(result.success).toBe(false);
        });

        it('rejects a description longer than 300 chars', () => {
            const result = VideoSchema.safeParse({
                ...validVideo,
                description: 'a'.repeat(301)
            });
            expect(result.success).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // MediaSchema
    // -----------------------------------------------------------------------
    describe('MediaSchema', () => {
        describe('featuredImage — GAP-078-185', () => {
            it('accepts an empty object (featuredImage optional)', () => {
                const result = MediaSchema.safeParse({});
                expect(result.success).toBe(true);
            });

            it('accepts an empty gallery without featuredImage', () => {
                const result = MediaSchema.safeParse({ gallery: [] });
                expect(result.success).toBe(true);
            });

            it('still accepts a populated featuredImage', () => {
                const result = MediaSchema.safeParse({ featuredImage: validImage });
                expect(result.success).toBe(true);
            });

            it('rejects a featuredImage missing required url', () => {
                const result = MediaSchema.safeParse({
                    featuredImage: { moderationState: 'APPROVED' }
                });
                expect(result.success).toBe(false);
            });
        });

        describe('gallery', () => {
            it('accepts a gallery with multiple valid images', () => {
                const result = MediaSchema.safeParse({
                    gallery: [validImage, { ...validImage, publicId: 'hospeda/dev/y' }]
                });
                expect(result.success).toBe(true);
            });

            it('rejects a gallery containing an invalid image', () => {
                const result = MediaSchema.safeParse({
                    gallery: [validImage, { url: 'not-a-url', moderationState: 'APPROVED' }]
                });
                expect(result.success).toBe(false);
            });

            it('does NOT enforce a 50-item Zod cap (DB-level CHECK only)', () => {
                // Document the schema quirk: gallery cap is enforced at the DB
                // CHECK constraint level (see packages/db migrations), not at
                // the Zod layer. A 51-item array still parses cleanly.
                const oversize = Array.from({ length: 51 }, () => validImage);
                const result = MediaSchema.safeParse({ gallery: oversize });
                expect(result.success).toBe(true);
            });

            it('rejects a non-array gallery', () => {
                const result = MediaSchema.safeParse({ gallery: 'nope' });
                expect(result.success).toBe(false);
            });
        });

        describe('videos', () => {
            it('accepts a videos array with a valid entry', () => {
                const result = MediaSchema.safeParse({ videos: [validVideo] });
                expect(result.success).toBe(true);
            });

            it('rejects a videos array containing an invalid entry', () => {
                const result = MediaSchema.safeParse({
                    videos: [{ url: 'not-a-url', moderationState: 'APPROVED' }]
                });
                expect(result.success).toBe(false);
            });

            it('rejects a non-array videos value', () => {
                const result = MediaSchema.safeParse({ videos: 'nope' });
                expect(result.success).toBe(false);
            });
        });

        it('accepts a fully populated media container', () => {
            const result = MediaSchema.safeParse({
                featuredImage: validImage,
                gallery: [validImage, validImage],
                videos: [validVideo]
            });
            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // BaseMediaFields
    // -----------------------------------------------------------------------
    describe('BaseMediaFields', () => {
        it('exposes an optional `media` Zod schema', () => {
            // Sanity-check the shape. `BaseMediaFields` is a const object used
            // to spread into entity schemas. Its `media` key should be a Zod
            // schema that accepts `undefined`.
            expect(BaseMediaFields.media).toBeDefined();
            const result = BaseMediaFields.media.safeParse(undefined);
            expect(result.success).toBe(true);
        });

        it('accepts an empty object for `media`', () => {
            const result = BaseMediaFields.media.safeParse({});
            expect(result.success).toBe(true);
        });

        it('accepts a fully populated media container', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: validImage,
                gallery: [validImage],
                videos: [validVideo]
            });
            expect(result.success).toBe(true);
        });

        it('accepts a featuredImage with caption and description within bounds', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: {
                    url: 'https://example.com/a.jpg',
                    moderationState: 'APPROVED',
                    caption: 'Caption ok',
                    description: 'A description that is just long enough.'
                }
            });
            expect(result.success).toBe(true);
        });

        it('rejects a featuredImage with an invalid url', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: {
                    url: 'not-a-url',
                    moderationState: 'APPROVED'
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects a featuredImage missing moderationState', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: { url: 'https://example.com/a.jpg' }
            });
            expect(result.success).toBe(false);
        });

        it('rejects a gallery item with an invalid url', () => {
            const result = BaseMediaFields.media.safeParse({
                gallery: [{ url: 'not-a-url', moderationState: 'APPROVED' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects a videos entry with an invalid url', () => {
            const result = BaseMediaFields.media.safeParse({
                videos: [{ url: 'not-a-url', moderationState: 'APPROVED' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects a featuredImage caption shorter than 3 chars', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: {
                    url: 'https://example.com/a.jpg',
                    moderationState: 'APPROVED',
                    caption: 'ab'
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects a featuredImage description longer than 300 chars', () => {
            const result = BaseMediaFields.media.safeParse({
                featuredImage: {
                    url: 'https://example.com/a.jpg',
                    moderationState: 'APPROVED',
                    description: 'a'.repeat(301)
                }
            });
            expect(result.success).toBe(false);
        });

        describe('alt — SPEC-154 a11y persistence', () => {
            it('accepts a featuredImage with alt within bounds', () => {
                const result = BaseMediaFields.media.safeParse({
                    featuredImage: {
                        url: 'https://example.com/a.jpg',
                        moderationState: 'APPROVED',
                        alt: 'Hosteria al borde del río Uruguay'
                    }
                });
                expect(result.success).toBe(true);
                if (result.success && result.data?.featuredImage) {
                    expect((result.data.featuredImage as Record<string, unknown>).alt).toBe(
                        'Hosteria al borde del río Uruguay'
                    );
                }
            });

            it('accepts a gallery item with alt', () => {
                const result = BaseMediaFields.media.safeParse({
                    gallery: [
                        {
                            url: 'https://example.com/g.jpg',
                            moderationState: 'APPROVED',
                            alt: 'Pileta vista de noche'
                        }
                    ]
                });
                expect(result.success).toBe(true);
                if (result.success && result.data?.gallery?.[0]) {
                    expect((result.data.gallery[0] as Record<string, unknown>).alt).toBe(
                        'Pileta vista de noche'
                    );
                }
            });

            it('rejects a featuredImage with empty-string alt', () => {
                const result = BaseMediaFields.media.safeParse({
                    featuredImage: {
                        url: 'https://example.com/a.jpg',
                        moderationState: 'APPROVED',
                        alt: ''
                    }
                });
                expect(result.success).toBe(false);
            });

            it('rejects a featuredImage with alt longer than 200 chars', () => {
                const result = BaseMediaFields.media.safeParse({
                    featuredImage: {
                        url: 'https://example.com/a.jpg',
                        moderationState: 'APPROVED',
                        alt: 'a'.repeat(201)
                    }
                });
                expect(result.success).toBe(false);
            });
        });

        it('does NOT carry the publicId / attribution extensions of the standalone ImageSchema', () => {
            // BaseMediaFields uses its own inline image shape (kept for
            // historical compatibility with entity schemas) which does NOT
            // declare `publicId` or `attribution`. Any extra unknown keys are
            // stripped by default (Zod's strip behavior), so the parse still
            // succeeds but the extra keys are dropped from the parsed output.
            const result = BaseMediaFields.media.safeParse({
                featuredImage: {
                    url: 'https://example.com/a.jpg',
                    moderationState: 'APPROVED',
                    publicId: 'should-be-stripped',
                    attribution: { photographer: 'ignored' }
                }
            });
            expect(result.success).toBe(true);
            if (result.success && result.data?.featuredImage) {
                expect(
                    (result.data.featuredImage as Record<string, unknown>).publicId
                ).toBeUndefined();
                expect(
                    (result.data.featuredImage as Record<string, unknown>).attribution
                ).toBeUndefined();
            }
        });
    });
});
