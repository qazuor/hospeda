import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PointOfInterestAdminSearchSchema } from '../../../src/entities/point-of-interest/point-of-interest.admin-search.schema.js';

describe('PointOfInterestAdminSearchSchema', () => {
    it('should validate an empty admin search (all defaults)', () => {
        const result = PointOfInterestAdminSearchSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(20);
        expect(result.includeDeleted).toBe(false);
        expect(result.isFeatured).toBeUndefined();
        expect(result.isBuiltin).toBeUndefined();
        expect(result.hasOwnPage).toBeUndefined();
        expect(result.verified).toBeUndefined();
        expect(result.destinationId).toBeUndefined();
        expect(result.categoryId).toBeUndefined();
    });

    it('should accept valid admin search with all entity-specific filters', () => {
        const data = {
            page: 1,
            pageSize: 20,
            search: 'plaza',
            type: 'PLAZA',
            isFeatured: true,
            isBuiltin: false,
            hasOwnPage: true,
            verified: true,
            destinationId: faker.string.uuid(),
            categoryId: faker.string.uuid()
        };
        expect(() => PointOfInterestAdminSearchSchema.parse(data)).not.toThrow();
    });

    describe('type filter', () => {
        it('should accept a valid PointOfInterestTypeEnum value', () => {
            const result = PointOfInterestAdminSearchSchema.parse({ type: 'BEACH' });
            expect(result.type).toBe('BEACH');
        });

        it('should reject an invalid type value', () => {
            expect(() => PointOfInterestAdminSearchSchema.parse({ type: 'NOT_A_TYPE' })).toThrow(
                ZodError
            );
        });
    });

    describe('boolean query params (isFeatured, isBuiltin, hasOwnPage, verified)', () => {
        it.each([
            'isFeatured',
            'isBuiltin',
            'hasOwnPage',
            'verified'
        ] as const)('should coerce string "true" to boolean true for %s', (field) => {
            const result = PointOfInterestAdminSearchSchema.parse({ [field]: 'true' });
            expect(result[field]).toBe(true);
        });

        it.each([
            'isFeatured',
            'isBuiltin',
            'hasOwnPage',
            'verified'
        ] as const)('should coerce string "false" to boolean false for %s (not true)', (field) => {
            const result = PointOfInterestAdminSearchSchema.parse({ [field]: 'false' });
            expect(result[field]).toBe(false);
        });

        it.each([
            'isFeatured',
            'isBuiltin',
            'hasOwnPage',
            'verified'
        ] as const)('should leave %s undefined when omitted', (field) => {
            const result = PointOfInterestAdminSearchSchema.parse({});
            expect(result[field]).toBeUndefined();
        });
    });

    describe('destinationId filter', () => {
        it('should accept a valid UUID', () => {
            const id = faker.string.uuid();
            const result = PointOfInterestAdminSearchSchema.parse({ destinationId: id });
            expect(result.destinationId).toBe(id);
        });

        it('should reject an invalid UUID', () => {
            expect(() =>
                PointOfInterestAdminSearchSchema.parse({ destinationId: 'not-a-uuid' })
            ).toThrow(ZodError);
        });
    });

    describe('categoryId filter', () => {
        it('should accept a valid UUID', () => {
            const id = faker.string.uuid();
            const result = PointOfInterestAdminSearchSchema.parse({ categoryId: id });
            expect(result.categoryId).toBe(id);
        });

        it('should reject an invalid UUID', () => {
            expect(() =>
                PointOfInterestAdminSearchSchema.parse({ categoryId: 'not-a-uuid' })
            ).toThrow(ZodError);
        });
    });

    it('should coerce string page/pageSize to number', () => {
        const result = PointOfInterestAdminSearchSchema.parse({ page: '3', pageSize: '50' });
        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(50);
    });
});
