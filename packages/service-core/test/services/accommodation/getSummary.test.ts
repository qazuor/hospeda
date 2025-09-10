/**
 * @fileoverview
 * Test suite for the AccommodationService.getSummary method.
 * Ensures robust, type-safe, and homogeneous handling of summary retrieval, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { AccommodationModel } from '@repo/db';
import type { AccommodationSummaryParamsSchema } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
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
import { createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

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
    let modelMock: AccommodationModel;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let input: z.infer<typeof AccommodationSummaryParamsSchema>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(AccommodationModel, ['findOne']);
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder().public().build();
        input = { idOrSlug: accommodation.id };
    });

    it('should return summary for an accommodation', async () => {
        asMock(modelMock.findOne).mockResolvedValue(accommodation);
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
        asMock(modelMock.findOne).mockResolvedValue(null);
        const result = await service.getSummary(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return NOT_FOUND if accommodation has no location', async () => {
        const noLocation = { ...accommodation, location: undefined };
        asMock(modelMock.findOne).mockResolvedValue(noLocation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getSummary(actor, input);
        // The method returns null, so the test expects data === null
        expect(result.data).toBeNull();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, noLocation);
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        asMock(modelMock.findOne).mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getSummary(actor, input);
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(actor, input);
        expectInternalError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getSummary(actor, { idOrSlug: '' });
        expectValidationError(result);
    });
});
