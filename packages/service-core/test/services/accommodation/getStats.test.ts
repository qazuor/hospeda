/**
 * @fileoverview
 * Test suite for the AccommodationService.getStats method.
 * Ensures robust, type-safe, and homogeneous handling of stats retrieval, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import type { GetAccommodationSchema } from '../../../src/services/accommodation/accommodation.schemas';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createModelMock } from '../../helpers/modelMockFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';

/**
 * Test suite for the AccommodationService.getStats method.
 *
 * This suite verifies:
 * - Correct stats retrieval on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.getStats', () => {
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
        accommodation = new AccommodationFactoryBuilder().public().build();
        input = { id: accommodation.id };
    });

    it('should return stats for an accommodation', async () => {
        modelMock.findOne.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getStats(actor, input);
        expectSuccess(result);
        expect(result.data).toEqual({
            reviewsCount: accommodation.reviewsCount ?? 0,
            averageRating: accommodation.averageRating ?? 0,
            rating: accommodation.rating
        });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findOne.mockResolvedValue(null);
        let result: unknown;
        try {
            result = await service.getStats(actor, input);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
            return;
        }
        expectNotFoundError(result as { error?: { code?: string } });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        modelMock.findOne.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        let result: unknown;
        try {
            result = await service.getStats(actor, input);
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
            result = await service.getStats(actor, input);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            return;
        }
        expectInternalError(result as { error?: { code?: string } });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getStats(actor, {});
        expectValidationError(result);
    });
});
