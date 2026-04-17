/**
 * @file getAncestors.test.ts
 * @description Unit tests for DestinationService.getAncestors.
 *   Covers success, empty ancestors (root node), validation, and error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationAncestorsInput } from '@repo/schemas';
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

describe('DestinationService.getAncestors', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findAncestors']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return ancestors from root to parent', async () => {
        // Arrange
        const cityId = getMockId('destination', 'city');
        const country = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'country'),
                name: 'Argentina',
                slug: 'argentina',
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 0,
                parentDestinationId: null,
                path: '/argentina'
            })
            .build();
        const region = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'region'),
                name: 'Litoral',
                slug: 'litoral',
                destinationType: DestinationTypeEnum.REGION,
                level: 1,
                parentDestinationId: country.id,
                path: '/argentina/litoral'
            })
            .build();
        const province = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'province'),
                name: 'Entre Rios',
                slug: 'entre-rios',
                destinationType: DestinationTypeEnum.PROVINCE,
                level: 2,
                parentDestinationId: region.id,
                path: '/argentina/litoral/entre-rios'
            })
            .build();
        asMock(modelMock.findAncestors).mockResolvedValue([country, region, province]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationAncestorsInput = { destinationId: cityId };

        // Act
        const result = await service.getAncestors(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.ancestors).toHaveLength(3);
        expect(result.data?.ancestors[0]?.name).toBe('Argentina');
        expect(result.data?.ancestors[1]?.name).toBe('Litoral');
        expect(result.data?.ancestors[2]?.name).toBe('Entre Rios');
        expect(asMock(modelMock.findAncestors)).toHaveBeenCalledWith(cityId, undefined);
    });

    it('should return empty array for root-level destination', async () => {
        // Arrange
        const countryId = getMockId('destination', 'root');
        asMock(modelMock.findAncestors).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationAncestorsInput = { destinationId: countryId };

        // Act
        const result = await service.getAncestors(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.ancestors).toHaveLength(0);
    });

    it('should return VALIDATION_ERROR for invalid destinationId', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: '' } as unknown as GetDestinationAncestorsInput;

        // Act
        const result = await service.getAncestors(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const id = getMockId('destination', 'err');
        asMock(modelMock.findAncestors).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationAncestorsInput = { destinationId: id };

        // Act
        const result = await service.getAncestors(actor, params);

        // Assert
        expectInternalError(result);
    });
});
