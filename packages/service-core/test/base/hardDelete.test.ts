import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: hardDelete', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
        mockModel.findById.mockResolvedValue(mockEntity);
    });

    it('should hard delete an entity and return count', async () => {
        mockModel.hardDelete.mockResolvedValue(1);
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);
        expect(result.data?.count).toBe(1);
        expect(mockModel.hardDelete).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        mockModel.findById.mockResolvedValue(null);
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
        mockModel.hardDelete.mockRejectedValue(dbError);
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
