import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
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

describe('DestinationService.getBySlug', () => {
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

    it('should return a destination by slug', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        // Service now hydrates the attractions + pointsOfInterest relations
        // after the base lookup — mock both batch loaders so the overrides
        // don't blow up.
        (model as unknown as { getAttractionsMap: Mock }).getAttractionsMap = vi
            .fn()
            .mockResolvedValue(new Map());
        (model as unknown as { getPointsOfInterestMap: Mock }).getPointsOfInterestMap = vi
            .fn()
            .mockResolvedValue(new Map());
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.data).toBeDefined();
        expect(result.data?.slug).toBe(entity.slug);
        expect(result.error).toBeUndefined();
    });

    it('should hydrate the attractions relation after the base lookup', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        const mockAttractions = [
            { id: 'a-1', name: 'Plaza', icon: null, displayWeight: 90 },
            { id: 'a-2', name: 'Museo', icon: null, displayWeight: 80 }
        ];
        (model as unknown as { getAttractionsMap: Mock }).getAttractionsMap = vi
            .fn()
            .mockResolvedValue(new Map([[entity.id, mockAttractions]]));
        (model as unknown as { getPointsOfInterestMap: Mock }).getPointsOfInterestMap = vi
            .fn()
            .mockResolvedValue(new Map());
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.data).toBeDefined();
        expect(
            (result.data as unknown as { attractions: ReadonlyArray<{ name: string }> }).attractions
        ).toEqual(mockAttractions);
    });

    it('should hydrate the pointsOfInterest relation after the base lookup (HOS-113 T-046)', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        const mockPois = [
            {
                id: 'poi-1',
                slug: 'autodromo',
                lat: -32.48,
                long: -58.24,
                type: 'STADIUM',
                icon: null,
                displayWeight: 80
            }
        ];
        (model as unknown as { getAttractionsMap: Mock }).getAttractionsMap = vi
            .fn()
            .mockResolvedValue(new Map());
        (model as unknown as { getPointsOfInterestMap: Mock }).getPointsOfInterestMap = vi
            .fn()
            .mockResolvedValue(new Map([[entity.id, mockPois]]));
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.data).toBeDefined();
        expect(
            (result.data as unknown as { pointsOfInterest: ReadonlyArray<{ slug: string }> })
                .pointsOfInterest
        ).toEqual(mockPois);
    });

    it('leaves an already-hydrated pointsOfInterest array untouched', async () => {
        const preHydrated = { ...entity, pointsOfInterest: [{ id: 'existing-poi', slug: 'x' }] };
        (model.findOne as Mock).mockResolvedValue(preHydrated);
        (model as unknown as { getAttractionsMap: Mock }).getAttractionsMap = vi
            .fn()
            .mockResolvedValue(new Map());
        const getPointsOfInterestMapMock = vi.fn().mockResolvedValue(new Map());
        (model as unknown as { getPointsOfInterestMap: Mock }).getPointsOfInterestMap =
            getPointsOfInterestMapMock;
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(
            (result.data as unknown as { pointsOfInterest: ReadonlyArray<{ id: string }> })
                .pointsOfInterest
        ).toEqual([{ id: 'existing-poi', slug: 'x' }]);
        expect(getPointsOfInterestMapMock).not.toHaveBeenCalled();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getBySlug(actor, entity.slug);
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
        const result = await service.getBySlug(actor, entity.slug);
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
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
