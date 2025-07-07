import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the `hardDelete` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of hard delete logic, including:
 * - Successful entity hard deletion
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
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { type TestEntity, TestService } from './base.service.test.setup';

/**
 * Test suite for the `hardDelete` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity hard deletion on valid input and permissions
 * - Validation and error codes for not found, forbidden, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: hardDelete', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('should hard delete an entity and return count', async () => {
        asMock(modelMock.hardDelete).mockResolvedValue(1);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
        expect(asMock(modelMock.hardDelete)).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should handle errors from the _beforeHardDelete lifecycle hook', async () => {
        const hookError = new Error('Error in beforeHardDelete hook');
        vi.spyOn(
            service as unknown as { _beforeHardDelete: () => void },
            '_beforeHardDelete'
        ).mockRejectedValue(hookError);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database fails', async () => {
        const dbError = new Error('DB connection failed');
        asMock(modelMock.hardDelete).mockRejectedValue(dbError);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const nonAdminActor: Actor = {
            id: 'non-admin',
            role: RoleEnum.USER,
            permissions: []
        };
        const result = await service.hardDelete(nonAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should handle errors from the _afterHardDelete hook', async () => {
        const hookError = new Error('Error in afterHardDelete hook');
        vi.spyOn(
            service as unknown as { _afterHardDelete: () => void },
            '_afterHardDelete'
        ).mockRejectedValue(hookError);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
