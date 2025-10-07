/**
 * Schema Consistency Validation Tests
 *
 * Validates that all schemas follow established patterns and maintain consistency
 * across the @repo/schemas package. This addresses the warning in validate-phase-1.sh.
 */
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

// Import base schemas for validation
import {
    BaseAuditSchema,
    BaseSearchSchema,
    PaginationParamsSchema,
    UuidSchema
} from '../src/common/base.schema.js';

import { BaseHttpSearchSchema, HttpPaginationSchema } from '../src/api/http/base-http.schema.js';

// Import entity schemas for validation
import {
    AccommodationSchema,
    AccommodationSearchSchema
} from '../src/entities/accommodation/index.js';
import { FeatureSchema, FeatureSearchSchema } from '../src/entities/feature/index.js';
import { UserSchema, UserSearchSchema } from '../src/entities/user/index.js';

describe('Schema Consistency Validation', () => {
    describe('Base Schema Patterns', () => {
        test('UuidSchema should be valid UUID format', () => {
            // Valid UUID
            expect(() => UuidSchema.parse('123e4567-e89b-12d3-a456-426614174000')).not.toThrow();

            // Invalid formats should throw
            expect(() => UuidSchema.parse('invalid-uuid')).toThrow();
            expect(() => UuidSchema.parse('')).toThrow();
            expect(() => UuidSchema.parse('123')).toThrow();
        });

        test('BaseAuditSchema should have required timestamp fields', () => {
            const validAudit = {
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            expect(() => BaseAuditSchema.parse(validAudit)).not.toThrow();

            // Missing required fields should throw
            expect(() => BaseAuditSchema.parse({})).toThrow();
            expect(() => BaseAuditSchema.parse({ createdAt: new Date() })).toThrow();
        });

        test('BaseSearchSchema should have pagination and sorting', () => {
            const validSearch = {
                page: 1,
                pageSize: 20,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                q: 'test'
            };

            expect(() => BaseSearchSchema.parse(validSearch)).not.toThrow();
            expect(() => BaseSearchSchema.parse({})).not.toThrow(); // All fields optional with defaults
        });
    });

    describe('HTTP Schema Compatibility', () => {
        test('HTTP schemas should extend base patterns', () => {
            // HttpPaginationSchema should be compatible with PaginationParamsSchema
            const httpPagination = HttpPaginationSchema.parse({ page: '1', pageSize: '20' });
            expect(httpPagination.page).toBe(1);
            expect(httpPagination.pageSize).toBe(20);

            // Should coerce strings to numbers
            expect(() => HttpPaginationSchema.parse({ page: '1', pageSize: '20' })).not.toThrow();
        });

        test('BaseHttpSearchSchema should be compatible with BaseSearchSchema', () => {
            const httpSearch = {
                page: '1',
                pageSize: '20',
                sortBy: 'name',
                sortOrder: 'asc' as const,
                q: 'test'
            };

            const parsed = BaseHttpSearchSchema.parse(httpSearch);
            expect(parsed.page).toBe(1);
            expect(parsed.pageSize).toBe(20);
            expect(parsed.sortBy).toBe('name');
            expect(parsed.sortOrder).toBe('asc');
        });
    });

    describe('Entity Schema Consistency', () => {
        test('all entity schemas should have id field using UuidSchema', () => {
            // Test that core entities follow UUID pattern
            expect(AccommodationSchema.shape.id).toBeDefined();
            expect(UserSchema.shape.id).toBeDefined();
            expect(FeatureSchema.shape.id).toBeDefined();

            // Test that UUIDs are validated correctly
            const validId = '123e4567-e89b-12d3-a456-426614174000';
            expect(() => AccommodationSchema.shape.id.parse(validId)).not.toThrow();
            expect(() => UserSchema.shape.id.parse(validId)).not.toThrow();
            expect(() => FeatureSchema.shape.id.parse(validId)).not.toThrow();
        });

        test('all search schemas should extend BaseSearchSchema', () => {
            // Verify search schemas have base search properties
            const baseSearchKeys = Object.keys(BaseSearchSchema.shape);

            // AccommodationSearchSchema should have all base keys
            const accomSearchKeys = Object.keys(AccommodationSearchSchema.shape);
            // biome-ignore lint/complexity/noForEach: <explanation>
            baseSearchKeys.forEach((key) => {
                expect(accomSearchKeys).toContain(key);
            });

            // UserSearchSchema should have all base keys
            const userSearchKeys = Object.keys(UserSearchSchema.shape);
            // biome-ignore lint/complexity/noForEach: <explanation>
            baseSearchKeys.forEach((key) => {
                expect(userSearchKeys).toContain(key);
            });

            // FeatureSearchSchema should have all base keys
            const featureSearchKeys = Object.keys(FeatureSearchSchema.shape);
            // biome-ignore lint/complexity/noForEach: <explanation>
            baseSearchKeys.forEach((key) => {
                expect(featureSearchKeys).toContain(key);
            });
        });

        test('pagination parameters should be consistent across entities', () => {
            // Test that all search schemas handle pagination consistently
            const paginationTest = { page: 1, pageSize: 20 };

            expect(() => AccommodationSearchSchema.parse(paginationTest)).not.toThrow();
            expect(() => UserSearchSchema.parse(paginationTest)).not.toThrow();
            expect(() => FeatureSearchSchema.parse(paginationTest)).not.toThrow();

            // Test default values
            const emptySearch = {};
            const accomParsed = AccommodationSearchSchema.parse(emptySearch);
            const userParsed = UserSearchSchema.parse(emptySearch);
            const featureParsed = FeatureSearchSchema.parse(emptySearch);

            expect(accomParsed.page).toBe(1);
            expect(userParsed.page).toBe(1);
            expect(featureParsed.page).toBe(1);
        });
    });

    describe('Error Message Standards', () => {
        test('validation errors should use zodError.* pattern', () => {
            try {
                UuidSchema.parse('invalid-uuid');
            } catch (error) {
                if (error instanceof z.ZodError) {
                    // Check that error message follows the zodError.* pattern
                    const issue = error.issues[0];
                    if (issue) {
                        expect(issue.message).toMatch(/zodError\./);
                    }
                }
            }
        });

        test('custom error messages should be internationalization ready', () => {
            // Test that error messages use i18n keys rather than hardcoded text
            try {
                UuidSchema.parse('invalid');
            } catch (error) {
                if (error instanceof z.ZodError && error.issues.length > 0) {
                    const message = error.issues[0]?.message;
                    if (message) {
                        // Should not contain hardcoded English text
                        expect(message).not.toMatch(/^[A-Z][a-z\s]+$/);
                        // Should contain a dot notation key
                        expect(message).toMatch(/\./);
                    }
                }
            }
        });
    });

    describe('Type Export Consistency', () => {
        test('all schemas should export corresponding TypeScript types', () => {
            // Test that types are properly inferred and exported
            type UuidType = z.infer<typeof UuidSchema>;
            type BaseAuditType = z.infer<typeof BaseAuditSchema>;
            type BaseSearchType = z.infer<typeof BaseSearchSchema>;

            // These should compile without errors
            const uuid: UuidType = '123e4567-e89b-12d3-a456-426614174000';
            const audit: BaseAuditType = {
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };
            const search: BaseSearchType = {
                page: 1,
                pageSize: 20,
                sortBy: 'name',
                sortOrder: 'asc'
            };

            expect(uuid).toBeDefined();
            expect(audit).toBeDefined();
            expect(search).toBeDefined();
        });
    });

    describe('OpenAPI Metadata Validation', () => {
        test('schemas should have description metadata', () => {
            // Check that key schemas have OpenAPI descriptions
            const uuidDescription = UuidSchema.description;
            expect(uuidDescription).toBeDefined();
            expect(uuidDescription).toContain('UUID');

            // Check pagination schema descriptions
            expect(PaginationParamsSchema.shape.page.description).toBeDefined();
            expect(PaginationParamsSchema.shape.pageSize.description).toBeDefined();
        });

        test('schema descriptions should be in English', () => {
            const uuidDescription = UuidSchema.description;
            expect(uuidDescription).toBeDefined();

            // Should be in English (basic check)
            expect(uuidDescription).toMatch(/[A-Za-z]/);
            expect(uuidDescription?.length).toBeGreaterThan(10);
        });
    });
});
