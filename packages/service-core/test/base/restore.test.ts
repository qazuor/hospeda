/**
 * @fileoverview
 * Test suite for the `restore` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of restore logic, including:
 * - Successful entity restoration
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { type StandardModelMock, createModelMock } from '../utils/modelMockFactory';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

/**
 * Test suite for the `restore` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity restoration on valid input and permissions
 * - Validation and error codes for not found, forbidden, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: restore', () => {
    let modelMock: StandardModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
        modelMock.findById.mockResolvedValue(mockEntity);
    });

    it('should restore a soft-deleted entity and return count', async () => {
        modelMock.restore.mockResolvedValue(1);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
        expect(modelMock.restore).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should handle errors from the _beforeRestore lifecycle hook', async () => {
        const hookError = new Error('Error in beforeRestore hook');
        vi.spyOn(
            service as unknown as { _beforeRestore: () => void },
            '_beforeRestore'
        ).mockRejectedValue(hookError);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database fails', async () => {
        const dbError = new Error('DB connection failed');
        modelMock.restore.mockRejectedValue(dbError);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const nonAdminActor: Actor = {
            id: 'non-admin',
            role: RoleEnum.USER,
            permissions: []
        };
        const result = await service.restore(nonAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should handle errors from the _afterRestore hook', async () => {
        const hookError = new Error('Error in afterRestore hook');
        vi.spyOn(
            service as unknown as { _afterRestore: () => void },
            '_afterRestore'
        ).mockRejectedValue(hookError);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
