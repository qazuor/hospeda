import { DestinationModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
/**
 * @file getStats.test.ts
 * @description Unit tests for DestinationService.getStats. Covers success, not found, and internal error cases.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GetStatsInput } from '../../../src/services/destination/destination.schemas';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.getStats', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, []);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return stats for a valid destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ accommodationsCount: 5, reviewsCount: 10, averageRating: 4.2 })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetStatsInput = { destinationId: destination.id };

        // Act
        const result = await service.getStats(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.stats).toEqual({
            accommodationsCount: 5,
            reviewsCount: 10,
            averageRating: 4.2
        });
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetStatsInput = { destinationId: 'nonexistent' };

        // Act
        const result = await service.getStats(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(modelMock.findById).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetStatsInput = { destinationId: 'dest-1' };

        // Act
        const result = await service.getStats(actor, params);

        // Assert
        expectInternalError(result);
    });

    it('should return 0 for stats fields if they are undefined or null', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({
                accommodationsCount: undefined,
                reviewsCount: undefined,
                averageRating: undefined
            })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetStatsInput = { destinationId: destination.id };

        // Act
        const result = await service.getStats(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.stats).toEqual({
            accommodationsCount: 0,
            reviewsCount: 0,
            averageRating: 0
        });
    });

    it('should return FORBIDDEN if actor cannot view the destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PRIVATE })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetStatsInput = { destinationId: destination.id };

        // Act
        const result = await service.getStats(actor, params);

        // Assert
        expectForbiddenError(result);
        // TODO: If permission helper is mockable, add: expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(input.actor, destination);
    });
});
