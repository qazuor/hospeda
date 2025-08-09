import type { AccommodationModel } from '@repo/db';
import { CreateAccommodationServiceSchema } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { ZodError } from 'zod';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createNewAccommodationInput } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// Mocks
const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    vi.spyOn(CreateAccommodationServiceSchema, 'parse').mockImplementation((input: unknown) => {
        const typedInput = input as z.infer<typeof CreateAccommodationServiceSchema>;
        if (!typedInput || !typedInput.name) {
            throw new ZodError([
                {
                    code: 'custom',
                    message: 'Invalid input',
                    path: ['name']
                }
            ]);
        }
        return typedInput;
    });
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
        vi.clearAllMocks();
    });

    it('should create an accommodation when permissions and input are valid', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = {
            ...createNewAccommodationInput(),
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        };
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

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const input = {
            ...createNewAccommodationInput(),
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        };
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
            ...createNewAccommodationInput(),
            name: undefined,
            reviewsCount: 0,
            averageRating: 0,
            tags: []
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
        const input = {
            ...createNewAccommodationInput(),
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        };
        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
