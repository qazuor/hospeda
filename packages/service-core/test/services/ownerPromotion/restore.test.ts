import type { OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockOwnerPromotion,
    getMockOwnerPromotionId
} from '../../factories/ownerPromotionFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('OwnerPromotionService.restore', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockOwnerPromotionId('mock-id');
    const existing = createMockOwnerPromotion({ id, deletedAt: new Date() });

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel
        });
        actor = createActor({ permissions: [PermissionEnum.OWNER_PROMOTION_RESTORE_ANY] });
        vi.clearAllMocks();
    });

    it('should restore an owner promotion when permissions are valid', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.restore.mockResolvedValue(1);
        const result = await service.restore(actor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });
});
