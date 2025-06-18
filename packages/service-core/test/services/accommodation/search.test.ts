import type { DestinationId, FeatureId } from '@repo/types';
import { AccommodationTypeEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { EntityPermissionReasonEnum } from '../../../src/types';
import {
    createAccommodation,
    getMockAccommodationId,
    getMockAmenityId
} from '../../factories/accommodationFactory';
import { type ActorWithPermissions, createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
};

class TestableAccommodationService extends AccommodationService {
    public canViewEntity = super.canViewEntity;
    public canDeleteEntity = super.canDeleteEntity;
    public canRestoreEntity = super.canRestoreEntity;
    public canHardDeleteEntity = super.canHardDeleteEntity;
}

describe('AccommodationService.search', () => {
    let service: TestableAccommodationService;
    const actor: ActorWithPermissions = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
    });
    const accommodations = [
        createAccommodation({
            id: getMockAccommodationId('1'),
            type: AccommodationTypeEnum.HOTEL,
            destinationId: getMockId('destination', 'd1') as DestinationId,
            name: 'Hotel A',
            slug: 'hotel-a',
            amenities: [
                {
                    accommodationId: getMockAccommodationId('1'),
                    amenityId: getMockAmenityId('a1'),
                    isOptional: false
                }
            ],
            features: [
                {
                    accommodationId: getMockAccommodationId('1'),
                    featureId: getMockId('feature', 'f1') as FeatureId
                }
            ]
        }),
        createAccommodation({
            id: getMockAccommodationId('2'),
            type: AccommodationTypeEnum.CABIN,
            destinationId: getMockId('destination', 'd2') as DestinationId,
            name: 'Cabin B',
            slug: 'cabin-b',
            amenities: [
                {
                    accommodationId: getMockAccommodationId('2'),
                    amenityId: getMockAmenityId('a2'),
                    isOptional: true
                }
            ],
            features: [
                {
                    accommodationId: getMockAccommodationId('2'),
                    featureId: getMockId('feature', 'f2') as FeatureId
                }
            ]
        }),
        createAccommodation({
            id: getMockAccommodationId('3'),
            type: AccommodationTypeEnum.HOTEL,
            destinationId: getMockId('destination', 'd1') as DestinationId,
            name: 'Hotel C',
            slug: 'hotel-c',
            amenities: [
                {
                    accommodationId: getMockAccommodationId('3'),
                    amenityId: getMockAmenityId('a1'),
                    isOptional: false
                }
            ],
            features: [
                {
                    accommodationId: getMockAccommodationId('3'),
                    featureId: getMockId('feature', 'f2') as FeatureId
                }
            ]
        })
    ];

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
        mockModel.findAll.mockResolvedValue(accommodations);
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
    });

    it('filters by type', async () => {
        mockModel.findAll.mockResolvedValue(
            accommodations.filter((a) => a.type === AccommodationTypeEnum.HOTEL)
        );
        const result = await service.search({ actor, type: AccommodationTypeEnum.HOTEL });
        expect(result.data).toBeDefined();
        expect(result.data?.every((a) => a.type === AccommodationTypeEnum.HOTEL)).toBe(true);
    });

    it('filters by destinationId', async () => {
        const destinationId = getMockId('destination', 'd2') as DestinationId;
        mockModel.findAll.mockResolvedValue(
            accommodations.filter((a) => a.destinationId === destinationId)
        );
        const result = await service.search({ actor, destinationId });
        expect(result.data).toBeDefined();
        expect(result.data?.every((a) => a.destinationId === destinationId)).toBe(true);
    });

    it('filters by amenityIds', async () => {
        mockModel.findAll.mockResolvedValue([accommodations[0], accommodations[2]]);
        const amenityId = getMockAmenityId('a1');
        const result = await service.search({ actor, amenityIds: [amenityId] });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(2);
        expect(
            result.data?.every((a) => a.amenities?.some((am) => am.amenityId === amenityId))
        ).toBe(true);
    });

    it('filters by featureIds', async () => {
        mockModel.findAll.mockResolvedValue([accommodations[1], accommodations[2]]);
        const featureId = getMockId('feature', 'f2') as FeatureId;
        const result = await service.search({ actor, featureIds: [featureId] });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(2);
        expect(result.data?.every((a) => a.features?.some((f) => f.featureId === featureId))).toBe(
            true
        );
    });

    it('filters by name', async () => {
        mockModel.findAll.mockResolvedValue([accommodations[0]]);
        const result = await service.search({ actor, name: 'Hotel A' });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(1);
        expect(result.data?.[0]?.name).toBe('Hotel A');
    });

    it('filters by slug', async () => {
        mockModel.findAll.mockResolvedValue([accommodations[2]]);
        const result = await service.search({ actor, slug: 'hotel-c' });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(1);
        expect(result.data?.[0]?.slug).toBe('hotel-c');
    });

    it('filters by multiple parameters', async () => {
        mockModel.findAll.mockResolvedValue([accommodations[2]]);
        const featureId = getMockId('feature', 'f2') as FeatureId;
        const destinationId = getMockId('destination', 'd1') as DestinationId;
        const result = await service.search({
            actor,
            type: AccommodationTypeEnum.HOTEL,
            destinationId,
            featureIds: [featureId]
        });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(1);
        expect(result.data?.[0]?.id).toBe(getMockAccommodationId('3'));
    });

    it('returns only accommodations the actor can view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValueOnce({ canView: true, reason: EntityPermissionReasonEnum.APPROVED })
            .mockResolvedValueOnce({ canView: false, reason: EntityPermissionReasonEnum.DENIED })
            .mockResolvedValueOnce({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.search({ actor, type: AccommodationTypeEnum.HOTEL });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(1);
        expect(result.data?.[0]?.id).toBe(getMockAccommodationId('1'));
    });

    it('returns empty array if no accommodations found', async () => {
        mockModel.findAll.mockResolvedValue([]);
        const result = await service.search({ actor, type: AccommodationTypeEnum.HOSTEL });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if input type is invalid', async () => {
        // Override the model for this validation test
        // @ts-expect-error
        service.model = undefined;
        // @ts-expect-error purposely wrong type
        const result = await service.search({ actor, type: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toMatch(/expected string/i);
    });

    it('returns unauthorized error if actor is missing', async () => {
        // Override the model for this validation test
        // @ts-expect-error
        service.model = undefined;
        // @ts-expect-error purposely missing actor
        const result = await service.search({ type: AccommodationTypeEnum.HOTEL });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.error?.message).toMatch(/actor is required/i);
    });

    it('returns internal error if model throws', async () => {
        mockModel.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.search({ actor, type: AccommodationTypeEnum.HOTEL });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('returns empty array if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        mockModel.findAll.mockResolvedValue(accommodations);
        const result = await service.search({ actor, type: AccommodationTypeEnum.HOTEL });
        expect(result.data).toEqual([]);
    });

    it('filters by all parameters combined', async () => {
        const amenityId = getMockAmenityId('a1');
        const featureId = getMockId('feature', 'f2') as FeatureId;
        const destinationId = getMockId('destination', 'd1') as DestinationId;
        mockModel.findAll.mockResolvedValue([accommodations[2]]);
        const result = await service.search({
            actor,
            type: AccommodationTypeEnum.HOTEL,
            destinationId,
            amenityIds: [amenityId],
            featureIds: [featureId],
            name: 'Hotel C',
            slug: 'hotel-c'
        });
        expect(result.data).toBeDefined();
        expect(result.data?.length).toBe(1);
        expect(result.data?.[0]?.id).toBe(getMockAccommodationId('3'));
    });
});
