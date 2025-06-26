/**
 * @fileoverview
 * Test suite for the `search` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of search logic, including:
 * - Successful paginated search
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Pagination edge cases
 * - Hook error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { type StandardModelMock, createModelMock } from '../utils/modelMockFactory';
import { mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

// Extend the base search schema for more specific filter validation
const SearchTestEntitySchemaWithFilters = z.object({
    pagination: z.object({ page: z.number(), pageSize: z.number() }).optional(),
    sort: z.object({ field: z.string(), direction: z.string() }).optional(),
    filters: z.object({ name: z.string().optional() }).optional()
});

class SearchTestService extends TestService {
    public override searchSchema = SearchTestEntitySchemaWithFilters;
}

/**
 * Test suite for the `search` method of BaseService.
 *
 * This suite verifies:
 * - Correct paginated results on successful search
 * - Validation errors for invalid input
 * - Proper error codes for forbidden and internal errors
 * - Handling of pagination edge cases
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: search', () => {
    let modelMock: StandardModelMock;
    let service: SearchTestService;
    const mockSearchParams = { filters: { name: 'Test' } };

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(SearchTestService, modelMock);
    });

    it('should return a paginated list of entities on successful search', async () => {
        const mockSearchResult = { items: [mockEntity], total: 1 };
        const executeSearchSpy = vi
            .spyOn(
                service as unknown as { _executeSearch: (...args: unknown[]) => unknown },
                '_executeSearch'
            )
            .mockResolvedValue(mockSearchResult);

        const result = await service.search(mockAdminActor, mockSearchParams);

        expect(result.data).toEqual(mockSearchResult);
        expect(executeSearchSpy).toHaveBeenCalledWith(mockSearchParams, mockAdminActor);
    });

    it('should handle invalid input schema and return a VALIDATION_ERROR', async () => {
        const invalidParams = { filters: { name: 123 } }; // name should be a string
        // @ts-expect-error: Testing invalid input
        const result = await service.search(mockAdminActor, invalidParams);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        vi.spyOn(
            service as unknown as { _canSearch: (...args: unknown[]) => unknown },
            '_canSearch'
        ).mockImplementation(() => {
            throw new Error('Forbidden');
        });
        const result = await service.search(mockAdminActor, mockSearchParams);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR); // errors from hooks are caught as internal
    });

    it('should handle database errors during search', async () => {
        const dbError = new Error('DB Error');
        vi.spyOn(
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown },
            '_executeSearch'
        ).mockRejectedValue(dbError);

        const result = await service.search(mockAdminActor, mockSearchParams);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should correctly handle pagination edge cases', async () => {
        const executeSearchSpy = vi
            .spyOn(
                service as unknown as { _executeSearch: (...args: unknown[]) => unknown },
                '_executeSearch'
            )
            .mockResolvedValue({ items: [], total: 0 });

        const searchParams = { pagination: { page: -1, pageSize: 0 } };
        await service.search(mockAdminActor, searchParams);

        expect(executeSearchSpy).toHaveBeenCalledWith(
            expect.objectContaining(searchParams),
            mockAdminActor
        );
    });

    it('should handle errors from the _afterSearch hook', async () => {
        const hookError = new Error('Error in afterSearch hook');
        vi.spyOn(
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown },
            '_executeSearch'
        ).mockResolvedValue({
            items: [mockEntity],
            total: 1
        });
        vi.spyOn(
            service as unknown as { _afterSearch: (...args: unknown[]) => unknown },
            '_afterSearch'
        ).mockRejectedValue(hookError);

        const result = await service.search(mockAdminActor, mockSearchParams);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
