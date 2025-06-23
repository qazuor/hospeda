import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: restore', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
        mockModel.findById.mockResolvedValue(mockEntity);
    });

    it('should restore a soft-deleted entity and return count', async () => {
        mockModel.restore.mockResolvedValue(1);
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
        expect(mockModel.restore).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        mockModel.findById.mockResolvedValue(null);
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
        mockModel.restore.mockRejectedValue(dbError);
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
