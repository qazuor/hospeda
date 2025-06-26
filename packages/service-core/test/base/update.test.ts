/**
 * @fileoverview
 * Test suite for the `update` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of update logic, including:
 * - Successful entity update
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
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
 * Test suite for the `update` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity update on valid input and permissions
 * - Validation and error codes for not found, forbidden, and internal errors
 * - Handling of empty payloads and edge cases
 * - Robustness against errors in hooks and database operations
 * - Use of custom normalizers for update data
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: update', () => {
    let modelMock: StandardModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
        modelMock.findById.mockResolvedValue(mockEntity);
    });

    it('should update an entity if actor has permission', async () => {
        modelMock.update.mockResolvedValue({ ...mockEntity, name: 'Updated Name' });
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.data?.name).toBe('Updated Name');
    });

    it('should return a "not found" error if the entity to update does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should handle errors from the _beforeUpdate lifecycle hook', async () => {
        const hookError = new Error('Error in beforeUpdate hook');
        vi.spyOn(
            service as unknown as { _beforeUpdate: () => void },
            '_beforeUpdate'
        ).mockRejectedValue(hookError);
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database returns null after update', async () => {
        modelMock.update.mockResolvedValue(null);
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database update fails', async () => {
        const dbError = new Error('DB connection failed');
        modelMock.update.mockRejectedValue(dbError);
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return forbidden error if actor is not owner or admin', async () => {
        const nonOwnerActor: Actor = {
            id: 'non-owner',
            role: RoleEnum.USER,
            permissions: []
        };
        const result = await service.update(nonOwnerActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should handle empty payload without error', async () => {
        await service.update(mockAdminActor, MOCK_ENTITY_ID, {});
        expect(modelMock.update).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            expect.objectContaining({ updatedById: mockAdminActor.id })
        );
    });

    it('should handle errors from the _afterUpdate hook', async () => {
        const hookError = new Error('Error in afterUpdate hook');
        vi.spyOn(
            service as unknown as { _afterUpdate: () => void },
            '_afterUpdate'
        ).mockRejectedValue(hookError);

        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, { name: 'new name' });

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the update normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((data) => ({ ...data, normalized: true }));
        const localModelMock: StandardModelMock = createModelMock();
        localModelMock.findById.mockResolvedValue(mockEntity);
        localModelMock.update.mockResolvedValue({
            ...mockEntity,
            name: 'Updated Name',
            normalized: true
        });
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                update: normalizer
            };
        }
        const normalizedService = createServiceTestInstance(ServiceWithNormalizer, localModelMock);
        const updateData = { name: 'Updated Name' };

        // Act
        await normalizedService.update(mockAdminActor, MOCK_ENTITY_ID, updateData);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(updateData, mockAdminActor);
        expect(localModelMock.update).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            expect.objectContaining({ normalized: true })
        );
    });
});
