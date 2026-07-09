/**
 * @file getNearby.test.ts
 * @description Unit tests for DestinationService.getNearby (HOS-111 T-011).
 *   Covers success (radius hit forwarded from the model), empty result,
 *   validation, and error cases. The radius/N-nearest-fallback LOGIC itself
 *   is unit-tested at the model layer (`packages/db/test/models/destination-nearby.test.ts`);
 *   this suite only verifies the service correctly validates input, forwards
 *   params to `model.findNearby`, and wraps the result in the standard
 *   `ServiceOutput` envelope.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationNearbyInput } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.getNearby', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findNearby']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return nearby destinations forwarded from the model', async () => {
        // Arrange
        const anchorId = getMockId('destination', 'colon');
        const neighbor = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'concepcion'),
                name: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay'
            })
            .build();
        asMock(modelMock.findNearby).mockResolvedValue([neighbor]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationNearbyInput = { destinationId: anchorId };

        // Act
        const result = await service.getNearby(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.nearby).toHaveLength(1);
        expect(result.data?.nearby[0]?.name).toBe('Concepción del Uruguay');
        expect(asMock(modelMock.findNearby)).toHaveBeenCalledWith(
            { destinationId: anchorId, radiusKm: undefined, fallbackCount: undefined },
            undefined
        );
    });

    it('should forward optional radiusKm / fallbackCount overrides to the model', async () => {
        // Arrange
        const anchorId = getMockId('destination', 'colon-2');
        asMock(modelMock.findNearby).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationNearbyInput = {
            destinationId: anchorId,
            radiusKm: 25,
            fallbackCount: 3
        };

        // Act
        await service.getNearby(actor, params);

        // Assert
        expect(asMock(modelMock.findNearby)).toHaveBeenCalledWith(
            { destinationId: anchorId, radiusKm: 25, fallbackCount: 3 },
            undefined
        );
    });

    it('should return an empty array when the model finds no nearby destinations', async () => {
        // Arrange
        const anchorId = getMockId('destination', 'isolated');
        asMock(modelMock.findNearby).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationNearbyInput = { destinationId: anchorId };

        // Act
        const result = await service.getNearby(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.nearby).toHaveLength(0);
    });

    it('should return VALIDATION_ERROR for an invalid destinationId', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: 'not-a-uuid' } as unknown as GetDestinationNearbyInput;

        // Act
        const result = await service.getNearby(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if the model throws', async () => {
        // Arrange
        const anchorId = getMockId('destination', 'err');
        asMock(modelMock.findNearby).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationNearbyInput = { destinationId: anchorId };

        // Act
        const result = await service.getNearby(actor, params);

        // Assert
        expectInternalError(result);
    });
});
