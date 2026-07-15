import { DestinationModel } from '@repo/db';
import type { GetDestinationPointsOfInterestInput } from '@repo/schemas';
import { PointOfInterestDestinationRelationEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
/**
 * @file getPointsOfInterest.test.ts
 * @description Unit tests for DestinationService.getPointsOfInterest (HOS-146).
 * Covers success (PRIMARY / NEARBY / ALL / default), not found, forbidden, and
 * internal error cases, mirroring getStats.test.ts's structure.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

const buildPoi = (overrides: Record<string, unknown> = {}) => ({
    id: getMockId('pointOfInterest', 'autodromo'),
    slug: 'autodromo',
    lat: -32.48,
    long: -58.24,
    type: 'STADIUM',
    nameI18n: null,
    description: null,
    descriptionI18n: null,
    icon: null,
    hasOwnPage: false,
    isFeatured: false,
    isBuiltin: false,
    displayWeight: 80,
    relation: 'PRIMARY',
    // HOS-182: always present on a real model row (object or null) — see
    // `DestinationModel.getPointsOfInterestMap`.
    primaryCategory: null,
    ...overrides
});

describe('DestinationService.getPointsOfInterest', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, []);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
    });

    it('should return the points of interest for a valid destination (default relation = ALL)', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        const primaryPoi = buildPoi({ relation: 'PRIMARY' });
        const nearbyPoi = buildPoi({
            id: getMockId('pointOfInterest', 'termas'),
            slug: 'termas',
            relation: 'NEARBY'
        });
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(
            new Map([[destination.id, [primaryPoi, nearbyPoi]]])
        );
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest).toEqual([primaryPoi, nearbyPoi]);
        // Default relation resolved by the input schema is 'ALL' — verify the
        // model is asked for both kinds, not just PRIMARY.
        expect(modelMock.getPointsOfInterestMap).toHaveBeenCalledWith(
            [destination.id],
            undefined,
            'ALL'
        );
    });

    it('should forward an explicit relation=PRIMARY filter to the model', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        const primaryPoi = buildPoi({ relation: 'PRIMARY' });
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(
            new Map([[destination.id, [primaryPoi]]])
        );
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id,
            relation: PointOfInterestDestinationRelationEnum.PRIMARY
        };

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest).toEqual([primaryPoi]);
        expect(modelMock.getPointsOfInterestMap).toHaveBeenCalledWith(
            [destination.id],
            undefined,
            'PRIMARY'
        );
    });

    it('should forward an explicit relation=NEARBY filter to the model', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        const nearbyPoi = buildPoi({ relation: 'NEARBY' });
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(
            new Map([[destination.id, [nearbyPoi]]])
        );
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        };

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest).toEqual([nearbyPoi]);
        expect(modelMock.getPointsOfInterestMap).toHaveBeenCalledWith(
            [destination.id],
            undefined,
            'NEARBY'
        );
    });

    it('should return an empty array when the destination has no points of interest', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(new Map());
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest).toEqual([]);
    });

    // ========================================================================
    // HOS-182: primaryCategory pass-through (no explicit pick/mapper strips it)
    // ========================================================================
    it('passes a non-null primaryCategory straight through from the model row', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        const nameI18n = { es: 'Recinto deportivo', en: 'Sports venue', pt: 'Recinto esportivo' };
        const poiWithCategory = buildPoi({
            primaryCategory: { slug: 'sports_venue', nameI18n }
        });
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(
            new Map([[destination.id, [poiWithCategory]]])
        );
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest?.[0]?.primaryCategory).toEqual({
            slug: 'sports_venue',
            nameI18n
        });
    });

    it('passes a null primaryCategory straight through when the POI has no primary category', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC })
            .build();
        const poiWithoutCategory = buildPoi({ primaryCategory: null });
        asMock(modelMock.findById).mockResolvedValue(destination);
        asMock((modelMock as any).getPointsOfInterestMap).mockResolvedValue(
            new Map([[destination.id, [poiWithoutCategory]]])
        );
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectSuccess(result);
        expect(result.data?.pointsOfInterest?.[0]?.primaryCategory).toBeNull();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(null);
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: getMockId('destination')
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor cannot view the destination', async () => {
        // Arrange
        const destination = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PRIVATE })
            .build();
        asMock(modelMock.findById).mockResolvedValue(destination);
        const actor = { id: 'user-1', role: RoleEnum.USER, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: destination.id
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if the model throws', async () => {
        // Arrange
        asMock(modelMock.findById).mockRejectedValue(new Error('DB error'));
        const actor = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };
        const params: GetDestinationPointsOfInterestInput = {
            destinationId: getMockId('destination')
        } as GetDestinationPointsOfInterestInput;

        // Act
        const result = await service.getPointsOfInterest(actor, params);

        // Assert
        expectInternalError(result);
    });
});
