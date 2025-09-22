import type { FeatureModel } from '@repo/db';
import { type Feature, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.setFeaturedStatus', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const feature = FeatureFactoryBuilder.create({ name: 'Test Feature', isFeatured: false });
    const featuredFeature = { ...feature, isFeatured: true };

    beforeEach(() => {
        featureModelMock = createModelMock(['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should set isFeatured to true (success)', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockResolvedValue(featuredFeature);
        const result = await service.setFeaturedStatus({
            actor,
            id: feature.id,
            isFeatured: true
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(true);
    });

    it('should set isFeatured to false (success)', async () => {
        featureModelMock.findById.mockResolvedValue(featuredFeature);
        featureModelMock.update.mockResolvedValue(feature);
        const result = await service.setFeaturedStatus({
            actor,
            id: feature.id,
            isFeatured: false
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(true);
    });

    it('should return NOT_FOUND if feature does not exist', async () => {
        featureModelMock.findById.mockResolvedValue(undefined);
        const result = await service.setFeaturedStatus({
            actor,
            id: 'nonexistent-id' as Feature['id'],
            isFeatured: true
        });
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const forbiddenActor = createActor({ permissions: [] });
        featureModelMock.findById.mockResolvedValue(feature);
        const result = await service.setFeaturedStatus({
            actor: forbiddenActor,
            id: feature.id,
            isFeatured: true
        });
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findById.mockRejectedValue(new Error('DB error'));
        const result = await service.setFeaturedStatus({
            actor,
            id: feature.id,
            isFeatured: true
        });
        expectInternalError(result);
    });

    it('should return updated: false if isFeatured is already the requested value', async () => {
        featureModelMock.findById.mockResolvedValue(featuredFeature);
        // No update should be called
        const result = await service.setFeaturedStatus({
            actor,
            id: featuredFeature.id,
            isFeatured: true
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(false);
    });
});
