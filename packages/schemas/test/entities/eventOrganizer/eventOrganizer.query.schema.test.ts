import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventOrganizerCountInputSchema,
    EventOrganizerCountOutputSchema,
    EventOrganizerFiltersSchema,
    EventOrganizerListInputSchema,
    EventOrganizerListItemSchema,
    EventOrganizerListOutputSchema,
    EventOrganizerSearchInputSchema,
    EventOrganizerSearchOutputSchema,
    EventOrganizerSearchResultSchema
} from '../../../src/entities/eventOrganizer/eventOrganizer.query.schema.js';
import {
    createEventOrganizerListOutput,
    createEventOrganizerSearchOutput,
    createValidEventOrganizerFilters,
    createValidEventOrganizerListInput,
    createValidEventOrganizerSearchInput
} from '../../fixtures/eventOrganizer.fixtures.js';

describe('EventOrganizer Query Schemas', () => {
    describe('EventOrganizerFiltersSchema', () => {
        it('should validate empty filters', () => {
            const emptyFilters = {};

            expect(() => EventOrganizerFiltersSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should validate filters with name', () => {
            const filters = {
                name: faker.company.name()
            };

            expect(() => EventOrganizerFiltersSchema.parse(filters)).not.toThrow();

            const result = EventOrganizerFiltersSchema.parse(filters);
            expect(result.name).toBe(filters.name);
        });

        it('should validate filters with query', () => {
            const filters = {
                q: faker.lorem.words(2)
            };

            expect(() => EventOrganizerFiltersSchema.parse(filters)).not.toThrow();

            const result = EventOrganizerFiltersSchema.parse(filters);
            expect(result.q).toBe(filters.q);
        });

        it('should validate filters with both name and query', () => {
            const filters = createValidEventOrganizerFilters();

            expect(() => EventOrganizerFiltersSchema.parse(filters)).not.toThrow();

            const result = EventOrganizerFiltersSchema.parse(filters);
            expect(result.name).toBeDefined();
            expect(result.q).toBeDefined();
        });

        it('should reject filters with empty name', () => {
            const filters = {
                name: ''
            };

            expect(() => EventOrganizerFiltersSchema.parse(filters)).toThrow(ZodError);
        });

        it('should reject filters with empty query', () => {
            const filters = {
                q: ''
            };

            expect(() => EventOrganizerFiltersSchema.parse(filters)).toThrow(ZodError);
        });

        it('should reject filters with invalid name type', () => {
            const filters = {
                name: 123
            };

            expect(() => EventOrganizerFiltersSchema.parse(filters)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerListInputSchema', () => {
        it('should validate list input with pagination', () => {
            const listInput = {
                page: 1,
                pageSize: 20
            };

            expect(() => EventOrganizerListInputSchema.parse(listInput)).not.toThrow();

            const result = EventOrganizerListInputSchema.parse(listInput);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
        });

        it('should validate list input with filters', () => {
            const listInput = createValidEventOrganizerListInput();

            expect(() => EventOrganizerListInputSchema.parse(listInput)).not.toThrow();

            const result = EventOrganizerListInputSchema.parse(listInput);
            expect(result.page).toBeDefined();
            expect(result.pageSize).toBeDefined();
        });

        it('should validate list input with defaults', () => {
            const listInput = {};

            expect(() => EventOrganizerListInputSchema.parse(listInput)).not.toThrow();

            const result = EventOrganizerListInputSchema.parse(listInput);
            expect(result.page).toBe(1); // Default value
            expect(result.pageSize).toBe(10); // Default value
        });

        it('should reject list input with invalid page', () => {
            const listInput = {
                page: 0
            };

            expect(() => EventOrganizerListInputSchema.parse(listInput)).toThrow(ZodError);
        });

        it('should reject list input with invalid pageSize', () => {
            const listInput = {
                pageSize: 0
            };

            expect(() => EventOrganizerListInputSchema.parse(listInput)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerListItemSchema', () => {
        it('should validate list item with required fields', () => {
            const listItem = {
                id: faker.string.uuid(),
                name: faker.company.name(),
                description: faker.lorem.paragraph(),
                logo: faker.image.url(),
                createdAt: faker.date.past(),
                updatedAt: faker.date.recent(),
                lifecycleState: 'ACTIVE'
            };

            expect(() => EventOrganizerListItemSchema.parse(listItem)).not.toThrow();

            const result = EventOrganizerListItemSchema.parse(listItem);
            expect(result.id).toBe(listItem.id);
            expect(result.name).toBe(listItem.name);
        });

        it('should validate list item with optional fields undefined', () => {
            const listItem = {
                id: faker.string.uuid(),
                name: faker.company.name(),
                description: undefined,
                logo: undefined,
                createdAt: faker.date.past(),
                updatedAt: faker.date.recent(),
                lifecycleState: 'ACTIVE'
            };

            expect(() => EventOrganizerListItemSchema.parse(listItem)).not.toThrow();
        });

        it('should reject list item with missing required fields', () => {
            const listItem = {
                description: faker.lorem.paragraph()
            };

            expect(() => EventOrganizerListItemSchema.parse(listItem)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerListOutputSchema', () => {
        it('should validate list output', () => {
            const listOutput = createEventOrganizerListOutput();

            expect(() => EventOrganizerListOutputSchema.parse(listOutput)).not.toThrow();

            const result = EventOrganizerListOutputSchema.parse(listOutput);
            expect(Array.isArray(result.items)).toBe(true);
            expect(typeof result.total).toBe('number');
            expect(typeof result.page).toBe('number');
            expect(typeof result.pageSize).toBe('number');
            expect(typeof result.totalPages).toBe('number');
        });

        it('should validate empty list output', () => {
            const listOutput = {
                items: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0
            };

            expect(() => EventOrganizerListOutputSchema.parse(listOutput)).not.toThrow();
        });

        it('should reject list output with negative total', () => {
            const listOutput = {
                items: [],
                total: -1,
                page: 1,
                pageSize: 20,
                totalPages: 0
            };

            expect(() => EventOrganizerListOutputSchema.parse(listOutput)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerSearchInputSchema', () => {
        it('should validate search input with pagination and filters', () => {
            const searchInput = createValidEventOrganizerSearchInput();

            expect(() => EventOrganizerSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventOrganizerSearchInputSchema.parse(searchInput);
            expect(result.pagination).toBeDefined();
            expect(result.filters).toBeDefined();
        });

        it('should validate search input with query', () => {
            const searchInput = {
                filters: {
                    q: faker.lorem.words(2)
                },
                pagination: {
                    page: 1,
                    pageSize: 20
                }
            };

            expect(() => EventOrganizerSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventOrganizerSearchInputSchema.parse(searchInput);
            expect(result.filters?.q).toBe(searchInput.filters.q);
        });

        it('should validate search input with defaults', () => {
            const searchInput = {};

            expect(() => EventOrganizerSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = EventOrganizerSearchInputSchema.parse(searchInput);
            // BaseSearchSchema doesn't have defaults, so these would be undefined
            expect(result.pagination).toBeUndefined();
        });

        it('should reject search input with invalid pagination', () => {
            const searchInput = {
                pagination: {
                    page: 0,
                    pageSize: -1
                }
            };

            expect(() => EventOrganizerSearchInputSchema.parse(searchInput)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerSearchResultSchema', () => {
        it('should validate search result', () => {
            const searchResult = {
                id: faker.string.uuid(),
                name: faker.company.name(),
                description: faker.lorem.paragraph(),
                logo: faker.image.url(),
                createdAt: faker.date.past(),
                updatedAt: faker.date.recent(),
                lifecycleState: 'ACTIVE'
            };

            expect(() => EventOrganizerSearchResultSchema.parse(searchResult)).not.toThrow();
        });
    });

    describe('EventOrganizerSearchOutputSchema', () => {
        it('should validate search output', () => {
            const searchOutput = createEventOrganizerSearchOutput();

            expect(() => EventOrganizerSearchOutputSchema.parse(searchOutput)).not.toThrow();

            const result = EventOrganizerSearchOutputSchema.parse(searchOutput);
            expect(Array.isArray(result.items)).toBe(true);
            expect(typeof result.total).toBe('number');
            expect(result.query).toBeDefined();
        });

        it('should validate search output without query', () => {
            const searchOutput = {
                items: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0
            };

            expect(() => EventOrganizerSearchOutputSchema.parse(searchOutput)).not.toThrow();
        });
    });

    describe('EventOrganizerCountInputSchema', () => {
        it('should validate count input with filters', () => {
            const countInput = {
                filters: {
                    name: faker.company.name()
                }
            };

            expect(() => EventOrganizerCountInputSchema.parse(countInput)).not.toThrow();
        });

        it('should validate empty count input', () => {
            const countInput = {};

            expect(() => EventOrganizerCountInputSchema.parse(countInput)).not.toThrow();
        });

        it('should validate count input with undefined filters', () => {
            const countInput = {
                filters: undefined
            };

            expect(() => EventOrganizerCountInputSchema.parse(countInput)).not.toThrow();
        });
    });

    describe('EventOrganizerCountOutputSchema', () => {
        it('should validate count output', () => {
            const countOutput = {
                count: faker.number.int({ min: 0, max: 1000 })
            };

            expect(() => EventOrganizerCountOutputSchema.parse(countOutput)).not.toThrow();

            const result = EventOrganizerCountOutputSchema.parse(countOutput);
            expect(typeof result.count).toBe('number');
            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        it('should validate zero count', () => {
            const countOutput = {
                count: 0
            };

            expect(() => EventOrganizerCountOutputSchema.parse(countOutput)).not.toThrow();
        });

        it('should reject negative count', () => {
            const countOutput = {
                count: -1
            };

            expect(() => EventOrganizerCountOutputSchema.parse(countOutput)).toThrow(ZodError);
        });

        it('should reject non-integer count', () => {
            const countOutput = {
                count: 1.5
            };

            expect(() => EventOrganizerCountOutputSchema.parse(countOutput)).toThrow(ZodError);
        });
    });
});
