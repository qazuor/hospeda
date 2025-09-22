/**
 * @fileoverview
 * Test suite for the AccommodationService.removeIAData method.
 * Ensures robust, type-safe, and homogeneous handling of AI data removal, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { AccommodationIaDataRemoveInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockIaDataId } from '../../factories/utilsFactory';
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
 * Test suite for the AccommodationService.removeIAData method.
 *
 * This suite verifies:
 * - Correct AI data removal on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.removeIAData', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let iaDataModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let iaData: {
        id: string;
        accommodationId: string;
        title: string;
        content: string;
        category?: string;
    };
    let input: AccommodationIaDataRemoveInput;

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
        iaData = {
            id: getMockIaDataId('ia-data-1'),
            accommodationId: accommodation.id as any,
            title: 'Local Attractions',
            content: 'Detailed information about nearby attractions.',
            category: 'attractions'
        };
        input = {
            accommodationId: accommodation.id as any,
            iaDataId: getMockIaDataId(iaData.id) as any
        };
        vi.spyOn(db, 'AccommodationIaDataModel').mockImplementation(
            () => iaDataModelMock as unknown as db.AccommodationIaDataModel
        );
    });

    it('should remove AI data successfully', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.findById.mockResolvedValue(iaData);
        iaDataModelMock.hardDelete.mockResolvedValue(1);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.removeIAData(input, actor);
        expectSuccess(result);
        expect(result.data).toEqual({ success: true });
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(iaDataModelMock.findById).toHaveBeenCalledWith(iaData.id as any);
        expect(iaDataModelMock.hardDelete).toHaveBeenCalledWith({ id: iaData.id as any });
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.removeIAData(input, actor);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
    });

    it('should return NOT_FOUND if AI data does not exist', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.findById.mockResolvedValue(null);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.removeIAData(input, actor);
        expectNotFoundError(result);
        expect(iaDataModelMock.findById).toHaveBeenCalledWith(iaData.id as any);
    });

    it('should return NOT_FOUND if AI data belongs to different accommodation', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.findById.mockResolvedValue({
            ...iaData,
            accommodationId: 'different-accommodation-id'
        });
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.removeIAData(input, actor);
        expectNotFoundError(result);
        expect(iaDataModelMock.findById).toHaveBeenCalledWith(iaData.id as any);
    });

    it('should return FORBIDDEN if actor cannot update', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.findById.mockResolvedValue(iaData);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.removeIAData(input, actor);
        expectForbiddenError(result);
        expect(Object.getPrototypeOf(service)._canUpdate).toHaveBeenCalledWith(
            actor,
            accommodation
        );
    });

    it('should return INTERNAL_ERROR if AI data deletion fails', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        iaDataModelMock.findById.mockResolvedValue(iaData);
        iaDataModelMock.hardDelete.mockRejectedValue(new Error('DB error'));
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.removeIAData(input, actor);
        expectInternalError(result);
        expect(iaDataModelMock.hardDelete).toHaveBeenCalledWith({ id: iaData.id as any });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.removeIAData({}, actor);
        expectValidationError(result);
    });
});
