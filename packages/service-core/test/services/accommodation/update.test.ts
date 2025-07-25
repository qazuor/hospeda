import type { AccommodationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import type { UpdateAccommodationInput } from '../../../src/services/accommodation/accommodation.schemas';
import * as schemas from '../../../src/services/accommodation/accommodation.schemas';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createNewAccommodationInput } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// Mocks
const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    // Mock safeParseAsync for validation
    vi.spyOn(schemas.UpdateAccommodationSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => {
            const typedInput = input as UpdateAccommodationInput;
            if (
                typedInput &&
                Object.prototype.hasOwnProperty.call(typedInput, 'name') &&
                typedInput.name === undefined
            ) {
                return {
                    success: false,
                    error: new ZodError([
                        {
                            code: 'custom',
                            message: 'Invalid input',
                            path: ['name']
                        }
                    ])
                };
            }
            return { success: true, data: typedInput };
        }
    );
});

describe('AccommodationService.update', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        vi.clearAllMocks();
    });

    it('should update an accommodation when permissions and input are valid', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        const updateInput = { name: 'Updated Name' };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({ ...existing, ...updateInput });
        // Act
        const result = await service.update(actor, id, updateInput);
        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Updated Name');
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id);
        expect(model.update).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        // Act
        const result = await service.update(actor, id, { name: undefined } as unknown as Parameters<
            AccommodationService['update']
        >[2]);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'not-found-id';
        (model.findById as Mock).mockResolvedValue(null);
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
