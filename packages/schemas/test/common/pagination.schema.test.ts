import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import {
    CursorPaginationParamsSchema,
    CursorPaginationResultSchema,
    PaginationResultSchema
} from '../../src/common/pagination.schema.js';

describe('Pagination Schemas', () => {
    describe('PaginationResultSchema', () => {
        it('should validate valid pagination result', () => {
            const TestItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const TestPaginationSchema = PaginationResultSchema(TestItemSchema);

            const validResult = {
                data: [
                    { id: '1', name: 'Item 1' },
                    { id: '2', name: 'Item 2' }
                ],
                pagination: {
                    page: 3,
                    pageSize: 10,
                    total: 100,
                    totalPages: 10,
                    hasNextPage: true,
                    hasPreviousPage: true
                }
            };

            expect(() => TestPaginationSchema.parse(validResult)).not.toThrow();
            const result = TestPaginationSchema.parse(validResult);
            expect(result.data).toHaveLength(2);
            expect(result.pagination.total).toBe(100);
            expect(result.pagination.hasNextPage).toBe(true);
        });

        it('should validate empty results', () => {
            const TestItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const TestPaginationSchema = PaginationResultSchema(TestItemSchema);

            const emptyResult = {
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

            expect(() => TestPaginationSchema.parse(emptyResult)).not.toThrow();
            const result = TestPaginationSchema.parse(emptyResult);
            expect(result.data).toHaveLength(0);
            expect(result.pagination.hasNextPage).toBe(false);
        });

        it('should enforce pagination field constraints', () => {
            const TestItemSchema = z.object({ id: z.string() });
            const TestPaginationSchema = PaginationResultSchema(TestItemSchema);

            // Negative total
            const invalidResult1 = {
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
            expect(() => TestPaginationSchema.parse(invalidResult1)).toThrow(ZodError);

            // Zero pageSize (should be positive)
            const invalidResult2 = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 0,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            expect(() => TestPaginationSchema.parse(invalidResult2)).toThrow(ZodError);

            // Zero page (should be positive)
            const invalidResult3 = {
                data: [],
                pagination: {
                    page: 0,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            expect(() => TestPaginationSchema.parse(invalidResult3)).toThrow(ZodError);
        });

        it('should validate item schema consistency', () => {
            const TestItemSchema = z.object({
                id: z.string().uuid(),
                count: z.number().min(0)
            });
            const TestPaginationSchema = PaginationResultSchema(TestItemSchema);
            const validResult = {
                data: [{ id: '550e8400-e29b-41d4-a716-446655440000', count: 5 }],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            const invalidResult = {
                data: [{ id: 'invalid-uuid', count: -1 }],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            expect(() => TestPaginationSchema.parse(validResult)).not.toThrow();
            expect(() => TestPaginationSchema.parse(invalidResult)).toThrow(ZodError);
        });
    });

    describe('CursorPaginationParamsSchema', () => {
        it('should validate with default values', () => {
            const result = CursorPaginationParamsSchema.parse({});

            expect(result.limit).toBe(10);
            expect(result.cursor).toBeUndefined();
            expect(result.order).toBe('desc');
        });

        it('should validate with all custom parameters', () => {
            const params = {
                limit: 25,
                cursor: 'eyJpZCI6IjEyMyJ9', // Base64 encoded cursor
                order: 'asc' as const,
                orderBy: 'createdAt'
            };

            expect(() => CursorPaginationParamsSchema.parse(params)).not.toThrow();
            const result = CursorPaginationParamsSchema.parse(params);
            expect(result.limit).toBe(25);
            expect(result.cursor).toBe('eyJpZCI6IjEyMyJ9');
            expect(result.order).toBe('asc');
            expect(result.orderBy).toBe('createdAt');
        });

        it('should enforce same limit boundaries as regular pagination', () => {
            expect(() => CursorPaginationParamsSchema.parse({ limit: 0 })).toThrow(ZodError);
            expect(() => CursorPaginationParamsSchema.parse({ limit: 101 })).toThrow(ZodError);
            expect(() => CursorPaginationParamsSchema.parse({ limit: 1 })).not.toThrow();
            expect(() => CursorPaginationParamsSchema.parse({ limit: 100 })).not.toThrow();
        });

        it('should validate order enum values', () => {
            expect(() => CursorPaginationParamsSchema.parse({ order: 'asc' })).not.toThrow();
            expect(() => CursorPaginationParamsSchema.parse({ order: 'desc' })).not.toThrow();
            expect(() => CursorPaginationParamsSchema.parse({ order: 'invalid' })).toThrow(
                ZodError
            );
        });
    });

    describe('CursorPaginationResultSchema', () => {
        it('should validate valid cursor pagination result', () => {
            const TestItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const TestCursorPaginationSchema = CursorPaginationResultSchema(TestItemSchema);

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

            expect(() => TestCursorPaginationSchema.parse(validResult)).not.toThrow();
            const result = TestCursorPaginationSchema.parse(validResult);
            expect(result.data).toHaveLength(2);
            expect(result.pagination.nextCursor).toBe('eyJpZCI6IjIifQ==');
            expect(result.pagination.hasMore).toBe(true);
            expect(result.pagination.limit).toBe(10);
        });

        it('should validate last page (no next cursor)', () => {
            const TestItemSchema = z.object({
                id: z.string(),
                name: z.string()
            });

            const TestCursorPaginationSchema = CursorPaginationResultSchema(TestItemSchema);

            const lastPageResult = {
                data: [{ id: '10', name: 'Last Item' }],
                pagination: {
                    nextCursor: undefined,
                    hasMore: false,
                    limit: 10
                }
            };

            expect(() => TestCursorPaginationSchema.parse(lastPageResult)).not.toThrow();
            const result = TestCursorPaginationSchema.parse(lastPageResult);
            expect(result.pagination.nextCursor).toBeUndefined();
            expect(result.pagination.hasMore).toBe(false);
        });

        it('should validate empty cursor results', () => {
            const TestItemSchema = z.object({
                id: z.string()
            });

            const TestCursorPaginationSchema = CursorPaginationResultSchema(TestItemSchema);

            const emptyResult = {
                data: [],
                pagination: {
                    hasMore: false,
                    limit: 10
                }
            };

            expect(() => TestCursorPaginationSchema.parse(emptyResult)).not.toThrow();
            const result = TestCursorPaginationSchema.parse(emptyResult);
            expect(result.data).toHaveLength(0);
            expect(result.pagination.hasMore).toBe(false);
        });

        it('should accept any valid integer limit', () => {
            const TestItemSchema = z.object({ id: z.string() });
            const TestCursorPaginationSchema = CursorPaginationResultSchema(TestItemSchema);

            const validResult = {
                data: [],
                pagination: {
                    hasMore: false,
                    limit: 0 // Any integer is valid
                }
            };

            expect(() => TestCursorPaginationSchema.parse(validResult)).not.toThrow();

            const anotherValidResult = {
                data: [],
                pagination: {
                    hasMore: false,
                    limit: 100
                }
            };

            expect(() => TestCursorPaginationSchema.parse(anotherValidResult)).not.toThrow();
        });
    });
});
