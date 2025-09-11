import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventLocationCountInputSchema,
    EventLocationCountOutputSchema,
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

        it('should validate filters with all fields', () => {
            const filters = {
                city: 'New York',
                state: 'NY',
                country: 'USA',
                q: 'central park'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();

            const result = EventLocationFiltersSchema.parse(filters);
            expect(result.city).toBe('New York');
            expect(result.state).toBe('NY');
            expect(result.country).toBe('USA');
            expect(result.q).toBe('central park');
        });

        it('should validate filters with partial fields', () => {
            const filters = {
                city: 'New York',
                q: 'park'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).not.toThrow();

            const result = EventLocationFiltersSchema.parse(filters);
            expect(result.city).toBe('New York');
            expect(result.q).toBe('park');
            expect(result.state).toBeUndefined();
            expect(result.country).toBeUndefined();
        });

        it('should reject filters with empty strings', () => {
            const filters = {
                city: '',
                state: 'NY'
            };

            expect(() => EventLocationFiltersSchema.parse(filters)).toThrow(ZodError);
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
                filters: {
                    city: 'New York',
                    q: 'central'
                }
            };

            expect(() => EventLocationSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventLocationSearchInputSchema.parse(searchInput);
            expect(result.filters?.city).toBe('New York');
            expect(result.filters?.q).toBe('central');
        });

        it('should validate search input with pagination and sort', () => {
            const searchInput = {
                filters: {
                    city: 'New York'
                },
                pagination: {
                    page: 2,
                    pageSize: 20
                },
                sort: [
                    {
                        field: 'city',
                        direction: 'ASC' as const
                    }
                ]
            };

            expect(() => EventLocationSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventLocationSearchInputSchema.parse(searchInput);
            expect(result.pagination?.page).toBe(2);
            expect(result.pagination?.pageSize).toBe(20);
            expect(result.sort?.[0]?.field).toBe('city');
            expect(result.sort?.[0]?.direction).toBe('ASC');
        });
    });

    describe('EventLocationSearchOutputSchema', () => {
        it('should validate search output', () => {
            const eventLocations = [createValidEventLocation(), createValidEventLocation()];
            const searchOutput = {
                items: eventLocations,
                total: 2,
                page: 1,
                pageSize: 10,
                hasNextPage: false,
                hasPreviousPage: false
            };

            expect(() => EventLocationSearchOutputSchema.parse(searchOutput)).not.toThrow();

            const result = EventLocationSearchOutputSchema.parse(searchOutput);
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
            expect(result.hasNextPage).toBe(false);
            expect(result.hasPreviousPage).toBe(false);
        });

        it('should reject search output with negative total', () => {
            const searchOutput = {
                items: [],
                total: -1,
                page: 1,
                pageSize: 10,
                hasNextPage: false,
                hasPreviousPage: false
            };

            expect(() => EventLocationSearchOutputSchema.parse(searchOutput)).toThrow(ZodError);
        });

        it('should reject search output with invalid page', () => {
            const searchOutput = {
                items: [],
                total: 0,
                page: 0, // Should be >= 1
                pageSize: 10,
                hasNextPage: false,
                hasPreviousPage: false
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
                filters: {
                    city: 'Los Angeles'
                }
            };

            expect(() => EventLocationListInputSchema.parse(listInput)).not.toThrow();

            const result = EventLocationListInputSchema.parse(listInput);
            expect(result.page).toBe(3);
            expect(result.pageSize).toBe(25);
            expect(result.filters?.city).toBe('Los Angeles');
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
                items: eventLocations,
                total: 1
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).not.toThrow();

            const result = EventLocationListOutputSchema.parse(listOutput);
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should validate empty list output', () => {
            const listOutput = {
                items: [],
                total: 0
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).not.toThrow();
        });

        it('should reject list output with negative total', () => {
            const listOutput = {
                items: [],
                total: -5
            };

            expect(() => EventLocationListOutputSchema.parse(listOutput)).toThrow(ZodError);
        });
    });

    describe('EventLocationCountInputSchema', () => {
        it('should validate count input without filters', () => {
            const countInput = {};

            expect(() => EventLocationCountInputSchema.parse(countInput)).not.toThrow();
        });

        it('should validate count input with filters', () => {
            const countInput = {
                filters: {
                    country: 'USA',
                    q: 'park'
                }
            };

            expect(() => EventLocationCountInputSchema.parse(countInput)).not.toThrow();

            const result = EventLocationCountInputSchema.parse(countInput);
            expect(result.filters?.country).toBe('USA');
            expect(result.filters?.q).toBe('park');
        });
    });

    describe('EventLocationCountOutputSchema', () => {
        it('should validate count output', () => {
            const countOutput = {
                count: 42
            };

            expect(() => EventLocationCountOutputSchema.parse(countOutput)).not.toThrow();

            const result = EventLocationCountOutputSchema.parse(countOutput);
            expect(result.count).toBe(42);
        });

        it('should validate count output with zero', () => {
            const countOutput = {
                count: 0
            };

            expect(() => EventLocationCountOutputSchema.parse(countOutput)).not.toThrow();
        });

        it('should reject count output with negative count', () => {
            const countOutput = {
                count: -1
            };

            expect(() => EventLocationCountOutputSchema.parse(countOutput)).toThrow(ZodError);
        });

        it('should reject count output with non-integer count', () => {
            const countOutput = {
                count: 3.14
            };

            expect(() => EventLocationCountOutputSchema.parse(countOutput)).toThrow(ZodError);
        });
    });
});
