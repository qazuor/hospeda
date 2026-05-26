import type { AccommodationModel } from '@repo/db';
import { DestinationTypeEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodationCreateInput } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// Mocks
const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
});

describe('AccommodationService.create', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // Mock destinationService.updateAccommodationsCount para evitar acceso real a DB
        // @ts-expect-error: override for test
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        // SPEC-095: stub the private destination model so _assertDestinationIsCity
        // resolves a CITY destination without hitting the real DB.
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
        };
        // SPEC-143 #29: stub the private user model so _beforeCreate's
        // service-suspension guard resolves a non-suspended owner by default.
        // @ts-expect-error: override for test
        service._userModel = {
            findById: vi.fn().mockResolvedValue({ serviceSuspended: false })
        };
        vi.clearAllMocks();
    });

    it('should create an accommodation when permissions and input are valid', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });

        const created = { ...input, id: 'mock-id', slug: 'mock-slug' };
        (model.create as Mock).mockResolvedValue(created);
        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN when the owner is service-suspended (SPEC-143 #29)', async () => {
        // Arrange — even an admin cannot create a listing for a paused owner.
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._userModel = {
            findById: vi.fn().mockResolvedValue({ serviceSuspended: true })
        };
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toMatch(/paused/i);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = {
            ...createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: []
            }),
            name: undefined
        };
        // Act
        const result = await service.create(
            actor,
            input as unknown as Parameters<AccommodationService['create']>[1]
        );
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    // SPEC-095: destinationType=CITY enforcement
    it('should return VALIDATION_ERROR if destinationId references a non-CITY destination', async () => {
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.PROVINCE })
        };
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/CITY/);
        expect(result.data).toBeUndefined();
        expect(model.create).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR if destinationId does not exist', async () => {
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue(null)
        };
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });
});
