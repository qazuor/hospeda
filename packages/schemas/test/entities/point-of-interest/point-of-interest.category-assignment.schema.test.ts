import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    PointOfInterestCategoryAssignmentSchema,
    PointOfInterestSetCategoriesInputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.category-assignment.schema.js';

describe('PointOfInterestSetCategoriesInputSchema', () => {
    it('should validate when primaryCategoryId is included in categoryIds', () => {
        const primaryCategoryId = faker.string.uuid();
        const input = {
            pointOfInterestId: faker.string.uuid(),
            categoryIds: [primaryCategoryId, faker.string.uuid()],
            primaryCategoryId
        };

        const result = PointOfInterestSetCategoriesInputSchema.safeParse(input);
        expect(result.success).toBe(true);
    });

    it('should reject when primaryCategoryId is NOT included in categoryIds', () => {
        const input = {
            pointOfInterestId: faker.string.uuid(),
            categoryIds: [faker.string.uuid(), faker.string.uuid()],
            primaryCategoryId: faker.string.uuid()
        };

        const result = PointOfInterestSetCategoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.pointOfInterest.categories.primaryNotInSet'
            );
            expect(result.error.issues[0]?.path).toEqual(['primaryCategoryId']);
        }
    });

    it('should validate with a single category that is also primary', () => {
        const categoryId = faker.string.uuid();
        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: faker.string.uuid(),
            categoryIds: [categoryId],
            primaryCategoryId: categoryId
        });
        expect(result.success).toBe(true);
    });

    it('should reject an empty categoryIds array (min 1)', () => {
        const primaryCategoryId = faker.string.uuid();
        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: faker.string.uuid(),
            categoryIds: [],
            primaryCategoryId
        });
        expect(result.success).toBe(false);
    });

    it('should accept exactly 10 categoryIds (max boundary)', () => {
        const categoryIds = Array.from({ length: 10 }, () => faker.string.uuid());
        const primaryCategoryId = categoryIds[0] as string;

        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: faker.string.uuid(),
            categoryIds,
            primaryCategoryId
        });
        expect(result.success).toBe(true);
    });

    it('should reject more than 10 categoryIds (max cap)', () => {
        const categoryIds = Array.from({ length: 11 }, () => faker.string.uuid());
        const primaryCategoryId = categoryIds[0] as string;

        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: faker.string.uuid(),
            categoryIds,
            primaryCategoryId
        });
        expect(result.success).toBe(false);
    });

    it('should reject an invalid pointOfInterestId UUID', () => {
        const primaryCategoryId = faker.string.uuid();
        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: 'not-a-uuid',
            categoryIds: [primaryCategoryId],
            primaryCategoryId
        });
        expect(result.success).toBe(false);
    });

    it('should reject a non-UUID entry inside categoryIds', () => {
        const result = PointOfInterestSetCategoriesInputSchema.safeParse({
            pointOfInterestId: faker.string.uuid(),
            categoryIds: ['not-a-uuid'],
            primaryCategoryId: 'not-a-uuid'
        });
        expect(result.success).toBe(false);
    });
});

describe('PointOfInterestCategoryAssignmentSchema', () => {
    it('should validate a valid category assignment', () => {
        const validAssignment = {
            id: faker.string.uuid(),
            slug: 'beach',
            nameI18n: { es: 'Playa', en: 'Beach', pt: 'Praia' },
            icon: 'beach-icon',
            isPrimary: true
        };

        const result = PointOfInterestCategoryAssignmentSchema.safeParse(validAssignment);
        expect(result.success).toBe(true);
    });

    it('should allow a null icon', () => {
        const result = PointOfInterestCategoryAssignmentSchema.safeParse({
            id: faker.string.uuid(),
            slug: 'beach',
            nameI18n: { es: 'Playa', en: 'Beach', pt: 'Praia' },
            icon: null,
            isPrimary: false
        });
        expect(result.success).toBe(true);
    });

    it('should allow an omitted icon (nullish)', () => {
        const result = PointOfInterestCategoryAssignmentSchema.safeParse({
            id: faker.string.uuid(),
            slug: 'beach',
            nameI18n: { es: 'Playa', en: 'Beach', pt: 'Praia' },
            isPrimary: false
        });
        expect(result.success).toBe(true);
    });

    it('should reject a missing nameI18n', () => {
        const result = PointOfInterestCategoryAssignmentSchema.safeParse({
            id: faker.string.uuid(),
            slug: 'beach',
            isPrimary: false
        });
        expect(result.success).toBe(false);
    });

    it('should reject a missing isPrimary', () => {
        const result = PointOfInterestCategoryAssignmentSchema.safeParse({
            id: faker.string.uuid(),
            slug: 'beach',
            nameI18n: { es: 'Playa', en: 'Beach', pt: 'Praia' }
        });
        expect(result.success).toBe(false);
    });
});
