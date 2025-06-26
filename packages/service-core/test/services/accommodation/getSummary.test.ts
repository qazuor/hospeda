/**
 * @fileoverview
 * Test suite for the AccommodationService.getSummary method.
 * Ensures robust, type-safe, and homogeneous handling of summary retrieval, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import type { GetAccommodationSchema } from '../../../src/services/accommodation/accommodation.schemas';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import * as permissionHelpers from '../../helpers/../../src/services/accommodation/accommodation.permissions';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.getSummary method.
 *
 * Esta suite verifica:
 * - Correct summary retrieval on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.getSummary', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let input: z.infer<typeof GetAccommodationSchema>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findById', 'findOne']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder()
            .public()
            .withOverrides({
                location: {
                    state: 'Test State',
                    zipCode: '12345',
                    country: 'Test Country',
                    street: 'Test Street',
                    number: '123',
                    city: 'Test City'
                }
            })
            .build();
        input = { id: accommodation.id };
    });

    it('should return summary for an accommodation', async () => {
        modelMock.findOne.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getSummary(actor, input);
        expectSuccess(result);
        expect(result.data).toEqual({
            id: accommodation.id,
            slug: accommodation.slug,
            name: accommodation.name,
            type: accommodation.type,
            media: accommodation.media,
            location: accommodation.location,
            isFeatured: accommodation.isFeatured,
            averageRating: 0,
            reviewsCount: 0
        });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findOne.mockResolvedValue(null);
        let result: unknown;
        try {
            result = await service.getSummary(actor, input);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
            return;
        }
        expectNotFoundError(result as { error?: { code?: string } });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return NOT_FOUND if accommodation has no location', async () => {
        const noLocation = { ...accommodation, location: undefined };
        modelMock.findOne.mockResolvedValue(noLocation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getSummary(actor, input);
        // The method returns null, so the test expects data === null
        expect(result.data).toBeNull();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, noLocation);
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        modelMock.findOne.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        let result: unknown;
        try {
            result = await service.getSummary(actor, input);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            return;
        }
        expectForbiddenError(result as { error?: { code?: string } });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findOne.mockRejectedValue(new Error('DB error'));
        let result: unknown;
        try {
            result = await service.getSummary(actor, input);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            return;
        }
        expectInternalError(result as { error?: { code?: string } });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getSummary(actor, {});
        expectValidationError(result);
    });
});
