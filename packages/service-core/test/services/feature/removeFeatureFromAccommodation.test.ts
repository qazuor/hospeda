import type { FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import { getMockAccommodationId } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.removeFeatureFromAccommodation', () => {
    let service: FeatureService;
    let featureModel: ReturnType<typeof createModelMock>;
    let relatedModel: ReturnType<typeof createModelMock>;
    let logger: ReturnType<typeof createLoggerMock>;

    const accommodationId = getMockAccommodationId('acc-1');
    const featureId = FeatureFactoryBuilder.create().id;
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerms = createActor({ permissions: [] });

    const mockRelation = {
        id: 'rel-1',
        accommodationId,
        featureId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
    };
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        featureModel = createModelMock();
        relatedModel = createModelMock();
        logger = createLoggerMock();
        service = new FeatureService(
            { logger },
            featureModel as unknown as FeatureModel,
            relatedModel as unknown as RAccommodationFeatureModel
        );
    });

    it('should remove a feature from an accommodation (success)', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockResolvedValueOnce({
            ...mockRelation,
            deletedAt: new Date()
        });

        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });

        expect(result.data).toHaveProperty('relation');
        expect(result.data?.relation.accommodationId).toBe(accommodationId);
        expect(result.data?.relation.featureId).toBe(featureId);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if relation does not exist (implies feature not linked)', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);

        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if softDelete fails', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockResolvedValueOnce(null);

        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);

        const result = await service.removeFeatureFromAccommodation(actorNoPerms, {
            accommodationId,
            featureId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId: '',
            featureId: ''
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if related model findOne throws', async () => {
        (relatedModel.findOne as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if softDelete throws', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });
        expectInternalError(result);
    });

    it('should allow idempotent removal (already deleted relation)', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId,
            featureId
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should reject null for required fields', async () => {
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, {
            accommodationId: '',
            featureId
        });
        expectValidationError(result);
    });

    it('should return FORBIDDEN for actor with unrelated permissions', async () => {
        const unrelatedActor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        const result = await service.removeFeatureFromAccommodation(unrelatedActor, {
            accommodationId,
            featureId
        });
        expectForbiddenError(result);
    });

    it('should allow minimal input (only required fields)', async () => {
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockResolvedValueOnce({
            ...mockRelation,
            deletedAt: new Date()
        });
        const minimalInput = { accommodationId, featureId };
        const result = await service.removeFeatureFromAccommodation(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('relation');
        expect(result.data?.relation.accommodationId).toBe(accommodationId);
        expect(result.data?.relation.featureId).toBe(featureId);
    });
});
