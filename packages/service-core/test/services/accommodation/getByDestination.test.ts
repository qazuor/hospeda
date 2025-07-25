/**
 * @fileoverview
 * Test suite for the AccommodationService.getByDestination method.
 * Ensures robust, type-safe, and homogeneous handling of accommodation retrieval by destination, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import {
    AccommodationFactoryBuilder,
    getMockDestinationId
} from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.getByDestination method.
 *
 * This suite verifies:
 * - Correct accommodation retrieval by destination on valid input and permissions
 * - Validation and error codes for forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.getByDestination', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodations: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>[];
    let destinationId: ReturnType<typeof getMockDestinationId>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findAll']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        destinationId = getMockDestinationId();
        accommodations = [
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build(),
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build()
        ];
    });

    it('should return accommodations for a destination', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.findAll.mockResolvedValue({
            items: accommodations,
            total: accommodations.length
        });
        const result = await service.getByDestination(actor, { destinationId });
        expectSuccess(result);
        expect(result.data).toEqual(accommodations);
        expect(modelMock.findAll).toHaveBeenCalledWith({ destinationId });
        expect(permissionHelpers.checkCanList).toHaveBeenCalledWith(actor);
    });

    it('should return FORBIDDEN if actor cannot list', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const result = await service.getByDestination(actor, { destinationId });
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanList).toHaveBeenCalledWith(actor);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getByDestination(actor, { destinationId });
        expectInternalError(result);
        expect(modelMock.findAll).toHaveBeenCalledWith({ destinationId });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByDestination(actor, {});
        expectValidationError(result);
    });

    it('should return empty array if destination does not exist', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByDestination(actor, {
            destinationId: '00000000-0000-0000-0000-000000000000'
        });
        expectSuccess(result);
        expect(result.data).toEqual([]);
    });
});
