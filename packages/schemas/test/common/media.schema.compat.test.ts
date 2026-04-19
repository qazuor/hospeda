/**
 * Schema compatibility test for `common/media.schema.ts`.
 *
 * Enforces the additive-only schema compatibility policy documented in
 * `packages/schemas/docs/guides/schema-compat-policy.md`: every historic
 * shape captured under `test/fixtures/historic/media.historic.ts` MUST
 * still `safeParse` successfully against the current schemas.
 *
 * If a change causes any of these assertions to fail, that change is
 * BREAKING and must follow the three-phase migration path (additive →
 * backfill → removal) before landing.
 */
import { describe, expect, it } from 'vitest';
import { ImageSchema, MediaSchema, VideoSchema } from '../../src/common/media.schema.js';
import {
    imagePostSpec078WithExtensions,
    imagePreSpec078,
    imagePreSpec078WithCaption,
    mediaPostSpec078Empty,
    mediaPreSpec078,
    mediaPreSpec078Full,
    videoPreSpec078
} from '../fixtures/historic/media.historic.js';

describe('media.schema compat — historic fixtures still parse', () => {
    describe('ImageSchema', () => {
        it('parses the pre-SPEC-078 minimal image shape', () => {
            const result = ImageSchema.safeParse(imagePreSpec078);
            expect(result.success).toBe(true);
        });

        it('parses the pre-SPEC-078 image with caption and description', () => {
            const result = ImageSchema.safeParse(imagePreSpec078WithCaption);
            expect(result.success).toBe(true);
        });

        it('parses the post-SPEC-078 image with publicId and attribution', () => {
            const result = ImageSchema.safeParse(imagePostSpec078WithExtensions);
            expect(result.success).toBe(true);
        });
    });

    describe('VideoSchema', () => {
        it('parses the pre-SPEC-078 minimal video shape', () => {
            const result = VideoSchema.safeParse(videoPreSpec078);
            expect(result.success).toBe(true);
        });
    });

    describe('MediaSchema', () => {
        it('parses the pre-SPEC-078 featuredImage-only media container', () => {
            const result = MediaSchema.safeParse(mediaPreSpec078);
            expect(result.success).toBe(true);
        });

        it('parses the pre-SPEC-078 full media container with gallery and videos', () => {
            const result = MediaSchema.safeParse(mediaPreSpec078Full);
            expect(result.success).toBe(true);
        });

        it('parses the post-SPEC-078 empty media container (GAP-078-185)', () => {
            const result = MediaSchema.safeParse(mediaPostSpec078Empty);
            expect(result.success).toBe(true);
        });
    });
});
