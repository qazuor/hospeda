import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the `res    it('should handle errors from the _afterRestore lifecycle hook', async () => {
        const hookError = new Error('fail');
        // biome-ignore lint/suspicious/noExplicitAny: Necessary to mock protected method in test
        vi.spyOn(service as any, '_afterRestore').mockRejectedValue(hookError);` method of BaseService and its derivatives.
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
import type { Actor } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import {
    MOCK_ENTITY_ID,
    mockAdminActor,
    mockDeletedEntity,
    mockEntity
} from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

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
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('should restore a soft-deleted entity and return count', async () => {
        asMock(modelMock.findById).mockResolvedValue(mockDeletedEntity);
        asMock(modelMock.restore).mockResolvedValue(1);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
        expect(asMock(modelMock.restore)).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should handle errors from the _beforeRestore lifecycle hook', async () => {
        const hookError = new Error('fail');
        // biome-ignore lint/suspicious/noExplicitAny: Necessary to mock protected method in test
        vi.spyOn(service as any, '_beforeRestore').mockRejectedValue(hookError);
        asMock(modelMock.findById).mockResolvedValue(mockDeletedEntity);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database fails', async () => {
        const dbError = new Error('fail');
        asMock(modelMock.restore).mockRejectedValue(dbError);
        asMock(modelMock.findById).mockResolvedValue(mockDeletedEntity);
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
        const hookError = new Error('fail');
        // biome-ignore lint/suspicious/noExplicitAny: Necessary to mock protected method in test
        vi.spyOn(service as any, '_afterRestore').mockRejectedValue(hookError);
        asMock(modelMock.findById).mockResolvedValue(mockDeletedEntity);
        asMock(modelMock.restore).mockResolvedValue(1);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
