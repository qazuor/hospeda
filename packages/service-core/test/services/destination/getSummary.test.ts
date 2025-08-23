import { DestinationModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
/**
 * @file getSummary.test.ts
 * @description Unit tests for DestinationService.getSummary. Covers success, not found, missing location, and internal error cases.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GetSummaryInput } from '../../../src/services/destination/destination.schemas';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
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

describe('DestinationService.getSummary', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, [
            'findWithRelations',
            'findAllByAttractionId'
        ]);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return a summary DTO for a valid destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder().with({ averageRating: 4.5 }).build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetSummaryInput = { destinationId: destination.id };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.summary).toEqual({
            id: destination.id,
            slug: destination.slug,
            name: destination.name,
            media: destination.media,
            location: destination.location,
            isFeatured: destination.isFeatured,
            averageRating: destination.averageRating,
            reviewsCount: destination.reviewsCount,
            accommodationsCount: destination.accommodationsCount,
            country: destination.location?.country
        });
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetSummaryInput = { destinationId: 'nonexistent' };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return NOT_FOUND if destination has no location', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder().with({ location: undefined }).build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetSummaryInput = { destinationId: destination.id };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(modelMock.findById).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetSummaryInput = { destinationId: 'dest-1' };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectInternalError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: '' };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return FORBIDDEN if actor cannot view the destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PRIVATE })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetSummaryInput = { destinationId: destination.id };

        // Act
        const result = await service.getSummary(actor, params);

        // Assert
        expectForbiddenError(result);
        // TODO [af442102-b601-498a-8452-11aa3744f8a4]: If permission helper is mockable, add: expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(input.actor, destination);
    });
});
