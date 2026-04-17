/**
 * @file getDescendants.test.ts
 * @description Unit tests for DestinationService.getDescendants.
 *   Covers success, maxDepth filter, destinationType filter, validation, and error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationDescendantsInput } from '@repo/schemas';
import { DestinationTypeEnum, RoleEnum } from '@repo/schemas';
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

describe('DestinationService.getDescendants', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findDescendants']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return all descendants for a valid destination', async () => {
        // Arrange
        const parentId = getMockId('destination', 'country');
        const region = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'region'),
                name: 'Litoral',
                slug: 'litoral',
                destinationType: DestinationTypeEnum.REGION,
                level: 1
            })
            .build();
        const province = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'province'),
                name: 'Entre Rios',
                slug: 'entre-rios',
                destinationType: DestinationTypeEnum.PROVINCE,
                level: 2
            })
            .build();
        asMock(modelMock.findDescendants).mockResolvedValue([region, province]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationDescendantsInput = { destinationId: parentId };

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.descendants).toHaveLength(2);
        expect(asMock(modelMock.findDescendants)).toHaveBeenCalledWith(
            parentId,
            { maxDepth: undefined, destinationType: undefined },
            undefined
        );
    });

    it('should pass maxDepth filter to model', async () => {
        // Arrange
        const parentId = getMockId('destination', 'country-depth');
        const region = new DestinationFactoryBuilder()
            .with({
                destinationType: DestinationTypeEnum.REGION,
                level: 1
            })
            .build();
        asMock(modelMock.findDescendants).mockResolvedValue([region]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationDescendantsInput = {
            destinationId: parentId,
            maxDepth: 1
        };

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectSuccess(result);
        expect(asMock(modelMock.findDescendants)).toHaveBeenCalledWith(
            parentId,
            { maxDepth: 1, destinationType: undefined },
            undefined
        );
    });

    it('should pass destinationType filter to model', async () => {
        // Arrange
        const parentId = getMockId('destination', 'country-type');
        const city = new DestinationFactoryBuilder()
            .with({
                destinationType: DestinationTypeEnum.CITY,
                level: 4
            })
            .build();
        asMock(modelMock.findDescendants).mockResolvedValue([city]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationDescendantsInput = {
            destinationId: parentId,
            destinationType: DestinationTypeEnum.CITY
        };

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectSuccess(result);
        expect(asMock(modelMock.findDescendants)).toHaveBeenCalledWith(
            parentId,
            { maxDepth: undefined, destinationType: DestinationTypeEnum.CITY },
            undefined
        );
    });

    it('should return empty array when no descendants exist', async () => {
        // Arrange
        const parentId = getMockId('destination', 'leaf');
        asMock(modelMock.findDescendants).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationDescendantsInput = { destinationId: parentId };

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.descendants).toHaveLength(0);
    });

    it('should return VALIDATION_ERROR for invalid destinationId', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = {
            destinationId: 'bad-id'
        } as unknown as GetDestinationDescendantsInput;

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR for maxDepth out of range', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = {
            destinationId: getMockId('destination', 'depth-err'),
            maxDepth: 0
        } as unknown as GetDestinationDescendantsInput;

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const parentId = getMockId('destination', 'error');
        asMock(modelMock.findDescendants).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationDescendantsInput = { destinationId: parentId };

        // Act
        const result = await service.getDescendants(actor, params);

        // Assert
        expectInternalError(result);
    });
});
