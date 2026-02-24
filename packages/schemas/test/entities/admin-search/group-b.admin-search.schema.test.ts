import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AmenityAdminSearchSchema,
    AttractionAdminSearchSchema,
    FeatureAdminSearchSchema,
    TagAdminSearchSchema
} from '../../../src/index.js';

describe('Group B Admin Search Schemas', () => {
    describe('AmenityAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = AmenityAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.status).toBe('all');
            expect(result.category).toBeUndefined();
        });

        it('should accept amenity-specific filters', () => {
            const result = AmenityAdminSearchSchema.parse({
                category: 'connectivity',
                isBuiltin: true,
                search: 'wifi'
            });
            expect(result.category).toBe('connectivity');
            expect(result.isBuiltin).toBe(true);
            expect(result.search).toBe('wifi');
        });
    });

    describe('FeatureAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = FeatureAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.category).toBeUndefined();
        });

        it('should accept feature-specific filters', () => {
            const result = FeatureAdminSearchSchema.parse({
                category: 'outdoor',
                isBuiltin: false
            });
            expect(result.category).toBe('outdoor');
            expect(result.isBuiltin).toBe(false);
        });
    });

    describe('AttractionAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = AttractionAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.destinationId).toBeUndefined();
        });

        it('should accept attraction-specific filters', () => {
            const result = AttractionAdminSearchSchema.parse({
                destinationId: '550e8400-e29b-41d4-a716-446655440000',
                category: 'museum',
                isFeatured: true
            });
            expect(result.destinationId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.category).toBe('museum');
            expect(result.isFeatured).toBe(true);
        });

        it('should reject invalid UUID', () => {
            expect(() => AttractionAdminSearchSchema.parse({ destinationId: 'invalid' })).toThrow(
                ZodError
            );
        });
    });

    describe('TagAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = TagAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.color).toBeUndefined();
            expect(result.nameContains).toBeUndefined();
        });

        it('should accept tag-specific filters', () => {
            const result = TagAdminSearchSchema.parse({
                color: '#FF5733',
                nameContains: 'beach'
            });
            expect(result.color).toBe('#FF5733');
            expect(result.nameContains).toBe('beach');
        });

        it('should reject invalid color format', () => {
            expect(() => TagAdminSearchSchema.parse({ color: 'red' })).toThrow(ZodError);
            expect(() => TagAdminSearchSchema.parse({ color: '#GGG' })).toThrow(ZodError);
        });

        it('should reject nameContains exceeding max length', () => {
            expect(() => TagAdminSearchSchema.parse({ nameContains: 'a'.repeat(51) })).toThrow(
                ZodError
            );
        });
    });
});
