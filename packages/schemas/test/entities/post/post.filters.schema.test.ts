import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    BasePostQueryParamsSchema,
    GetPostByCategoryInputSchema,
    GetPostByRelatedAccommodationInputSchema,
    GetPostByRelatedDestinationInputSchema,
    GetPostByRelatedEventInputSchema,
    GetPostFeaturedInputSchema,
    GetPostNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema
} from '../../../src/entities/post/subtypes/post.filters.schema.js';
import { PostCategoryEnum, VisibilityEnum } from '../../../src/enums/index.js';

describe('Post Filters Schemas', () => {
    describe('BasePostQueryParamsSchema', () => {
        it('should validate with all optional fields', () => {
            const validParams = {
                visibility: VisibilityEnum.PUBLIC,
                fromDate: faker.date.past(),
                toDate: faker.date.future()
            };

            expect(() => BasePostQueryParamsSchema.parse(validParams)).not.toThrow();

            const parsed = BasePostQueryParamsSchema.parse(validParams);
            expect(parsed.visibility).toBe(validParams.visibility);
            expect(parsed.fromDate).toEqual(validParams.fromDate);
            expect(parsed.toDate).toEqual(validParams.toDate);
        });

        it('should validate empty object', () => {
            const validParams = {};

            expect(() => BasePostQueryParamsSchema.parse(validParams)).not.toThrow();

            const parsed = BasePostQueryParamsSchema.parse(validParams);
            expect(parsed.visibility).toBeUndefined();
            expect(parsed.fromDate).toBeUndefined();
            expect(parsed.toDate).toBeUndefined();
        });
    });

    describe('GetPostNewsInputSchema', () => {
        it('should validate valid news query params', () => {
            const validParams = {
                visibility: VisibilityEnum.PUBLIC,
                fromDate: faker.date.past(),
                toDate: faker.date.future()
            };

            expect(() => GetPostNewsInputSchema.parse(validParams)).not.toThrow();
        });

        it('should validate empty params', () => {
            const validParams = {};

            expect(() => GetPostNewsInputSchema.parse(validParams)).not.toThrow();
        });

        it('should reject extra fields (strict mode)', () => {
            const invalidParams = {
                visibility: VisibilityEnum.PUBLIC,
                extraField: 'not-allowed'
            };

            expect(() => GetPostNewsInputSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('GetPostFeaturedInputSchema', () => {
        it('should validate valid featured query params', () => {
            const validParams = {
                visibility: VisibilityEnum.PRIVATE,
                fromDate: faker.date.past()
            };

            expect(() => GetPostFeaturedInputSchema.parse(validParams)).not.toThrow();
        });

        it('should validate empty params', () => {
            const validParams = {};

            expect(() => GetPostFeaturedInputSchema.parse(validParams)).not.toThrow();
        });
    });

    describe('GetPostByCategoryInputSchema', () => {
        it('should validate valid category query params', () => {
            const validParams = {
                category: PostCategoryEnum.TOURISM,
                visibility: VisibilityEnum.PUBLIC,
                fromDate: faker.date.past(),
                toDate: faker.date.future()
            };

            expect(() => GetPostByCategoryInputSchema.parse(validParams)).not.toThrow();

            const parsed = GetPostByCategoryInputSchema.parse(validParams);
            expect(parsed.category).toBe(validParams.category);
        });

        it('should require category field', () => {
            const invalidParams = {
                visibility: VisibilityEnum.PUBLIC
            };

            expect(() => GetPostByCategoryInputSchema.parse(invalidParams)).toThrow(ZodError);
        });

        it('should reject invalid category', () => {
            const invalidParams = {
                category: 'INVALID_CATEGORY'
            };

            expect(() => GetPostByCategoryInputSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('GetPostByRelatedAccommodationInputSchema', () => {
        it('should validate valid accommodation query params', () => {
            const validParams = {
                accommodationId: faker.string.uuid(),
                visibility: VisibilityEnum.PUBLIC,
                fromDate: faker.date.past()
            };

            expect(() => GetPostByRelatedAccommodationInputSchema.parse(validParams)).not.toThrow();

            const parsed = GetPostByRelatedAccommodationInputSchema.parse(validParams);
            expect(parsed.accommodationId).toBe(validParams.accommodationId);
        });

        it('should require accommodationId field', () => {
            const invalidParams = {
                visibility: VisibilityEnum.PUBLIC
            };

            expect(() => GetPostByRelatedAccommodationInputSchema.parse(invalidParams)).toThrow(
                ZodError
            );
        });

        it('should reject invalid accommodationId', () => {
            const invalidParams = {
                accommodationId: 'not-a-uuid'
            };

            expect(() => GetPostByRelatedAccommodationInputSchema.parse(invalidParams)).toThrow(
                ZodError
            );
        });
    });

    describe('GetPostByRelatedDestinationInputSchema', () => {
        it('should validate valid destination query params', () => {
            const validParams = {
                destinationId: faker.string.uuid(),
                visibility: VisibilityEnum.RESTRICTED,
                toDate: faker.date.future()
            };

            expect(() => GetPostByRelatedDestinationInputSchema.parse(validParams)).not.toThrow();

            const parsed = GetPostByRelatedDestinationInputSchema.parse(validParams);
            expect(parsed.destinationId).toBe(validParams.destinationId);
        });

        it('should require destinationId field', () => {
            const invalidParams = {
                visibility: VisibilityEnum.PUBLIC
            };

            expect(() => GetPostByRelatedDestinationInputSchema.parse(invalidParams)).toThrow(
                ZodError
            );
        });
    });

    describe('GetPostByRelatedEventInputSchema', () => {
        it('should validate valid event query params', () => {
            const validParams = {
                eventId: faker.string.uuid(),
                visibility: VisibilityEnum.PUBLIC
            };

            expect(() => GetPostByRelatedEventInputSchema.parse(validParams)).not.toThrow();

            const parsed = GetPostByRelatedEventInputSchema.parse(validParams);
            expect(parsed.eventId).toBe(validParams.eventId);
        });

        it('should require eventId field', () => {
            const invalidParams = {
                visibility: VisibilityEnum.PUBLIC
            };

            expect(() => GetPostByRelatedEventInputSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('GetPostSummaryInputSchema', () => {
        it('should validate with id only', () => {
            const validInput = {
                id: faker.string.uuid()
            };

            expect(() => GetPostSummaryInputSchema.parse(validInput)).not.toThrow();

            const parsed = GetPostSummaryInputSchema.parse(validInput);
            expect(parsed.id).toBe(validInput.id);
            expect(parsed.slug).toBeUndefined();
        });

        it('should validate with slug only', () => {
            const validInput = {
                slug: 'my-awesome-post'
            };

            expect(() => GetPostSummaryInputSchema.parse(validInput)).not.toThrow();

            const parsed = GetPostSummaryInputSchema.parse(validInput);
            expect(parsed.slug).toBe(validInput.slug);
            expect(parsed.id).toBeUndefined();
        });

        it('should validate with both id and slug', () => {
            const validInput = {
                id: faker.string.uuid(),
                slug: 'my-awesome-post'
            };

            expect(() => GetPostSummaryInputSchema.parse(validInput)).not.toThrow();

            const parsed = GetPostSummaryInputSchema.parse(validInput);
            expect(parsed.id).toBe(validInput.id);
            expect(parsed.slug).toBe(validInput.slug);
        });

        it('should reject empty object (requires id or slug)', () => {
            const invalidInput = {};

            expect(() => GetPostSummaryInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject invalid id', () => {
            const invalidInput = {
                id: 'not-a-uuid'
            };

            expect(() => GetPostSummaryInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject empty slug', () => {
            const invalidInput = {
                slug: ''
            };

            expect(() => GetPostSummaryInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('GetPostStatsInputSchema', () => {
        it('should validate with id only', () => {
            const validInput = {
                id: faker.string.uuid()
            };

            expect(() => GetPostStatsInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate with slug only', () => {
            const validInput = {
                slug: 'post-stats-test'
            };

            expect(() => GetPostStatsInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject empty object (requires id or slug)', () => {
            const invalidInput = {};

            expect(() => GetPostStatsInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });
});
