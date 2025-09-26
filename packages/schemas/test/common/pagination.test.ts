import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    CursorPaginationParamsSchema,
    CursorPaginationResultSchema,
    PaginationResultSchema
} from '../../src/common/pagination.schema.js';

describe('Pagination Schemas', () => {
    describe('CursorPaginationParamsSchema', () => {
        it('should validate cursor pagination parameters', () => {
            const validInput = {
                cursor: 'eyJpZCI6IjEyMyJ9',
                limit: 25,
                order: 'asc' as const,
                orderBy: 'createdAt'
            };

            expect(() => CursorPaginationParamsSchema.parse(validInput)).not.toThrow();
            const result = CursorPaginationParamsSchema.parse(validInput);
            expect(result.cursor).toBe(validInput.cursor);
            expect(result.limit).toBe(25);
            expect(result.order).toBe('asc');
        });

        it('should allow optional cursor', () => {
            const validInput = {
                limit: 20
            };

            expect(() => CursorPaginationParamsSchema.parse(validInput)).not.toThrow();
        });

        it('should apply default limit', () => {
            const result = CursorPaginationParamsSchema.parse({});
            expect(result.limit).toBe(10);
            expect(result.order).toBe('desc');
        });
    });

    describe('PaginationResultSchema', () => {
        it('should validate pagination result with items', () => {
            const ItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const PaginatedItemsSchema = PaginationResultSchema(ItemSchema);

            const validResult = {
                data: [
                    { id: '1', name: 'Item 1' },
                    { id: '2', name: 'Item 2' }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 150,
                    totalPages: 15,
                    hasNextPage: true,
                    hasPreviousPage: false
                }
            };

            expect(() => PaginatedItemsSchema.parse(validResult)).not.toThrow();
            const result = PaginatedItemsSchema.parse(validResult);
            expect(result.data).toHaveLength(2);
            expect(result.pagination.total).toBe(150);
            expect(result.pagination.hasNextPage).toBe(true);
        });

        it('should accept empty items array', () => {
            const ItemSchema = z.object({ id: z.string() });
            const PaginatedItemsSchema = PaginationResultSchema(ItemSchema);

            const validResult = {
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

            expect(() => PaginatedItemsSchema.parse(validResult)).not.toThrow();
        });

        it('should reject negative total count', () => {
            const ItemSchema = z.object({ id: z.string() });
            const PaginatedItemsSchema = PaginationResultSchema(ItemSchema);

            const invalidResult = {
                data: [],
                pagination: {
                    total: -1, // Should be >= 0
                    limit: 10,
                    offset: 0,
                    hasNextPage: false
                }
            };

            expect(() => PaginatedItemsSchema.parse(invalidResult)).toThrow();
        });
    });

    describe('CursorPaginationResultSchema', () => {
        it('should validate cursor pagination result', () => {
            const ItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const CursorPaginatedItemsSchema = CursorPaginationResultSchema(ItemSchema);

            const validResult = {
                data: [
                    { id: '1', name: 'Item 1' },
                    { id: '2', name: 'Item 2' }
                ],
                pagination: {
                    nextCursor: 'eyJpZCI6IjIifQ==',
                    hasMore: true,
                    limit: 10
                }
            };

            expect(() => CursorPaginatedItemsSchema.parse(validResult)).not.toThrow();
            const result = CursorPaginatedItemsSchema.parse(validResult);
            expect(result.data).toHaveLength(2);
            expect(result.pagination.hasMore).toBe(true);
            expect(result.pagination.nextCursor).toBe(validResult.pagination.nextCursor);
        });

        it('should allow optional nextCursor when hasMore is false', () => {
            const ItemSchema = z.object({ id: z.string() });
            const CursorPaginatedItemsSchema = CursorPaginationResultSchema(ItemSchema);

            const validResult = {
                data: [{ id: '1' }],
                pagination: {
                    hasMore: false,
                    limit: 10
                }
            };

            expect(() => CursorPaginatedItemsSchema.parse(validResult)).not.toThrow();
        });

        it('should validate empty cursor result', () => {
            const ItemSchema = z.object({ id: z.string() });
            const CursorPaginatedItemsSchema = CursorPaginationResultSchema(ItemSchema);

            const validResult = {
                data: [],
                pagination: {
                    hasMore: false,
                    limit: 10
                }
            };

            expect(() => CursorPaginatedItemsSchema.parse(validResult)).not.toThrow();
        });
    });
});
