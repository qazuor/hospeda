import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createViewActor = () =>
    createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
const createEntity = () => createDestination();

describe('DestinationService.getByName', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createViewActor>;
    let entity: ReturnType<typeof createEntity>;

    beforeEach(() => {
        model = createModelMock();
        model.findOne = vi.fn();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        actor = createViewActor();
        entity = createEntity();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return the entity if found and actor has permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(entity.id);
        expect(result.error).toBeUndefined();
        expect(model.findOne).toHaveBeenCalledWith({ name: entity.name });
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getByName(actor, 'nonexistent');
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _beforeGetByField hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(new Error('before error'));
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterGetByField hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(new Error('after error'));
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
