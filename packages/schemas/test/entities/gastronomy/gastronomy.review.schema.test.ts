import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyReviewCreateInputSchema,
    GastronomyReviewSchema,
    GastronomyReviewUpdateInputSchema
} from '../../../src/entities/gastronomy/subtypes/gastronomy.review.schema.js';

const gastronomyId = faker.string.uuid();

const validReviewBase = () => ({
    id: faker.string.uuid(),
    gastronomyId,
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

describe('GastronomyReviewSchema', () => {
    it('should validate a valid review', () => {
        const data = validReviewBase();
        expect(() => GastronomyReviewSchema.parse(data)).not.toThrow();
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
        expect(() => GastronomyReviewSchema.parse(data)).not.toThrow();
    });

    it('should validate a guest review with null userId', () => {
        const data = { ...validReviewBase(), userId: null, reviewerName: 'Anonymous Guest' };
        expect(() => GastronomyReviewSchema.parse(data)).not.toThrow();
    });

    it('should reject overallRating below 1', () => {
        const data = { ...validReviewBase(), overallRating: 0 };
        expect(() => GastronomyReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject overallRating above 5', () => {
        const data = { ...validReviewBase(), overallRating: 6 };
        expect(() => GastronomyReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject content shorter than 10 characters', () => {
        const data = { ...validReviewBase(), content: 'Good' };
        expect(() => GastronomyReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should accept null title and null content (both nullable)', () => {
        const data = { ...validReviewBase(), title: null, content: null };
        expect(() => GastronomyReviewSchema.parse(data)).not.toThrow();
    });

    it('should carry averageRating field (mirrors DB average_rating column)', () => {
        const data = { ...validReviewBase(), averageRating: 4.25 };
        const result = GastronomyReviewSchema.parse(data);
        expect(result.averageRating).toBe(4.25);
    });

    it('should default averageRating to 0 when absent', () => {
        const result = GastronomyReviewSchema.parse(validReviewBase());
        expect(result.averageRating).toBe(0);
    });

    it('should reject invalid gastronomyId', () => {
        const data = { ...validReviewBase(), gastronomyId: 'not-a-uuid' };
        expect(() => GastronomyReviewSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject a rating with an out-of-range dimension (CommerceRatingSchema enforced on entity schema)', () => {
        // GastronomyReviewSchema.rating is CommerceRatingSchema.optional() — invalid dimensions
        // are rejected directly on the entity schema (food max is 5).
        const data = {
            ...validReviewBase(),
            rating: { food: 6, service: 4, ambiance: 3, value: 4 }
        };
        expect(() => GastronomyReviewSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyReviewCreateInputSchema', () => {
    it('should validate a minimal create input (only required fields)', () => {
        const data = {
            gastronomyId,
            overallRating: 5
        };
        expect(() => GastronomyReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should validate a full create input', () => {
        const data = {
            gastronomyId,
            overallRating: 4,
            rating: { food: 4, service: 4, ambiance: 4, value: 3 },
            title: 'Great dinner',
            content: 'Great dining experience!',
            reviewerName: 'Juan'
        };
        expect(() => GastronomyReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should validate create with title and content both absent (both optional)', () => {
        const data = { gastronomyId, overallRating: 5 };
        expect(() => GastronomyReviewCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should not have comment field (replaced by title + content)', () => {
        const keys = Object.keys(GastronomyReviewCreateInputSchema.shape);
        expect(keys).not.toContain('comment');
        expect(keys).toContain('title');
        expect(keys).toContain('content');
    });

    it('should reject missing gastronomyId', () => {
        const data = { overallRating: 4 };
        expect(() => GastronomyReviewCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing overallRating', () => {
        const data = { gastronomyId };
        expect(() => GastronomyReviewCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyReviewUpdateInputSchema', () => {
    it('should allow an empty update (all optional)', () => {
        expect(() => GastronomyReviewUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should validate a partial update with just overallRating', () => {
        const data = { overallRating: 3 };
        expect(() => GastronomyReviewUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject overallRating out of range on update', () => {
        expect(() => GastronomyReviewUpdateInputSchema.parse({ overallRating: 0 })).toThrow(
            ZodError
        );
    });

    it('should not include gastronomyId in update (FK is immutable)', () => {
        const keys = Object.keys(GastronomyReviewUpdateInputSchema.shape ?? {});
        expect(keys).not.toContain('gastronomyId');
    });
});
