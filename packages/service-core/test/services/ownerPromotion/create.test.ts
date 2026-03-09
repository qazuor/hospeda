import type { OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockOwnerPromotion,
    createMockOwnerPromotionCreateInput,
    getMockOwnerPromotionId
} from '../../factories/ownerPromotionFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('OwnerPromotionService.create', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['create']);
        loggerMock = createLoggerMock();
        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel
        });
        actor = createActor({ permissions: [PermissionEnum.OWNER_PROMOTION_CREATE] });
        vi.clearAllMocks();
    });

    it('should create an owner promotion when permissions are valid', async () => {
        const input = createMockOwnerPromotionCreateInput();
        const created = createMockOwnerPromotion({ id: getMockOwnerPromotionId('new-id') });
        modelMock.create.mockResolvedValue(created);
        const result = await service.create(actor, input);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const input = createMockOwnerPromotionCreateInput();
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const input = createMockOwnerPromotionCreateInput();
        modelMock.create.mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        const input = createMockOwnerPromotionCreateInput();
        // @ts-expect-error purposely passing null
        const result = await service.create(null, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
