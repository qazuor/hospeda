import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    VenueReviewCreateInputSchema,
    VenueReviewSchema,
    VenueReviewUpdateInputSchema
} from '../../../src/entities/venue/subtypes/venue.review.schema.js';

const venueId = faker.string.uuid();

const validReviewBase = () => ({
    id: faker.string.uuid(),
    venueId,
    userId: faker.string.uuid(),
    overallRating: 4,
    // DB columns: title (nullable), content (nullable)
    title: 'Excellent visit',
    content: 'Excellent food and service! Would definitely come back.',
    lifecycleState: 'ACTIVE',
    moderationState: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: faker.string.uuid(),
    updatedById: null
});

describe('VenueReviewSchema', () => {
    it('should validate a valid review', () => {
        const data = validReviewBase();
        expect(() => VenueReviewSchema.parse(data)).not.toThrow();
    });

    it('should validate a review with rating breakdown', () => {
        const data = {
            ...validReviewBase(),
            rating: {
                food: 4.5,
                service: 4,
                ambiance: 3.5,
                value: 4
            }
        };
        expect(() => VenueReviewSchema.parse(data)).not.toThrow();
    });

    it('should validate a guest review with null userId', () => {
        const data = { ...validReviewBase(), userId: null, reviewerName: 'Anonymous Guest' };
        expect(() => VenueReviewSchema.parse(data)).not.toThrow();
    });

    it('should reject overallRating below 1', () => {
        const data = { ...validReviewBase(), overallRating: 0 };
        expect(() => VenueReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject overallRating above 5', () => {
        const data = { ...validReviewBase(), overallRating: 6 };
        expect(() => VenueReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject content shorter than 10 characters', () => {
        const data = { ...validReviewBase(), content: 'Good' };
        expect(() => VenueReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should accept null title and null content (both nullable)', () => {
        const data = { ...validReviewBase(), title: null, content: null };
        expect(() => VenueReviewSchema.parse(data)).not.toThrow();
    });

    it('should carry averageRating field (mirrors DB average_rating column)', () => {
        const data = { ...validReviewBase(), averageRating: 4.25 };
        const result = VenueReviewSchema.parse(data);
        expect(result.averageRating).toBe(4.25);
    });

    it('should default averageRating to 0 when absent', () => {
        const result = VenueReviewSchema.parse(validReviewBase());
        expect(result.averageRating).toBe(0);
    });

    it('should reject invalid venueId', () => {
        const data = { ...validReviewBase(), venueId: 'not-a-uuid' };
        expect(() => VenueReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject a rating with an out-of-range dimension (VenueRatingSchema enforced on entity schema)', () => {
        // GastronomyReviewSchema.rating is GastronomyRatingSchema.nullish() — invalid dimensions
        // are rejected directly on the entity schema (food max is 5).
        const data = {
            ...validReviewBase(),
            rating: { food: 6, service: 4, ambiance: 3, value: 4 }
        };
        expect(() => VenueReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should accept a null rating breakdown (SPEC-259: column is nullable, reads back NULL)', () => {
        // Regression: the `rating` column dropped NOT NULL (migration 0023), so a
        // rating-less review reads back NULL. The entity schema (used for response
        // validation on the create route) must accept null — not only undefined —
        // or the create response would fail validation after a successful insert.
        const data = { ...validReviewBase(), rating: null };
        expect(() => VenueReviewSchema.parse(data)).not.toThrow();
    });
});

describe('VenueReviewCreateInputSchema', () => {
    it('should validate a minimal create input (only required fields)', () => {
        const data = {
            venueId,
            overallRating: 5
        };
        expect(() => VenueReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should validate a full create input', () => {
        const data = {
            venueId,
            overallRating: 4,
            rating: { food: 4, service: 4, ambiance: 4, value: 3 },
            title: 'Great dinner',
            content: 'Great dining experience!',
            reviewerName: 'Juan'
        };
        expect(() => VenueReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should validate create with title and content both absent (both optional)', () => {
        const data = { venueId, overallRating: 5 };
        expect(() => VenueReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should not have comment field (replaced by title + content)', () => {
        const keys = Object.keys(VenueReviewCreateInputSchema.shape);
        expect(keys).not.toContain('comment');
        expect(keys).toContain('title');
        expect(keys).toContain('content');
    });

    it('should reject missing venueId', () => {
        const data = { overallRating: 4 };
        expect(() => VenueReviewCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing overallRating', () => {
        const data = { venueId };
        expect(() => VenueReviewCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('VenueReviewUpdateInputSchema', () => {
    it('should allow an empty update (all optional)', () => {
        expect(() => VenueReviewUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should validate a partial update with just overallRating', () => {
        const data = { overallRating: 3 };
        expect(() => VenueReviewUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject overallRating out of range on update', () => {
        expect(() => VenueReviewUpdateInputSchema.parse({ overallRating: 0 })).toThrow(ZodError);
    });

    it('should not include venueId in update (FK is immutable)', () => {
        const keys = Object.keys(VenueReviewUpdateInputSchema.shape ?? {});
        expect(keys).not.toContain('venueId');
    });
});
