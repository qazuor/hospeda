import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: softDelete', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
        mockModel.findById.mockResolvedValue(mockEntity);
    });

    it('should soft delete an entity and return count', async () => {
        mockModel.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
    });

    it('should return a count of 0 if no rows were affected', async () => {
        mockModel.softDelete.mockResolvedValue(0);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(0);
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        mockModel.findById.mockResolvedValue(null);
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
        mockModel.softDelete.mockRejectedValue(dbError);
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
        mockModel.findById.mockResolvedValue(alreadyDeletedEntity);
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(0); // or handle as no-op
        expect(mockModel.softDelete).not.toHaveBeenCalled();
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
