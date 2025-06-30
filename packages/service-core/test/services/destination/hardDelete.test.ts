import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createHardDeleteActor = () =>
    createActor({ permissions: [PermissionEnum.DESTINATION_HARD_DELETE] });

const createEntity = () => {
    const id = getMockId('destination');
    return { ...createDestination(), id };
};

describe('DestinationService.hardDelete', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createHardDeleteActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createEntity();
        actor = createHardDeleteActor();
        vi.clearAllMocks();
        (model.findById as Mock).mockResolvedValue(entity);
    });

    it('should hard delete a destination and return count', async () => {
        (model.hardDelete as Mock).mockResolvedValue(1);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(entity.id);
        expect(model.hardDelete).toHaveBeenCalledWith({ id: entity.id });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const noPermsActor = createActor({ permissions: [] });
        const result = await service.hardDelete(noPermsActor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _beforeHardDelete lifecycle hook', async () => {
        const hookError = new Error('Error in beforeHardDelete hook');
        vi.spyOn(
            service as unknown as { _beforeHardDelete: () => void },
            '_beforeHardDelete'
        ).mockRejectedValue(hookError);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model fails', async () => {
        (model.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _afterHardDelete hook', async () => {
        const hookError = new Error('Error in afterHardDelete hook');
        vi.spyOn(
            service as unknown as { _afterHardDelete: () => void },
            '_afterHardDelete'
        ).mockRejectedValue(hookError);
        (model.hardDelete as Mock).mockResolvedValue(1);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
