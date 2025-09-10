import { describe, expect, it } from 'vitest';
import { AccommodationSchema } from '../../src/entities/accommodation/accommodation.schema.js';
import { DestinationSchema } from '../../src/entities/destination/destination.schema.js';
import { PostSchema } from '../../src/entities/post/post.schema.js';
import { UserSchema } from '../../src/entities/user/user.schema.js';
import { createValidAccommodation } from '../fixtures/accommodation.fixtures.js';
import { createTagFixture } from '../fixtures/common.fixtures.js';
import { createValidDestination } from '../fixtures/destination.fixtures.js';
import { createValidPost } from '../fixtures/post.fixtures.js';
import { createValidUser } from '../fixtures/user.fixtures.js';

describe('Cross-Schema Integration Tests', () => {
    describe('Schema Consistency', () => {
        it('should have consistent ID field types across all schemas', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();
            const user = createValidUser();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);
            const userResult = UserSchema.parse(user);

            // All IDs should be strings (UUIDs)
            expect(typeof accommodationResult.id).toBe('string');
            expect(typeof destinationResult.id).toBe('string');
            expect(typeof postResult.id).toBe('string');
            expect(typeof userResult.id).toBe('string');
        });

        it('should have consistent audit field types across all schemas', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();
            const user = createValidUser();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);
            const userResult = UserSchema.parse(user);

            // All should have consistent audit fields
            expect(accommodationResult.createdAt).toBeInstanceOf(Date);
            expect(accommodationResult.updatedAt).toBeInstanceOf(Date);
            expect(destinationResult.createdAt).toBeInstanceOf(Date);
            expect(destinationResult.updatedAt).toBeInstanceOf(Date);
            expect(postResult.createdAt).toBeInstanceOf(Date);
            expect(postResult.updatedAt).toBeInstanceOf(Date);
            expect(userResult.createdAt).toBeInstanceOf(Date);
            expect(userResult.updatedAt).toBeInstanceOf(Date);
        });

        it('should have consistent visibility field types where applicable', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);

            // All should have consistent visibility enums
            expect(['PUBLIC', 'PRIVATE', 'RESTRICTED']).toContain(accommodationResult.visibility);
            expect(['PUBLIC', 'PRIVATE', 'RESTRICTED']).toContain(destinationResult.visibility);
            expect(['PUBLIC', 'PRIVATE', 'RESTRICTED']).toContain(postResult.visibility);
        });
    });

    describe('Relationship Field Validation', () => {
        it('should validate accommodation-destination relationships', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();

            // Accommodation should reference destination by ID
            accommodation.destinationId = destination.id;

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);

            expect(accommodationResult.destinationId).toBe(destinationResult.id);
        });

        it('should validate post-user relationships', () => {
            const post = createValidPost();
            const user = createValidUser();

            // Post should reference user as author
            post.authorId = user.id;

            const postResult = PostSchema.parse(post);
            const userResult = UserSchema.parse(user);

            expect(postResult.authorId).toBe(userResult.id);
        });

        it('should validate post-accommodation relationships', () => {
            const post = createValidPost();
            const accommodation = createValidAccommodation();

            // Post can reference accommodation
            post.relatedAccommodationId = accommodation.id;

            const postResult = PostSchema.parse(post);
            const accommodationResult = AccommodationSchema.parse(accommodation);

            expect(postResult.relatedAccommodationId).toBe(accommodationResult.id);
        });

        it('should validate post-destination relationships', () => {
            const post = createValidPost();
            const destination = createValidDestination();

            // Post can reference destination
            post.relatedDestinationId = destination.id;

            const postResult = PostSchema.parse(post);
            const destinationResult = DestinationSchema.parse(destination);

            expect(postResult.relatedDestinationId).toBe(destinationResult.id);
        });
    });

    describe('Common Field Patterns', () => {
        it('should handle tags consistently across schemas', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            // All should accept TagSchema objects for tags
            accommodation.tags = [createTagFixture(), createTagFixture(), createTagFixture()];
            destination.tags = [createTagFixture(), createTagFixture(), createTagFixture()];
            post.tags = [createTagFixture(), createTagFixture(), createTagFixture()];

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);

            expect(Array.isArray(accommodationResult.tags)).toBe(true);
            expect(Array.isArray(destinationResult.tags)).toBe(true);
            expect(Array.isArray(postResult.tags)).toBe(true);
        });

        it('should handle media fields consistently', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);

            // All should have consistent media structure (featuredImage is optional)
            if (accommodationResult.media?.featuredImage) {
                expect(accommodationResult.media.featuredImage.url).toBeDefined();
            }
            if (destinationResult.media?.featuredImage) {
                expect(destinationResult.media.featuredImage.url).toBeDefined();
            }
            if (postResult.media?.featuredImage) {
                expect(postResult.media.featuredImage.url).toBeDefined();
            }

            // Media field should be an object when present
            if (accommodationResult.media) {
                expect(typeof accommodationResult.media).toBe('object');
            }
            if (destinationResult.media) {
                expect(typeof destinationResult.media).toBe('object');
            }
            if (postResult.media) {
                expect(typeof postResult.media).toBe('object');
            }
        });

        it('should handle SEO fields consistently', () => {
            // Create entities with explicit SEO data to ensure consistency
            const seoData = {
                title: 'SEO title with exactly thirty chars', // 30-60 chars
                description:
                    'This is a consistent SEO description that has at least seventy characters to meet the minimum requirement for SEO descriptions.',
                keywords: ['test', 'seo', 'consistency']
            };

            const accommodation = { ...createValidAccommodation(), seo: seoData };
            const destination = { ...createValidDestination(), seo: seoData };
            const post = { ...createValidPost(), seo: seoData };

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);

            // All should have consistent SEO structure
            expect(accommodationResult.seo?.title).toBeDefined();
            expect(accommodationResult.seo?.description).toBeDefined();
            expect(destinationResult.seo?.title).toBeDefined();
            expect(destinationResult.seo?.description).toBeDefined();
            expect(postResult.seo?.title).toBeDefined();
            expect(postResult.seo?.description).toBeDefined();
        });
    });

    describe('Data Type Consistency', () => {
        it('should handle dates consistently across schemas', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();
            const user = createValidUser();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);
            const userResult = UserSchema.parse(user);

            // All dates should be Date objects
            expect(accommodationResult.createdAt).toBeInstanceOf(Date);
            expect(destinationResult.createdAt).toBeInstanceOf(Date);
            expect(postResult.createdAt).toBeInstanceOf(Date);
            expect(userResult.createdAt).toBeInstanceOf(Date);

            // Post doesn't have publishedAt field
            if (userResult.birthDate) {
                expect(userResult.birthDate).toBeInstanceOf(Date);
            }
        });

        it('should handle numeric fields consistently', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            const accommodationResult = AccommodationSchema.parse(accommodation);
            const destinationResult = DestinationSchema.parse(destination);
            const postResult = PostSchema.parse(post);

            // Counts should be non-negative integers
            expect(accommodationResult.reviewsCount).toBeGreaterThanOrEqual(0);
            expect(destinationResult.accommodationsCount).toBeGreaterThanOrEqual(0);
            expect(postResult.likes).toBeGreaterThanOrEqual(0);
            expect(postResult.comments).toBeGreaterThanOrEqual(0);
            expect(postResult.shares).toBeGreaterThanOrEqual(0);

            // Ratings should be between 1 and 5
            expect(accommodationResult.averageRating).toBeGreaterThanOrEqual(1);
            expect(accommodationResult.averageRating).toBeLessThanOrEqual(5);
            expect(destinationResult.averageRating).toBeGreaterThanOrEqual(1);
            expect(destinationResult.averageRating).toBeLessThanOrEqual(5);
        });
    });

    describe('Validation Edge Cases', () => {
        it('should handle empty optional arrays consistently', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            // Set empty arrays
            accommodation.tags = [];
            destination.tags = [];
            post.tags = [];

            expect(() => AccommodationSchema.parse(accommodation)).not.toThrow();
            expect(() => DestinationSchema.parse(destination)).not.toThrow();
            expect(() => PostSchema.parse(post)).not.toThrow();
        });

        it('should handle undefined optional fields consistently', () => {
            const accommodation = createValidAccommodation();
            const destination = createValidDestination();
            const post = createValidPost();

            // Set optional fields to undefined
            accommodation.seo = undefined;
            accommodation.adminInfo = undefined;
            destination.seo = undefined;
            destination.adminInfo = undefined;
            post.seo = undefined;
            post.adminInfo = undefined;

            expect(() => AccommodationSchema.parse(accommodation)).not.toThrow();
            expect(() => DestinationSchema.parse(destination)).not.toThrow();
            expect(() => PostSchema.parse(post)).not.toThrow();
        });
    });

    describe('Performance Tests', () => {
        it('should parse large datasets efficiently', () => {
            const accommodations = Array.from({ length: 100 }, () => createValidAccommodation());
            const destinations = Array.from({ length: 100 }, () => createValidDestination());
            const posts = Array.from({ length: 100 }, () => createValidPost());
            const users = Array.from({ length: 100 }, () => createValidUser());

            const startTime = Date.now();

            for (const acc of accommodations) {
                AccommodationSchema.parse(acc);
            }
            for (const dest of destinations) {
                DestinationSchema.parse(dest);
            }
            for (const post of posts) {
                PostSchema.parse(post);
            }
            for (const user of users) {
                UserSchema.parse(user);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should parse 400 objects in reasonable time (less than 1 second)
            expect(duration).toBeLessThan(1000);
        });
    });
});
