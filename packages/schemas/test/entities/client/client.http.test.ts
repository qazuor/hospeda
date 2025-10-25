import { describe, expect, it } from 'vitest';
import {
    HttpClientSearchSchema,
    httpToDomainClientSearch
} from '../../../src/entities/client/client.http.schema.js';

describe('Client HTTP Schemas', () => {
    describe('HTTP Search Schema', () => {
        it('should validate and coerce HTTP search parameters', () => {
            const httpSearch = {
                page: '1',
                pageSize: '10',
                sortBy: 'name',
                sortOrder: 'asc',
                q: 'test client',
                name: 'Test Client',
                billingEmail: 'billing@test.com',
                userId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const result = HttpClientSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.page).toBe(1); // Coerced to number
                expect(result.data.pageSize).toBe(10); // Coerced to number
            }
        });

        it('should handle missing optional parameters', () => {
            const httpSearch = {
                page: '1',
                pageSize: '20'
            };

            const result = HttpClientSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sortBy).toBeUndefined();
                expect(result.data.sortOrder).toBe('asc'); // Has default value like accommodation
            }
        });

        it('should fail validation for invalid page number', () => {
            const httpSearch = {
                page: '0', // Invalid
                pageSize: '10'
            };

            const result = HttpClientSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid sort order', () => {
            const httpSearch = {
                page: '1',
                pageSize: '10',
                sortOrder: 'invalid' // Must be 'asc' or 'desc'
            };

            const result = HttpClientSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(false);
        });
    });

    describe('HTTP to Domain Conversion', () => {
        it('should convert HTTP search to domain search format', () => {
            const httpSearch = {
                page: 1,
                pageSize: 10,
                sortBy: 'name',
                sortOrder: 'asc' as const,
                q: 'test search',
                name: 'Test Client',
                billingEmail: 'billing@test.com',
                userId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const domainSearch = httpToDomainClientSearch(httpSearch);

            expect(domainSearch.page).toBe(1);
            expect(domainSearch.pageSize).toBe(10);
            expect(domainSearch.sortBy).toBe('name');
            expect(domainSearch.sortOrder).toBe('asc');
            expect(domainSearch.q).toBe('test search');
            // Direct fields like accommodation pattern
            expect(domainSearch.name).toBe('Test Client');
            expect(domainSearch.billingEmail).toBe('billing@test.com');
            expect(domainSearch.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should handle search without filters', () => {
            const httpSearch = {
                page: 1,
                pageSize: 10
            };

            const domainSearch = httpToDomainClientSearch(httpSearch);

            expect(domainSearch.page).toBe(1);
            expect(domainSearch.pageSize).toBe(10);
            expect(domainSearch.name).toBeUndefined();
            expect(domainSearch.billingEmail).toBeUndefined();
        });

        it('should convert field filters directly', () => {
            const httpSearch = {
                page: 1,
                pageSize: 10,
                name: 'Test',
                billingEmail: 'test@example.com',
                q: 'search query'
            };

            const domainSearch = httpToDomainClientSearch(httpSearch);

            expect(domainSearch.name).toBe('Test');
            expect(domainSearch.billingEmail).toBe('test@example.com');
            expect(domainSearch.q).toBe('search query');
        });
    });
});
