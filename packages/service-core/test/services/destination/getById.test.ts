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

describe('DestinationService.getById', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createViewActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createEntity();
        actor = createViewActor();
        vi.clearAllMocks();
    });

    it('should return a destination by id', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getById(actor, entity.id);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(entity.id);
        expect(result.error).toBeUndefined();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _beforeGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const hookError = new Error('Error in beforeGetByField hook');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _afterGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const hookError = new Error('Error in afterGetByField hook');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
