import { AccommodationModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the AccommodationService covering all core service methods.
 * Ensures robust, type-safe, and homogeneous handling of creation, validation, permission, normalization, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { type Actor, ServiceError } from '../../../src';
import type { CreateAccommodationSchema } from '../../../src/services/accommodation';
import * as accommodationHelpers from '../../../src/services/accommodation/accommodation.helpers';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceLogger } from '../../../src/utils';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';
// import { expectSuccess, expectForbiddenError, expectInternalError, expectValidationError } from '../../helpers/assertions';

vi.mock('../../../src/services/accommodation/accommodation.permissions');
vi.mock('../../../src/services/accommodation/accommodation.helpers');

// Centralized logger mock
const mockLogger: ServiceLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
} as unknown as ServiceLogger;

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

/**
 * Test suite for the AccommodationService.
 *
 * This suite verifies:
 * - Correct entity creation and input validation
 * - Permission checks and error codes for forbidden, validation, and internal errors
 * - Use of normalizers and hooks
 * - Robustness against errors in helpers, hooks, and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService', () => {
    /**
     * AccommodationModel mock, strongly typed as vi.Mocked<AccommodationModel> to allow vi.fn() methods (mockResolvedValue, etc.)
     */
    let modelMock: AccommodationModel;
    let service: AccommodationService;
    let actor: Actor;
    let entity: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let createInput: z.infer<typeof CreateAccommodationSchema>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(AccommodationModel, [
            'countByFilters',
            'search',
            'getById',
            'getByName',
            'create'
        ]);
        service = createServiceTestInstance(AccommodationService, modelMock, mockLogger);
        actor = new ActorFactoryBuilder().host().build();
        entity = new AccommodationFactoryBuilder()
            .public()
            .withOwner(actor.id as import('@repo/types').UserId)
            .build();
        createInput = {
            name: entity.name,
            slug: entity.slug,
            summary: entity.summary,
            description: entity.description,
            type: entity.type,
            visibility: entity.visibility,
            lifecycleState: entity.lifecycleState,
            moderationState: entity.moderationState,
            isFeatured: entity.isFeatured,
            ownerId: entity.ownerId,
            destinationId: entity.destinationId,
            reviewsCount: entity.reviewsCount ?? 0,
            averageRating: entity.averageRating ?? 0
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // --- CREATE ---

    it('should create an accommodation when permissions are granted', async () => {
        // Arrange
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();
        vi.mocked(accommodationHelpers.generateSlug).mockResolvedValue(entity.slug);
        asMock(modelMock.create).mockResolvedValue(entity);

        // Act
        const result = await service.create(actor, createInput);

        // Assert
        expect(permissionHelpers.checkCanCreate).toHaveBeenCalledWith(actor, expect.any(Object));
        expect(asMock(modelMock.create)).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: entity.slug,
                name: entity.name,
                ownerId: entity.ownerId,
                createdById: actor.id,
                updatedById: actor.id
            })
        );
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual(entity);
    });

    it('should return FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        vi.mocked(permissionHelpers.checkCanCreate).mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });

        // Act
        const result = await service.create(actor, createInput);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if slug generation fails', async () => {
        // Arrange
        const slugError = new Error('Slug generation failed');
        vi.mocked(accommodationHelpers.generateSlug).mockRejectedValue(slugError);
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();

        // Act
        const result = await service.create(actor, createInput);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if database creation fails', async () => {
        // Arrange
        const dbError = new Error('DB connection failed');
        asMock(modelMock.create).mockRejectedValue(dbError);
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();
        vi.mocked(accommodationHelpers.generateSlug).mockResolvedValue(entity.slug);

        // Act
        const result = await service.create(actor, createInput);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange: A required field is missing (for example, name)
        const { name, ...invalidInput } = createInput;
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();

        // Act
        // @ts-expect-error: purposely invalid input
        const result = await service.create(actor, invalidInput);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should use the create normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((data) => ({ ...data, normalized: true }));
        const serviceWithNormalizer = createServiceTestInstance(
            AccommodationService,
            modelMock,
            mockLogger
        );
        // @ts-ignore
        serviceWithNormalizer.normalizers = { create: normalizer };
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();
        vi.mocked(accommodationHelpers.generateSlug).mockResolvedValue(entity.slug);
        asMock(modelMock.create).mockResolvedValue(entity);

        // Act
        await serviceWithNormalizer.create(actor, createInput);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(createInput, actor);
        expect(asMock(modelMock.create)).toHaveBeenCalledWith(
            expect.objectContaining({ normalized: true })
        );
    });

    it('should call the _afterCreate hook with the created entity', async () => {
        // Arrange
        vi.mocked(permissionHelpers.checkCanCreate).mockReturnValue();
        vi.mocked(accommodationHelpers.generateSlug).mockResolvedValue(entity.slug);
        asMock(modelMock.create).mockResolvedValue(entity);
        const afterCreateSpy = vi.spyOn(
            service as unknown as { _afterCreate: (...args: unknown[]) => unknown },
            '_afterCreate'
        );

        // Act
        await service.create(actor, createInput);

        // Assert
        expect(afterCreateSpy).toHaveBeenCalledWith(entity, actor);
    });
});
