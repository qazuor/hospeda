import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { PointOfInterestIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    PointOfInterestTypeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const poiId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const actorNoPerms = createActor({ permissions: [] });
const actorWithCreate = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_CREATE] });
const actorWithUpdate = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE] });
const actorWithDelete = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_DELETE] });
const actorWithRestore = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_RESTORE] });

const poi = PointOfInterestFactoryBuilder.create({ id: poiId });

describe('PointOfInterestService', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, [
            'findOne',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'count'
        ]);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne', 'findAll']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    describe('create', () => {
        const createInput = {
            slug: 'playa-banco-pelay',
            lat: -32.4901,
            long: -58.2255,
            type: PointOfInterestTypeEnum.BEACH,
            description: 'A well-known beach in Concepcion del Uruguay',
            isFeatured: false,
            isBuiltin: true,
            displayWeight: 50,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        it('should create a point of interest when actor has POINT_OF_INTEREST_CREATE', async () => {
            asMock(model.create).mockResolvedValue({ ...poi, ...createInput });
            const result = await service.create(actorWithCreate, createInput);
            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toBe('playa-banco-pelay');
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_CREATE', async () => {
            const result = await service.create(actorNoPerms, createInput);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
            expect(model.create).not.toHaveBeenCalled();
        });
    });

    describe('getById', () => {
        it('should return the point of interest for any actor (public view)', async () => {
            asMock(model.findOne).mockResolvedValue(poi);
            const result = await service.getById(actorNoPerms, poiId);
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(poiId);
        });

        it('should return NOT_FOUND when the point of interest does not exist', async () => {
            asMock(model.findOne).mockResolvedValue(null);
            const result = await service.getById(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('update', () => {
        it('should update when actor has POINT_OF_INTEREST_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            asMock(model.update).mockResolvedValue({ ...poi, displayWeight: 80 });
            const result = await service.update(actorWithUpdate, poiId, { displayWeight: 80 });
            expect(result.error).toBeUndefined();
            expect(result.data?.displayWeight).toBe(80);
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            const result = await service.update(actorNoPerms, poiId, { displayWeight: 80 });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete when actor has POINT_OF_INTEREST_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            asMock(model.softDelete).mockResolvedValue(1);
            const result = await service.softDelete(actorWithDelete, poiId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            const result = await service.softDelete(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.softDelete).not.toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore when actor has POINT_OF_INTEREST_RESTORE', async () => {
            const deletedPoi = { ...poi, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedPoi);
            asMock(model.restore).mockResolvedValue(1);
            const result = await service.restore(actorWithRestore, poiId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_RESTORE', async () => {
            const deletedPoi = { ...poi, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedPoi);
            const result = await service.restore(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });
    });

    describe('searchForList', () => {
        it('should return points of interest with destination counts', async () => {
            const poi1 = PointOfInterestFactoryBuilder.create({
                id: getMockId('pointOfInterest', 'poi-a') as PointOfInterestIdType
            });
            const poi2 = PointOfInterestFactoryBuilder.create({
                id: getMockId('pointOfInterest', 'poi-b') as PointOfInterestIdType
            });
            asMock(model.findAll).mockResolvedValue({ items: [poi1, poi2], total: 2 });
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [
                    { destinationId: getMockId('destination', 'd1'), pointOfInterestId: poi1.id },
                    { destinationId: getMockId('destination', 'd2'), pointOfInterestId: poi1.id }
                ]
            });

            const result = await service.searchForList(actorNoPerms, { page: 1, pageSize: 10 });

            expect(result.data).toHaveLength(2);
            expect(result.data[0]?.destinationCount).toBe(2);
            expect(result.data[1]?.destinationCount).toBe(0);
            expect(result.pagination.total).toBe(2);
        });

        it('should return an empty page when there are no results', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            const result = await service.searchForList(actorNoPerms, { page: 1, pageSize: 10 });

            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
        });
    });
});
