import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    BreadcrumbItemSchema,
    BreadcrumbResponseSchema,
    GetDestinationAncestorsInputSchema,
    GetDestinationBreadcrumbInputSchema,
    GetDestinationByPathInputSchema,
    GetDestinationChildrenInputSchema,
    GetDestinationDescendantsInputSchema
} from '../../../src/entities/destination/destination.hierarchy.schema.js';

describe('Destination Hierarchy Schemas', () => {
    describe('GetDestinationChildrenInputSchema', () => {
        it('should validate valid destinationId', () => {
            const input = { destinationId: faker.string.uuid() };
            expect(() => GetDestinationChildrenInputSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const input = { destinationId: 'not-a-uuid' };
            expect(() => GetDestinationChildrenInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject missing destinationId', () => {
            expect(() => GetDestinationChildrenInputSchema.parse({})).toThrow(ZodError);
        });
    });

    describe('GetDestinationDescendantsInputSchema', () => {
        it('should validate with only destinationId', () => {
            const input = { destinationId: faker.string.uuid() };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).not.toThrow();
        });

        it('should validate with maxDepth', () => {
            const input = { destinationId: faker.string.uuid(), maxDepth: 3 };
            const result = GetDestinationDescendantsInputSchema.parse(input);
            expect(result.maxDepth).toBe(3);
        });

        it('should validate with destinationType filter', () => {
            const input = { destinationId: faker.string.uuid(), destinationType: 'CITY' };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).not.toThrow();
        });

        it('should validate with all optional fields', () => {
            const input = {
                destinationId: faker.string.uuid(),
                maxDepth: 5,
                destinationType: 'PROVINCE'
            };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).not.toThrow();
        });

        it('should reject maxDepth below 1', () => {
            const input = { destinationId: faker.string.uuid(), maxDepth: 0 };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject maxDepth above 10', () => {
            const input = { destinationId: faker.string.uuid(), maxDepth: 11 };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid destinationType', () => {
            const input = { destinationId: faker.string.uuid(), destinationType: 'INVALID' };
            expect(() => GetDestinationDescendantsInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('GetDestinationAncestorsInputSchema', () => {
        it('should validate valid destinationId', () => {
            const input = { destinationId: faker.string.uuid() };
            expect(() => GetDestinationAncestorsInputSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const input = { destinationId: 'invalid' };
            expect(() => GetDestinationAncestorsInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject missing destinationId', () => {
            expect(() => GetDestinationAncestorsInputSchema.parse({})).toThrow(ZodError);
        });
    });

    describe('GetDestinationByPathInputSchema', () => {
        it('should validate valid path', () => {
            const input = { path: '/argentina/entre-rios/concepcion-del-uruguay' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).not.toThrow();
        });

        it('should validate simple path', () => {
            const input = { path: '/argentina' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).not.toThrow();
        });

        it('should reject path without leading slash', () => {
            const input = { path: 'argentina/entre-rios' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject path with uppercase', () => {
            const input = { path: '/Argentina' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject path with spaces', () => {
            const input = { path: '/argentina/entre rios' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject empty path', () => {
            const input = { path: '' };
            expect(() => GetDestinationByPathInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject missing path', () => {
            expect(() => GetDestinationByPathInputSchema.parse({})).toThrow(ZodError);
        });
    });

    describe('GetDestinationBreadcrumbInputSchema', () => {
        it('should validate valid destinationId', () => {
            const input = { destinationId: faker.string.uuid() };
            expect(() => GetDestinationBreadcrumbInputSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const input = { destinationId: 'bad-uuid' };
            expect(() => GetDestinationBreadcrumbInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('BreadcrumbItemSchema', () => {
        it('should validate a valid breadcrumb item', () => {
            const item = {
                id: faker.string.uuid(),
                slug: 'argentina',
                name: 'Argentina',
                level: 0,
                destinationType: 'COUNTRY',
                path: '/argentina'
            };
            expect(() => BreadcrumbItemSchema.parse(item)).not.toThrow();
        });

        it('should reject invalid level', () => {
            const item = {
                id: faker.string.uuid(),
                slug: 'test',
                name: 'Test',
                level: 7,
                destinationType: 'CITY',
                path: '/test'
            };
            expect(() => BreadcrumbItemSchema.parse(item)).toThrow(ZodError);
        });

        it('should reject invalid destinationType', () => {
            const item = {
                id: faker.string.uuid(),
                slug: 'test',
                name: 'Test',
                level: 0,
                destinationType: 'INVALID',
                path: '/test'
            };
            expect(() => BreadcrumbItemSchema.parse(item)).toThrow(ZodError);
        });

        it('should reject missing required fields', () => {
            const item = {
                id: faker.string.uuid(),
                name: 'Test'
            };
            expect(() => BreadcrumbItemSchema.parse(item)).toThrow(ZodError);
        });
    });

    describe('BreadcrumbResponseSchema', () => {
        it('should validate a valid breadcrumb array', () => {
            const breadcrumbs = [
                {
                    id: faker.string.uuid(),
                    slug: 'argentina',
                    name: 'Argentina',
                    level: 0,
                    destinationType: 'COUNTRY',
                    path: '/argentina'
                },
                {
                    id: faker.string.uuid(),
                    slug: 'entre-rios',
                    name: 'Entre Rios',
                    level: 2,
                    destinationType: 'PROVINCE',
                    path: '/argentina/entre-rios'
                },
                {
                    id: faker.string.uuid(),
                    slug: 'concepcion-del-uruguay',
                    name: 'Concepcion del Uruguay',
                    level: 4,
                    destinationType: 'CITY',
                    path: '/argentina/entre-rios/concepcion-del-uruguay'
                }
            ];
            expect(() => BreadcrumbResponseSchema.parse(breadcrumbs)).not.toThrow();
        });

        it('should validate empty breadcrumb array', () => {
            expect(() => BreadcrumbResponseSchema.parse([])).not.toThrow();
        });

        it('should reject invalid items in the array', () => {
            const breadcrumbs = [{ invalid: true }];
            expect(() => BreadcrumbResponseSchema.parse(breadcrumbs)).toThrow(ZodError);
        });
    });
});
