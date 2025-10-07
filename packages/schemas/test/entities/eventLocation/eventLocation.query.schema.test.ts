import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventLocationFiltersSchema,
    EventLocationListInputSchema,
    EventLocationListOutputSchema,
    EventLocationSearchInputSchema,
    EventLocationSearchOutputSchema
} from '../../../src/entities/eventLocation/eventLocation.query.schema.js';
import { createValidEventLocation } from '../../fixtures/eventLocation.fixtures.js';

describe('EventLocation Query Schemas', () => {
    describe('EventLocationFiltersSchema', () => {
        it('should validate empty filters', () => {
            const filters = {};

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();
        });

        it('should validate filters with multiple fields', () => {
            const filters = {
                city: 'New York',
                state: 'NY',
                country: 'USA',
                isActive: true,
                isVerified: true
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();

            const result = EventLocationFiltersSchema.parse(filters);
            expect(result.city).toBe('New York');
            expect(result.state).toBe('NY');
            expect(result.country).toBe('USA');
            expect(result.isActive).toBe(true);
            expect(result.isVerified).toBe(true);
        });

        it('should validate filters with partial fields', () => {
            const filters = {
                city: 'New York',
                name: 'park'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();

            const result = EventLocationFiltersSchema.parse(filters);
            expect(result.city).toBe('New York');
            expect(result.name).toBe('park');
            expect(result.state).toBeUndefined();
            expect(result.country).toBeUndefined();
        });

        it('should allow filters with empty strings (no minimum length validation)', () => {
            const filters = {
                city: '',
                state: 'NY'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();
        });

        it('should reject filters with invalid types', () => {
            const filters = {
                city: 123, // Should be string
                state: 'NY'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).toThrow(ZodError);
        });
    });

    describe('EventLocationSearchInputSchema', () => {
        it('should validate search input without filters', () => {
            const searchInput = {};

            expect(() => EventLocationSearchInputSchema.parse(searchInput)).not.toThrow();
        });

        it('should validate search input with filters', () => {
            const searchInput = {
                city: 'New York',
                name: 'central'
            };

            expect(() => EventLocationSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventLocationSearchInputSchema.parse(searchInput);
            expect(result.city).toBe('New York');
            expect(result.name).toBe('central');
        });

        it('should validate search input with q parameter', () => {
            const searchInput = {
                q: 'search text',
                city: 'New York',
                page: 2,
                pageSize: 20
            };

            expect(() => EventLocationSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventLocationSearchInputSchema.parse(searchInput);
            expect(result.q).toBe('search text');
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(20);
        });
    });

    describe('EventLocationSearchOutputSchema', () => {
        it('should validate search output', () => {
            const eventLocations = [createValidEventLocation(), createValidEventLocation()];
            const searchOutput = {
                data: eventLocations,
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationSearchOutputSchema.parse(searchOutput)).not.toThrow();

            const result = EventLocationSearchOutputSchema.parse(searchOutput);
            expect(result.data).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.pageSize).toBe(10);
            expect(result.pagination.hasNextPage).toBe(false);
            expect(result.pagination.hasPreviousPage).toBe(false);
        });

        it('should reject search output with negative total', () => {
            const searchOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: -1,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationSearchOutputSchema.parse(searchOutput)).toThrow(ZodError);
        });

        it('should reject search output with invalid page', () => {
            const searchOutput = {
                data: [],
                pagination: {
                    page: 0, // Should be >= 1
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationSearchOutputSchema.parse(searchOutput)).toThrow(ZodError);
        });
    });

    describe('EventLocationListInputSchema', () => {
        it('should validate list input with defaults', () => {
            const listInput = {};

            expect(() => EventLocationListInputSchema.parse(listInput)).not.toThrow();

            const result = EventLocationListInputSchema.parse(listInput);
            expect(result.page).toBe(1); // Default value
            expect(result.pageSize).toBe(10); // Default value
        });

        it('should validate list input with custom pagination', () => {
            const listInput = {
                page: 3,
                pageSize: 25,
                city: 'Los Angeles'
            };

            expect(() => EventLocationListInputSchema.parse(listInput)).not.toThrow();

            const result = EventLocationListInputSchema.parse(listInput);
            expect(result.page).toBe(3);
            expect(result.pageSize).toBe(25);
            expect(result.city).toBe('Los Angeles');
        });

        it('should reject list input with invalid page', () => {
            const listInput = {
                page: 0
            };

            expect(() => EventLocationListInputSchema.parse(listInput)).toThrow(ZodError);
        });

        it('should reject list input with pageSize too large', () => {
            const listInput = {
                pageSize: 150 // Max is 100
            };

            expect(() => EventLocationListInputSchema.parse(listInput)).toThrow(ZodError);
        });
    });

    describe('EventLocationListOutputSchema', () => {
        it('should validate list output', () => {
            const eventLocations = [createValidEventLocation()];
            const listOutput = {
                data: eventLocations,
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).not.toThrow();

            const result = EventLocationListOutputSchema.parse(listOutput);
            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('should validate empty list output', () => {
            const listOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).not.toThrow();
        });

        it('should reject list output with negative total', () => {
            const listOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: -5,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).toThrow(ZodError);
        });
    });
});
