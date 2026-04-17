/**
 * @file getByPath.test.ts
 * @description Unit tests for DestinationService.getByPath.
 *   Covers success, not found, validation, and error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationByPathInput } from '@repo/schemas';
import { DestinationTypeEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import {
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.getByPath', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findByPath']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return a destination by its materialized path', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Concepcion del Uruguay',
                slug: 'concepcion-del-uruguay',
                destinationType: DestinationTypeEnum.CITY,
                level: 4,
                path: '/argentina/litoral/entre-rios/departamento-uruguay/concepcion-del-uruguay'
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationByPathInput = {
            path: '/argentina/litoral/entre-rios/departamento-uruguay/concepcion-del-uruguay'
        };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Concepcion del Uruguay');
        expect(asMock(modelMock.findByPath)).toHaveBeenCalledWith(params.path, undefined);
    });

    it('should return a root-level destination by path', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Argentina',
                slug: 'argentina',
                destinationType: DestinationTypeEnum.COUNTRY,
                level: 0,
                path: '/argentina'
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationByPathInput = { path: '/argentina' };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Argentina');
    });

    it('should return NOT_FOUND if path does not match any destination', async () => {
        // Arrange
        asMock(modelMock.findByPath).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationByPathInput = { path: '/nonexistent/path' };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for empty path', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { path: '' } as unknown as GetDestinationByPathInput;

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR for path without leading slash', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { path: 'argentina/litoral' } as unknown as GetDestinationByPathInput;

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR for path with uppercase characters', async () => {
        // Arrange
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params = { path: '/Argentina/Litoral' } as unknown as GetDestinationByPathInput;

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(modelMock.findByPath).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationByPathInput = { path: '/argentina' };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectInternalError(result);
    });
});
