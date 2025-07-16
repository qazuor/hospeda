import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the `list` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of list logic, including:
 * - Successful paginated entity listing
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockActor, mockEntity } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

/**
 * Test suite for the `list` method of BaseService.
 *
 * This suite verifies:
 * - Correct paginated entity listing on valid input and permissions
 * - Validation and error codes for forbidden and internal errors
 * - Robustness against errors in hooks and database operations
 * - Use of custom normalizers for list logic
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: list', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findAll).mockResolvedValue([mockEntity]);
    });

    it('should return a paginated list of entities on success', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        asMock(modelMock.findAll).mockResolvedValue(mockPaginatedResult);
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
        expect(modelMock.findAll).toHaveBeenCalledWith({}, options);
        expect(afterListSpy).toHaveBeenCalledWith(mockPaginatedResult, mockActor);
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        const forbiddenError = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Cannot list entities');
        (service as unknown as { _canList: () => void })._canList = vi.fn();
        asMock((service as unknown as { _canList: () => void })._canList).mockRejectedValue(
            forbiddenError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(forbiddenError);
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if the database lookup fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        asMock(modelMock.findAll).mockRejectedValue(dbError);

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
        (service as unknown as { _beforeList: () => void })._beforeList = vi.fn();
        asMock((service as unknown as { _beforeList: () => void })._beforeList).mockRejectedValue(
            hookError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if _afterList hook fails', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        asMock(modelMock.findAll).mockResolvedValue(mockPaginatedResult);
        const hookError = new Error('Something went wrong in _afterList');
        (service as unknown as { _afterList: () => void })._afterList = vi.fn();
        asMock((service as unknown as { _afterList: () => void })._afterList).mockRejectedValue(
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
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findAll).mockResolvedValue({ items: [mockEntity], total: 1 });
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                list: normalizer
            };
        }
        const normalizedService = createServiceTestInstance(ServiceWithNormalizer, localModelMock);
        const options = { page: 1, pageSize: 10 };

        // Act
        await normalizedService.list(mockActor, options);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(options, mockActor);
        expect(localModelMock.findAll).toHaveBeenCalledWith({}, { ...options, normalized: true });
    });
});
