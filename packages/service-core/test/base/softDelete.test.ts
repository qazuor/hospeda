/**
 * @fileoverview
 * Test suite for the `softDelete` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of soft delete logic, including:
 * - Successful entity soft deletion
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Handling of already deleted entities
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
 * Test suite for the `softDelete` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity soft deletion on valid input and permissions
 * - Validation and error codes for not found, forbidden, and internal errors
 * - Handling of already deleted entities and edge cases
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: softDelete', () => {
    let modelMock: StandardModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
        modelMock.findById.mockResolvedValue(mockEntity);
    });

    it('should soft delete an entity and return count', async () => {
        modelMock.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
    });

    it('should return a count of 0 if no rows were affected', async () => {
        modelMock.softDelete.mockResolvedValue(0);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(0);
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should handle errors from the _beforeSoftDelete lifecycle hook', async () => {
        const hookError = new Error('Error in beforeSoftDelete hook');
        vi.spyOn(
            service as unknown as { _beforeSoftDelete: () => void },
            '_beforeSoftDelete'
        ).mockRejectedValue(hookError);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database fails', async () => {
        const dbError = new Error('DB connection failed');
        modelMock.softDelete.mockRejectedValue(dbError);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const nonOwnerActor: Actor = {
            id: 'non-owner',
            role: RoleEnum.USER,
            permissions: []
        };
        const result = await service.softDelete(nonOwnerActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should handle deleting an already deleted entity gracefully', async () => {
        const alreadyDeletedEntity = { ...mockEntity, deletedAt: new Date() };
        modelMock.findById.mockResolvedValue(alreadyDeletedEntity);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(0); // or handle as no-op
        expect(modelMock.softDelete).not.toHaveBeenCalled();
    });

    it('should handle errors from the _afterSoftDelete hook', async () => {
        const hookError = new Error('Error in afterSoftDelete hook');
        vi.spyOn(
            service as unknown as { _afterSoftDelete: () => void },
            '_afterSoftDelete'
        ).mockRejectedValue(hookError);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
