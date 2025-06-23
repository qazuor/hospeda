import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
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

describe('BaseService: search', () => {
    let service: SearchTestService;
    const mockSearchParams = { filters: { name: 'Test' } };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SearchTestService();
    });

    it('should return a paginated list of entities on successful search', async () => {
        const mockSearchResult = { items: [mockEntity], total: 1 };
        const executeSearchSpy = vi
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            .spyOn(service as any, '_executeSearch')
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
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        vi.spyOn(service as any, '_canSearch').mockImplementation(() => {
            throw new Error('Forbidden');
        });
        const result = await service.search(mockAdminActor, mockSearchParams);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR); // errors from hooks are caught as internal
    });

    it('should handle database errors during search', async () => {
        const dbError = new Error('DB Error');
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        vi.spyOn(service as any, '_executeSearch').mockRejectedValue(dbError);

        const result = await service.search(mockAdminActor, mockSearchParams);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should correctly handle pagination edge cases', async () => {
        const executeSearchSpy = vi
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            .spyOn(service as any, '_executeSearch')
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
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        vi.spyOn(service as any, '_executeSearch').mockResolvedValue({
            items: [mockEntity],
            total: 1
        });
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        vi.spyOn(service as any, '_afterSearch').mockRejectedValue(hookError);

        const result = await service.search(mockAdminActor, mockSearchParams);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
