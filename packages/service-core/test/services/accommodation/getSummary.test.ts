/**
 * @fileoverview
 * Test suite for the AccommodationService.getSummary method.
 * Ensures robust, type-safe, and homogeneous handling of summary retrieval,
 * validation, permission, and error propagation logic.
 */
import { AccommodationModel } from '@repo/db';
import type { AccommodationSummaryParamsSchema } from '@repo/schemas';
import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import type { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import * as permissionHelpers from '../../helpers/../../src/services/accommodation/accommodation.permissions';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock, makeMediaModelStub } from '../../utils/modelMockFactory';

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
        // SPEC-204 T-013: _afterGetByField now calls findByAccommodations on the
        // media model. Inject a stub that returns an empty Map so the read hook
        // preserves the entity's original `media` without needing a real DB.
        service = new AccommodationService(
            { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never },
            modelMock,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        actor = new ActorFactoryBuilder().host().build();
        accommodation = createMockAccommodation({ lifecycleState: LifecycleStatusEnum.ACTIVE });
        input = { id: accommodation.id };
    });

    it('should return summary for an accommodation', async () => {
        asMock(modelMock.findOne).mockResolvedValue(accommodation);
        asMock(modelMock.findOneWithRelations).mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getSummary(actor, input);
        expectSuccess(result);
        expect(result.data).toEqual({
            accommodation: {
                id: accommodation.id,
                slug: accommodation.slug,
                name: accommodation.name,
                type: accommodation.type,
                summary: accommodation.summary,
                media: accommodation.media,
                location: accommodation.location,
                isFeatured: accommodation.isFeatured,
                ownerId: accommodation.ownerId,
                averageRating: 0,
                reviewsCount: 0
            }
        });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id }, undefined);
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        asMock(modelMock.findOne).mockResolvedValue(null);
        asMock(modelMock.findOneWithRelations).mockResolvedValue(null);
        const result = await service.getSummary(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id }, undefined);
    });

    it('should return NOT_FOUND if accommodation has no location', async () => {
        const noLocation = { ...accommodation, location: undefined };
        asMock(modelMock.findOne).mockResolvedValue(noLocation);
        asMock(modelMock.findOneWithRelations).mockResolvedValue(noLocation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getSummary(actor, input);
        // When no location, the method logs a warning and returns null in data
        expect(result.data).toEqual({ accommodation: null });
        expect(result.error).toBeUndefined();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id }, undefined);
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, noLocation);
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        asMock(modelMock.findOne).mockResolvedValue(accommodation);
        asMock(modelMock.findOneWithRelations).mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getSummary(actor, input);
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id }, undefined);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findOne).mockRejectedValue(new Error('DB error'));
        asMock(modelMock.findOneWithRelations).mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(actor, input);
        expectInternalError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: accommodation.id }, undefined);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getSummary(actor, { id: '' });
        expectValidationError(result);
    });
});
