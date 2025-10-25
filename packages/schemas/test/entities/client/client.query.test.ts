import { describe, expect, it } from 'vitest';
import {
    ClientListOutputSchema,
    ClientSearchOutputSchema,
    ClientSearchSchema,
    ClientSummarySchema
} from '../../../src/entities/client/client.query.schema.js';

describe('Client Query Schemas', () => {
    describe('ClientSearchSchema', () => {
        it('should validate basic client search input', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'name',
                sortOrder: 'asc' as const,
                q: 'test query'
            };

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
                expect(result.data.sortBy).toBe('name');
                expect(result.data.sortOrder).toBe('asc');
                expect(result.data.q).toBe('test query');
            }
        });

        it('should validate client search with filters', () => {
            const searchInput = {
                page: 2,
                pageSize: 20,
                name: 'John Doe Corp',
                billingEmail: 'billing@johndoe.com',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                createdAfter: new Date('2023-01-01'),
                createdBefore: new Date('2023-12-31')
            };

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('John Doe Corp');
                expect(result.data.billingEmail).toBe('billing@johndoe.com');
                expect(result.data.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
                expect(result.data.createdAfter).toEqual(new Date('2023-01-01'));
                expect(result.data.createdBefore).toEqual(new Date('2023-12-31'));
            }
        });

        it('should apply default values correctly', () => {
            const searchInput = {};

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should reject invalid email format', () => {
            const searchInput = {
                billingEmail: 'invalid-email'
            };

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID format', () => {
            const searchInput = {
                userId: 'invalid-uuid'
            };

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(false);
        });

        it('should validate pagination limits', () => {
            const searchInput = {
                page: 0, // Invalid
                pageSize: 101 // Invalid (over max)
            };

            const result = ClientSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(false);
        });

        it('should validate sort order enum', () => {
            const validInput = {
                sortBy: 'name',
                sortOrder: 'desc' as const
            };

            const result = ClientSearchSchema.safeParse(validInput);
            expect(result.success).toBe(true);

            const invalidInput = {
                sortBy: 'name',
                sortOrder: 'invalid' as any
            };

            const invalidResult = ClientSearchSchema.safeParse(invalidInput);
            expect(invalidResult.success).toBe(false);
        });
    });

    describe('ClientSearchOutputSchema', () => {
        it('should validate client search output', () => {
            const searchOutput = {
                data: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        userId: '550e8400-e29b-41d4-a716-446655440000',
                        name: 'Test Client',
                        billingEmail: 'billing@test.com',
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2023-01-01T00:00:00Z'),
                        updatedAt: new Date('2023-01-01T00:00:00Z'),
                        createdById: '550e8400-e29b-41d4-a716-446655440001',
                        updatedById: '550e8400-e29b-41d4-a716-446655440001'
                    }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = ClientSearchOutputSchema.safeParse(searchOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('ClientListOutputSchema', () => {
        it('should validate client list output', () => {
            const listOutput = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        userId: '550e8400-e29b-41d4-a716-446655440000',
                        name: 'Test Client',
                        billingEmail: 'billing@test.com',
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2023-01-01T00:00:00Z'),
                        updatedAt: new Date('2023-01-01T00:00:00Z'),
                        createdById: '550e8400-e29b-41d4-a716-446655440001',
                        updatedById: '550e8400-e29b-41d4-a716-446655440001'
                    }
                ],
                total: 1
            };

            const result = ClientListOutputSchema.safeParse(listOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('ClientSummarySchema', () => {
        it('should validate client summary', () => {
            const summary = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Test Client',
                billingEmail: 'billing@test.com',
                userId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const result = ClientSummarySchema.safeParse(summary);
            expect(result.success).toBe(true);
        });

        it('should validate client summary with null userId', () => {
            const summary = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Test Client',
                billingEmail: 'billing@test.com',
                userId: null
            };

            const result = ClientSummarySchema.safeParse(summary);
            expect(result.success).toBe(true);
        });
    });
});
