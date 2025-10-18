/**
 * Tests for pagination utilities
 */

import { describe, expect, it } from 'vitest';
import {
    type PaginationParams,
    calculatePagination,
    extractPaginationParams,
    getPaginationResponse
} from '../../src/utils/pagination';

describe('Pagination Utils', () => {
    describe('calculatePagination', () => {
        it('should calculate basic pagination correctly', () => {
            const params: PaginationParams = {
                page: 1,
                pageSize: 20,
                total: 100
            };

            const result = calculatePagination(params);

            expect(result).toEqual({
                page: 1,
                pageSize: 20,
                total: 100,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: false
            });
        });

        it('should handle last page correctly', () => {
            const params: PaginationParams = {
                page: 5,
                pageSize: 20,
                total: 100
            };

            const result = calculatePagination(params);

            expect(result).toEqual({
                page: 5,
                pageSize: 20,
                total: 100,
                totalPages: 5,
                hasNextPage: false,
                hasPreviousPage: true
            });
        });

        it('should handle middle page correctly', () => {
            const params: PaginationParams = {
                page: 3,
                pageSize: 20,
                total: 100
            };

            const result = calculatePagination(params);

            expect(result).toEqual({
                page: 3,
                pageSize: 20,
                total: 100,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: true
            });
        });

        it('should handle edge case with 0 total', () => {
            const params: PaginationParams = {
                page: 1,
                pageSize: 20,
                total: 0
            };

            const result = calculatePagination(params);

            expect(result).toEqual({
                page: 1,
                pageSize: 20,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false
            });
        });

        it('should handle non-exact division', () => {
            const params: PaginationParams = {
                page: 1,
                pageSize: 20,
                total: 95
            };

            const result = calculatePagination(params);

            expect(result).toEqual({
                page: 1,
                pageSize: 20,
                total: 95,
                totalPages: 5, // Math.ceil(95/20) = 5
                hasNextPage: true,
                hasPreviousPage: false
            });
        });
    });

    describe('extractPaginationParams', () => {
        it('should extract valid page and pageSize', () => {
            const query = { page: '2', pageSize: '50' };
            const result = extractPaginationParams(query);

            expect(result).toEqual({
                page: 2,
                pageSize: 50
            });
        });

        it('should use defaults for missing values', () => {
            const query = {};
            const result = extractPaginationParams(query);

            expect(result).toEqual({
                page: 1,
                pageSize: 20
            });
        });

        it('should use defaults for invalid values', () => {
            const query = { page: 'invalid', pageSize: 'also-invalid' };
            const result = extractPaginationParams(query);

            expect(result).toEqual({
                page: 1,
                pageSize: 20
            });
        });

        it('should handle undefined query', () => {
            const result = extractPaginationParams();

            expect(result).toEqual({
                page: 1,
                pageSize: 20
            });
        });

        it('should convert numeric values correctly', () => {
            const query = { page: 3, pageSize: 25 };
            const result = extractPaginationParams(query);

            expect(result).toEqual({
                page: 3,
                pageSize: 25
            });
        });
    });

    describe('getPaginationResponse', () => {
        it('should combine extraction and calculation', () => {
            const query = { page: '2', pageSize: '10' };
            const total = 45;

            const result = getPaginationResponse(total, query);

            expect(result).toEqual({
                page: 2,
                pageSize: 10,
                total: 45,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: true
            });
        });

        it('should work with defaults', () => {
            const total = 100;

            const result = getPaginationResponse(total);

            expect(result).toEqual({
                page: 1,
                pageSize: 20,
                total: 100,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: false
            });
        });
    });
});
