import { AccommodationModel, DestinationModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
/**
 * @file getAccommodations.test.ts
 * @description Unit tests for DestinationService.getAccommodations. Covers success, not found, and internal error cases.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GetAccommodationsInput } from '../../../src/services/destination/destination.schemas';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.getAccommodations', () => {
    let service: DestinationService;
    let destinationModelMock: DestinationModel;
    let accommodationModelMock: AccommodationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        destinationModelMock = createTypedModelMock(DestinationModel, []);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['search']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, destinationModelMock, loggerMock);
        // Override accommodationModel for test (private property)
        (service as unknown as { accommodationModel: AccommodationModel }).accommodationModel =
            accommodationModelMock;
    });

    it('should return accommodations for a valid destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder().build();
        const accommodations = [
            new AccommodationFactoryBuilder().with({ destinationId: destination.id }).build(),
            new AccommodationFactoryBuilder().with({ destinationId: destination.id }).build()
        ];
        asMock(destinationModelMock.findById).mockResolvedValue(destination);
        asMock(accommodationModelMock.search).mockResolvedValue({ items: accommodations });
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetAccommodationsInput = { destinationId: destination.id };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodations).toEqual(accommodations);
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        asMock(destinationModelMock.findById).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetAccommodationsInput = { destinationId: 'nonexistent' };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(destinationModelMock.findById).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetAccommodationsInput = { destinationId: 'dest-1' };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectInternalError(result);
    });

    it('should return empty array if no accommodations exist for destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder().build();
        asMock(destinationModelMock.findById).mockResolvedValue(destination);
        asMock(accommodationModelMock.search).mockResolvedValue({ items: [] });
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetAccommodationsInput = { destinationId: destination.id };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodations).toEqual([]);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: '' };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return FORBIDDEN if actor cannot view the destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PRIVATE })
            .build();
        asMock(destinationModelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetAccommodationsInput = { destinationId: destination.id };

        // Act
        const result = await service.getAccommodations(actor, params);

        // Assert
        expectForbiddenError(result);
        // TODO: If permission helper is mockable, add: expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(input.actor, destination);
    });
});
