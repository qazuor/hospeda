import type { AmenityModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/amenity/amenity.permissions';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const createViewActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
const createEntity = () => AmenityFactoryBuilder.create({ deletedAt: undefined });

describe('AmenityService.getBySlug', () => {
    let service: AmenityService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createViewActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new AmenityService({ logger: mockLogger }, model as unknown as AmenityModel);
        entity = createEntity();
        actor = createViewActor();
        vi.clearAllMocks();
    });

    it('should return an amenity by slug', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewAmenity').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.data).toBeDefined();
        expect(result.data?.slug).toBe(entity.slug);
        expect(result.error).toBeUndefined();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewAmenity').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewAmenity').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanViewAmenity').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
