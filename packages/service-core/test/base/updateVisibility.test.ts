import { RoleEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: updateVisibility', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
        mockModel.findById.mockResolvedValue(mockEntity);
        mockModel.update.mockResolvedValue({ ...mockEntity, visibility: VisibilityEnum.PRIVATE });
    });

    it('should update entity visibility and return the updated entity', async () => {
        const result = await service.updateVisibility(
            mockAdminActor,
            MOCK_ENTITY_ID,
            VisibilityEnum.PRIVATE
        );
        expect(result.data?.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            expect.objectContaining({ visibility: VisibilityEnum.PRIVATE })
        );
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        mockModel.findById.mockResolvedValue(null);
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
        mockModel.update.mockRejectedValue(new Error('DB Error'));
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
