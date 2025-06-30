import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createViewActor = () => createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

describe('AccommodationService.getByName', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createViewActor>;
    let entity: ReturnType<typeof createEntity>;

    beforeEach(() => {
        model = createModelMock();
        model.findOne = vi.fn();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        actor = createViewActor();
        entity = createEntity();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return the entity if found and actor has permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(entity.id);
        expect(result.error).toBeUndefined();
        expect(model.findOne).toHaveBeenCalledWith({ name: entity.name });
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        const result = await service.getByName(actor, 'nonexistent');
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getByName(actor, entity.name);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
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
