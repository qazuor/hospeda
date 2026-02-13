/**
 * @file getChildren.test.ts
 * @description Unit tests for DestinationService.getChildren.
 *   Covers success, model error, and validation error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationChildrenInput } from '@repo/schemas';
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

describe('DestinationService.getChildren', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findChildren']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return children for a valid destination', async () => {
        // Arrange
        const parentId = getMockId('destination', 'parent');
        const child1 = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'child-1'),
                name: 'Child City 1',
                slug: 'child-city-1',
                parentDestinationId: parentId,
                destinationType: DestinationTypeEnum.CITY,
                level: 4
            })
            .build();
        const child2 = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'child-2'),
                name: 'Child City 2',
                slug: 'child-city-2',
                parentDestinationId: parentId,
                destinationType: DestinationTypeEnum.CITY,
                level: 4
            })
            .build();
        asMock(modelMock.findChildren).mockResolvedValue([child1, child2]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationChildrenInput = { destinationId: parentId };

        // Act
        const result = await service.getChildren(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.children).toHaveLength(2);
        expect(result.data?.children[0]?.name).toBe('Child City 1');
        expect(result.data?.children[1]?.name).toBe('Child City 2');
        expect(asMock(modelMock.findChildren)).toHaveBeenCalledWith(parentId);
    });

    it('should return empty array when destination has no children', async () => {
        // Arrange
        const parentId = getMockId('destination', 'no-children');
        asMock(modelMock.findChildren).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationChildrenInput = { destinationId: parentId };

        // Act
        const result = await service.getChildren(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.children).toHaveLength(0);
    });

    it('should return VALIDATION_ERROR for invalid destinationId', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: 'not-a-uuid' } as unknown as GetDestinationChildrenInput;

        // Act
        const result = await service.getChildren(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const parentId = getMockId('destination', 'error-parent');
        asMock(modelMock.findChildren).mockRejectedValue(new Error('DB connection lost'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationChildrenInput = { destinationId: parentId };

        // Act
        const result = await service.getChildren(actor, params);

        // Assert
        expectInternalError(result);
    });
});
