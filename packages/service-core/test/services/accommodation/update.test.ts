import type { AccommodationModel } from '@repo/db';
import { AccommodationUpdateInputSchema } from '@repo/schemas';
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
    // Mock safeParseAsync for validation
    vi.spyOn(AccommodationUpdateInputSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => {
            const typedInput = input as z.infer<typeof AccommodationUpdateInputSchema>;
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
                } as z.ZodSafeParseError<z.infer<typeof AccommodationUpdateInputSchema>>;
            }
            return { success: true, data: typedInput } as z.ZodSafeParseSuccess<
                z.infer<typeof AccommodationUpdateInputSchema>
            >;
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
        const updateInput = { name: 'a' }; // Too short name should fail validation (min 3 chars)
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);

        // Restore original safeParseAsync for this test to use real validation
        vi.restoreAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');

        // Act - Send invalid data that should fail validation
        const result = await service.update(actor, id, updateInput);

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
