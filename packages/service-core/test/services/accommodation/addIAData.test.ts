/**
 * @fileoverview
 * Test suite for the AccommodationService.addIAData method.
 * Ensures robust, type-safe, and homogeneous handling of AI data addition, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { AccommodationIaDataAddInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
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
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.addIAData method.
 *
 * This suite verifies:
 * - Correct AI data addition on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.addIAData', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let iaDataModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let input: AccommodationIaDataAddInput;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findById']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        iaDataModelMock = createModelMock([
            'create',
            'findById',
            'update',
            'findAll',
            'hardDelete'
        ]);
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder().public().build();
        input = {
            accommodationId: accommodation.id as any,
            iaData: {
                title: 'Local Attractions',
                content: 'Detailed information about nearby attractions and points of interest.',
                category: 'attractions'
            }
        };
        // Mock AccommodationIaDataModel for this test
        vi.spyOn(db, 'AccommodationIaDataModel').mockImplementation(
            () => iaDataModelMock as unknown as db.AccommodationIaDataModel
        );
    });

    it('should add AI data successfully', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.create.mockResolvedValue({
            ...input.iaData,
            id: 'ia-data-1',
            accommodationId: accommodation.id as any
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockReturnValue();

        const result = await service.addIAData(input, actor);
        expectSuccess(result);
        expect(result.data?.iaData).toMatchObject({
            title: input.iaData.title,
            content: input.iaData.content,
            category: input.iaData.category,
            accommodationId: accommodation.id as any
        });
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(iaDataModelMock.create).toHaveBeenCalled();
        expect(permissionHelpers.checkCanUpdate).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.addIAData(input, actor);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
    });

    it('should return FORBIDDEN if actor cannot update', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.addIAData(input, actor);
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanUpdate).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return INTERNAL_ERROR if AI data creation fails', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.create.mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockReturnValue();
        const result = await service.addIAData(input, actor);
        expectInternalError(result);
        expect(iaDataModelMock.create).toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.addIAData({}, actor);
        expectValidationError(result);
    });
});
