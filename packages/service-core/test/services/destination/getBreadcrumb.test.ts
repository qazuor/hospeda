/**
 * @file getBreadcrumb.test.ts
 * @description Unit tests for DestinationService.getBreadcrumb.
 *   Covers success, not found, root-level breadcrumb, validation, and error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationBreadcrumbInput } from '@repo/schemas';
import { DestinationTypeEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.getBreadcrumb', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findAncestors']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return breadcrumb from root to current destination', async () => {
        // Arrange
        const country = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'country'),
                name: 'Argentina',
                slug: 'argentina',
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 0,
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
                path: '/argentina/litoral'
            })
            .build();
        const city = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'city'),
                name: 'Concepcion del Uruguay',
                slug: 'concepcion-del-uruguay',
                destinationType: DestinationTypeEnum.CITY,
                level: 4,
                path: '/argentina/litoral/entre-rios/departamento-uruguay/concepcion-del-uruguay'
            })
            .build();

        asMock(modelMock.findOne).mockResolvedValue(city);
        asMock(modelMock.findAncestors).mockResolvedValue([country, region]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = { destinationId: city.id };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectSuccess(result);
        const breadcrumb = result.data?.breadcrumb;
        expect(breadcrumb).toHaveLength(3);
        // First items are ancestors (root to nearest)
        expect(breadcrumb?.[0]?.name).toBe('Argentina');
        expect(breadcrumb?.[0]?.destinationType).toBe(DestinationTypeEnum.COUNTRY);
        expect(breadcrumb?.[1]?.name).toBe('Litoral');
        expect(breadcrumb?.[1]?.destinationType).toBe(DestinationTypeEnum.REGION);
        // Last item is the current destination
        expect(breadcrumb?.[2]?.name).toBe('Concepcion del Uruguay');
        expect(breadcrumb?.[2]?.destinationType).toBe(DestinationTypeEnum.CITY);
    });

    it('should return single-item breadcrumb for root-level destination', async () => {
        // Arrange
        const country = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'root'),
                name: 'Argentina',
                slug: 'argentina',
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 0,
                path: '/argentina',
                parentDestinationId: null
            })
            .build();

        asMock(modelMock.findOne).mockResolvedValue(country);
        asMock(modelMock.findAncestors).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = { destinationId: country.id };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.breadcrumb).toHaveLength(1);
        expect(result.data?.breadcrumb[0]?.name).toBe('Argentina');
    });

    it('should include correct fields in each breadcrumb item', async () => {
        // Arrange
        const city = new DestinationFactoryBuilder()
            .with({
                id: getMockId('destination', 'check-fields'),
                name: 'Test City',
                slug: 'test-city',
                destinationType: DestinationTypeEnum.CITY,
                level: 4,
                path: '/argentina/litoral/entre-rios/dept/test-city'
            })
            .build();

        asMock(modelMock.findOne).mockResolvedValue(city);
        asMock(modelMock.findAncestors).mockResolvedValue([]);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = { destinationId: city.id };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectSuccess(result);
        const item = result.data?.breadcrumb[0];
        expect(item).toEqual({
            id: city.id,
            slug: 'test-city',
            name: 'Test City',
            level: 4,
            destinationType: DestinationTypeEnum.CITY,
            path: '/argentina/litoral/entre-rios/dept/test-city'
        });
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = {
            destinationId: getMockId('destination', 'missing')
        };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { destinationId: 'bad' } as unknown as GetDestinationBreadcrumbInput;

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws on findOne', async () => {
        // Arrange
        asMock(modelMock.findOne).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = {
            destinationId: getMockId('destination', 'err')
        };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if model throws on findAncestors', async () => {
        // Arrange
        const city = new DestinationFactoryBuilder().build();
        asMock(modelMock.findOne).mockResolvedValue(city);
        asMock(modelMock.findAncestors).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationBreadcrumbInput = { destinationId: city.id };

        // Act
        const result = await service.getBreadcrumb(actor, params);

        // Assert
        expectInternalError(result);
    });
});
