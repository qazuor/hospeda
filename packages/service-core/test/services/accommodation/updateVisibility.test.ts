import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('AccommodationService.updateVisibility', () => {
    let model: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        model = createModelMock();
        // Entity and actor are not created here, they are created in each test
        // By default, findById will return undefined/null, tests override as needed
    });

    it('should update visibility if actor has permission', async () => {
        const service = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const entity = createAccommodationWithMockIds();
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] });
        (model.findById as Mock).mockResolvedValue(entity);
        (model.update as Mock).mockResolvedValue({ ...entity, visibility: VisibilityEnum.PRIVATE });
        const result = await service.updateVisibility(actor, entity.id, VisibilityEnum.PRIVATE);
        expect(result.data).toBeDefined();
        expect(result.data?.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        const service = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] });
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.updateVisibility(
            actor,
            'non-existent-id',
            VisibilityEnum.PRIVATE
        );
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const service = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const entity = createAccommodationWithMockIds();
        const actor = createActor({ permissions: [] });
        (model.findById as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.updateVisibility(actor, entity.id, VisibilityEnum.PRIVATE);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR if model.update fails', async () => {
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {});
        const service: AccommodationService = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const entity = createAccommodationWithMockIds();
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] });
        (model.findById as Mock).mockResolvedValue(entity);
        (model.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.updateVisibility(actor, entity.id, VisibilityEnum.PRIVATE);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from _beforeUpdateVisibility hook', async () => {
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {});
        const service: AccommodationService = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const entity = createAccommodationWithMockIds();
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] });
        (model.findById as Mock).mockResolvedValue(entity);
        (service as unknown as { _beforeUpdateVisibility: Mock })._beforeUpdateVisibility = vi
            .fn()
            .mockRejectedValue(new Error('Hook error'));
        const result = await service.updateVisibility(actor, entity.id, VisibilityEnum.PRIVATE);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from _afterUpdateVisibility hook', async () => {
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {});
        const service: AccommodationService = new AccommodationService(
            { logger: createLoggerMock() },
            model as unknown as AccommodationModel
        );
        const entity = createAccommodationWithMockIds();
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] });
        (model.findById as Mock).mockResolvedValue(entity);
        (model.update as Mock).mockResolvedValue({ ...entity, visibility: VisibilityEnum.PRIVATE });
        (service as unknown as { _afterUpdateVisibility: Mock })._afterUpdateVisibility = vi
            .fn()
            .mockRejectedValue(new Error('Hook error'));
        const result = await service.updateVisibility(actor, entity.id, VisibilityEnum.PRIVATE);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
