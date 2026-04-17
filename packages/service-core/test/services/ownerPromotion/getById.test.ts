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

describe('OwnerPromotionService.getById', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockOwnerPromotionId('mock-id');
    const existing = { ...createMockOwnerPromotion({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['findOne', 'findOneWithRelations']);
        loggerMock = createLoggerMock();
        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel
        });
        actor = createActor({ permissions: [PermissionEnum.OWNER_PROMOTION_VIEW_ANY] });
        vi.clearAllMocks();
    });

    it('should get an owner promotion by id when permissions are valid', async () => {
        modelMock.findOneWithRelations.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.title).toEqual(existing.title);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOneWithRelations).toHaveBeenCalledWith(
            { id },
            { owner: true, accommodation: true },
            undefined
        );
        expect(modelMock.findOne).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findOneWithRelations.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findOneWithRelations.mockResolvedValue(null);
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findOneWithRelations.mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
