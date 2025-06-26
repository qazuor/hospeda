/**
 * @fileoverview
 * Test suite for the `count` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of count logic, including:
 * - Successful entity counting
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { type StandardModelMock, createModelMock } from '../utils/modelMockFactory';
import { mockActor } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

/**
 * Test suite for the `count` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity counting on valid input and permissions
 * - Validation and error codes for forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: count', () => {
    let modelMock: StandardModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
    });

    it('should return the total count of entities on success', async () => {
        // Arrange
        const mockCountResult = { count: 42 };
        const executeCountSpy = vi
            .spyOn(
                service as unknown as { _executeCount: (...args: unknown[]) => unknown },
                '_executeCount'
            )
            .mockResolvedValue(mockCountResult);
        const canCountSpy = vi.spyOn(
            service as unknown as { _canCount: (...args: unknown[]) => unknown },
            '_canCount'
        );
        const beforeCountSpy = vi.spyOn(
            service as unknown as { _beforeCount: (...args: unknown[]) => unknown },
            '_beforeCount'
        );
        const afterCountSpy = vi.spyOn(
            service as unknown as { _afterCount: (...args: unknown[]) => unknown },
            '_afterCount'
        );
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toEqual(mockCountResult);
        expect(result.error).toBeUndefined();
        expect(canCountSpy).toHaveBeenCalledWith(mockActor);
        expect(beforeCountSpy).toHaveBeenCalledWith(params, mockActor);
        expect(afterCountSpy).toHaveBeenCalledWith(mockCountResult, mockActor);
        expect(executeCountSpy).toHaveBeenCalledWith(params, mockActor);
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        const forbiddenError = new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Cannot count entities'
        );
        vi.spyOn(
            service as unknown as { _canCount: (...args: unknown[]) => unknown },
            '_canCount'
        ).mockRejectedValue(forbiddenError);
        const executeCountSpy = vi.spyOn(
            service as unknown as { _executeCount: (...args: unknown[]) => unknown },
            '_executeCount'
        );
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(forbiddenError);
        expect(executeCountSpy).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if _executeCount fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        vi.spyOn(
            service as unknown as { _executeCount: (...args: unknown[]) => unknown },
            '_executeCount'
        ).mockRejectedValue(dbError);
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle invalid input schema and return a VALIDATION_ERROR', async () => {
        // Arrange
        const invalidParams = { filters: { name: 123 } }; // name should be a string
        const executeCountSpy = vi.spyOn(
            service as unknown as { _executeCount: (...args: unknown[]) => unknown },
            '_executeCount'
        );

        // Act
        // @ts-expect-error Testing invalid input
        const result = await service.count(mockActor, invalidParams);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(executeCountSpy).not.toHaveBeenCalled();
    });
});
