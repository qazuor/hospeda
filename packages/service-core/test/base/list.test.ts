import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import { mockModel } from '../setupTest';
import { mockActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: list', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('should return a paginated list of entities on success', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        mockModel.findAll.mockResolvedValue(mockPaginatedResult);
        const canListSpy = vi.spyOn(service as unknown as { _canList: () => void }, '_canList');
        const beforeListSpy = vi.spyOn(
            service as unknown as { _beforeList: () => void },
            '_beforeList'
        );
        const afterListSpy = vi.spyOn(
            service as unknown as { _afterList: () => void },
            '_afterList'
        );
        const options = { page: 1, pageSize: 10 };

        // Act
        const result = await service.list(mockActor, options);

        // Assert
        expect(result.data).toEqual(mockPaginatedResult);
        expect(result.error).toBeUndefined();
        expect(canListSpy).toHaveBeenCalledWith(mockActor);
        expect(beforeListSpy).toHaveBeenCalledWith(options, mockActor);
        expect(mockModel.findAll).toHaveBeenCalledWith({}, options);
        expect(afterListSpy).toHaveBeenCalledWith(mockPaginatedResult, mockActor);
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        const forbiddenError = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Cannot list entities');
        vi.spyOn(service as unknown as { _canList: () => void }, '_canList').mockRejectedValue(
            forbiddenError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(forbiddenError);
        expect(mockModel.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if the database lookup fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        mockModel.findAll.mockRejectedValue(dbError);

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe('An unexpected error occurred.');
    });

    it('should return an INTERNAL_ERROR if _beforeList hook fails', async () => {
        // Arrange
        const hookError = new Error('Something went wrong in _beforeList');
        vi.spyOn(
            service as unknown as { _beforeList: () => void },
            '_beforeList'
        ).mockRejectedValue(hookError);

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(mockModel.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if _afterList hook fails', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        mockModel.findAll.mockResolvedValue(mockPaginatedResult);
        const hookError = new Error('Something went wrong in _afterList');
        vi.spyOn(service as unknown as { _afterList: () => void }, '_afterList').mockRejectedValue(
            hookError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the list normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((data) => ({ ...data, normalized: true }));
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                list: normalizer
            };
        }
        const normalizedService = new ServiceWithNormalizer();
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        mockModel.findAll.mockResolvedValue(mockPaginatedResult);
        const options = { page: 1, pageSize: 10 };

        // Act
        await normalizedService.list(mockActor, options);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(options, mockActor);
        expect(mockModel.findAll).toHaveBeenCalledWith({}, { ...options, normalized: true });
    });
});
