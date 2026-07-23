/**
 * @file getByPath.test.ts
 * @description Unit tests for DestinationService.getByPath.
 *   Covers success, not found, validation, and error cases.
 */

import { DestinationModel } from '@repo/db';
import type { GetDestinationByPathInput } from '@repo/schemas';
import { DestinationTypeEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
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

describe('DestinationService.getByPath', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, [
            'findByPath',
            'getAttractionsMap',
            'getPointsOfInterestMap'
        ]);
        // Default the attractions/POI hydration to empty maps; specific tests
        // can override this when they want to assert on populated relations.
        asMock(modelMock.getAttractionsMap).mockResolvedValue(new Map());
        asMock(modelMock.getPointsOfInterestMap).mockResolvedValue(new Map());
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
        // getByPath reads soft-deleted rows too (includeDeleted = true) and lets
        // checkCanViewDestination decide the outcome, mirroring getBySlug.
        expect(asMock(modelMock.findByPath)).toHaveBeenCalledWith(params.path, undefined, true);
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

    // HOS-117 T-022: getByPath must route the row through checkCanViewDestination
    // (like getBySlug) instead of relying on the model's SQL deletedAt filter, so
    // the 410 GONE path is reachable for the common multi-segment destination URL
    // and live PRIVATE/RESTRICTED destinations do not leak via path.
    it('should throw GONE for a soft-deleted PUBLIC destination reached by a multi-segment path', async () => {
        // Arrange
        const path = '/argentina/entre-rios/colon';
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Colon',
                slug: 'colon',
                path,
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: new Date()
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetDestinationByPathInput = { path };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expect(result.error?.code).toBe('GONE');
        // Reads soft-deleted rows so the gate — not the SQL filter — decides.
        expect(asMock(modelMock.findByPath)).toHaveBeenCalledWith(path, undefined, true);
    });

    it('should enforce visibility (FORBIDDEN) for a live PRIVATE destination reached by path', async () => {
        // Arrange
        const path = '/argentina/entre-rios/secret';
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Secret',
                slug: 'secret',
                path,
                visibility: VisibilityEnum.PRIVATE,
                deletedAt: undefined
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetDestinationByPathInput = { path };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectForbiddenError(result);
    });

    it('should succeed for a live PUBLIC destination reached by path', async () => {
        // Arrange
        const path = '/argentina/entre-rios/gualeguaychu';
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Gualeguaychu',
                slug: 'gualeguaychu',
                path,
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: undefined
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetDestinationByPathInput = { path };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Gualeguaychu');
    });

    it('should allow staff with DESTINATION_VIEW_ALL to reach a soft-deleted destination by path', async () => {
        // Arrange
        const path = '/argentina/entre-rios/colon';
        const destination = new DestinationFactoryBuilder()
            .with({
                name: 'Colon',
                slug: 'colon',
                path,
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: new Date()
            })
            .build();
        asMock(modelMock.findByPath).mockResolvedValue(destination);
        const actor = {
            id: 'staff-1',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.DESTINATION_VIEW_ALL]
        };
        const params: GetDestinationByPathInput = { path };

        // Act
        const result = await service.getByPath(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.name).toBe('Colon');
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
