import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: update', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
        mockModel.findById.mockResolvedValue(mockEntity);
    });

    it('should update an entity if actor has permission', async () => {
        mockModel.update.mockResolvedValue({ ...mockEntity, name: 'Updated Name' });
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.data?.name).toBe('Updated Name');
    });

    it('should return a "not found" error if the entity to update does not exist', async () => {
        mockModel.findById.mockResolvedValue(null);
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
        mockModel.update.mockResolvedValue(null);
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, {
            name: 'Updated Name'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database update fails', async () => {
        const dbError = new Error('DB connection failed');
        mockModel.update.mockRejectedValue(dbError);
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
        expect(mockModel.update).toHaveBeenCalledWith(
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
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                update: normalizer
            };
        }
        const normalizedService = new ServiceWithNormalizer();
        const updateData = { name: 'Updated Name' };

        // Act
        await normalizedService.update(mockAdminActor, MOCK_ENTITY_ID, updateData);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(updateData, mockAdminActor);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            expect.objectContaining({ normalized: true })
        );
    });
});
