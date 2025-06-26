/**
 * @fileoverview
 * Test suite for the `updateVisibility` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of updateVisibility logic, including:
 * - Successful entity visibility update
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { RoleEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { type StandardModelMock, createModelMock } from '../utils/modelMockFactory';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

/**
 * Test suite for the `updateVisibility` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity visibility update on valid input and permissions
 * - Validation and error codes for not found, forbidden, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: updateVisibility', () => {
    let modelMock: StandardModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
        modelMock.findById.mockResolvedValue(mockEntity);
        modelMock.update.mockResolvedValue({ ...mockEntity, visibility: VisibilityEnum.PRIVATE });
    });

    it('should update entity visibility and return the updated entity', async () => {
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.data?.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(modelMock.update).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            expect.objectContaining({ visibility: VisibilityEnum.PRIVATE })
        );
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return a forbidden error if actor lacks permission', async () => {
        const nonAdminActor: Actor = { id: 'non-admin', role: RoleEnum.USER, permissions: [] };
        const result = await service.updateVisibility(
            nonAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should return an internal error if database update fails', async () => {
        modelMock.update.mockRejectedValue(new Error('DB Error'));
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _beforeUpdateVisibility hook', async () => {
        vi.spyOn(
            service as unknown as { _beforeUpdateVisibility: () => void },
            '_beforeUpdateVisibility'
        ).mockRejectedValue(new Error('Hook Error'));
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterUpdateVisibility hook', async () => {
        vi.spyOn(
            service as unknown as { _afterUpdateVisibility: () => void },
            '_afterUpdateVisibility'
        ).mockRejectedValue(new Error('Hook Error'));
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
