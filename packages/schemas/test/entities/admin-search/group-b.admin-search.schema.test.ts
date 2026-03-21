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
            expect(result.type).toBeUndefined();
        });

        it('should accept amenity-specific filters', () => {
            const result = AmenityAdminSearchSchema.parse({
                type: 'CONNECTIVITY',
                isBuiltin: true,
                search: 'wifi'
            });
            expect(result.type).toBe('CONNECTIVITY');
            expect(result.isBuiltin).toBe(true);
            expect(result.search).toBe('wifi');
        });

        it('should reject invalid amenity type', () => {
            expect(() => AmenityAdminSearchSchema.parse({ type: 'INVALID_TYPE' })).toThrow(
                ZodError
            );
        });
    });

    describe('FeatureAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = FeatureAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
        });

        it('should accept feature-specific filters', () => {
            const result = FeatureAdminSearchSchema.parse({
                isBuiltin: false,
                search: 'pool'
            });
            expect(result.isBuiltin).toBe(false);
            expect(result.search).toBe('pool');
        });

        it('should strip unknown fields like category', () => {
            const result = FeatureAdminSearchSchema.parse({ category: 'outdoor' });
            expect('category' in result).toBe(false);
        });
    });

    describe('AttractionAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = AttractionAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
        });

        it('should accept attraction-specific filters', () => {
            const result = AttractionAdminSearchSchema.parse({
                isFeatured: true,
                search: 'museo'
            });
            expect(result.isFeatured).toBe(true);
            expect(result.search).toBe('museo');
        });

        it('should strip unknown fields like destinationId and category', () => {
            const result = AttractionAdminSearchSchema.parse({
                destinationId: '550e8400-e29b-41d4-a716-446655440000',
                category: 'museum'
            });
            expect('destinationId' in result).toBe(false);
            expect('category' in result).toBe(false);
        });
    });

    describe('TagAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = TagAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.color).toBeUndefined();
        });

        it('should accept tag-specific filters with enum color', () => {
            const result = TagAdminSearchSchema.parse({
                color: 'RED',
                search: 'beach'
            });
            expect(result.color).toBe('RED');
            expect(result.search).toBe('beach');
        });

        it('should reject invalid color enum value', () => {
            expect(() => TagAdminSearchSchema.parse({ color: 'INVALID' })).toThrow(ZodError);
        });

        it('should reject hex color format (no longer supported)', () => {
            expect(() => TagAdminSearchSchema.parse({ color: '#FF5733' })).toThrow(ZodError);
        });

        it('should not include nameContains (use search instead)', () => {
            const result = TagAdminSearchSchema.parse({ nameContains: 'beach' });
            expect('nameContains' in result).toBe(false);
        });
    });
});
