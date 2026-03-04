import type { FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import { getMockAccommodationId } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.getFeaturesForAccommodation', () => {
    const logger = createLoggerMock();
    const ctx = { logger };

    const accommodationId = getMockAccommodationId('acc-1');
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerms = createActor({ permissions: [] });
    const feature = FeatureFactoryBuilder.create();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should return features for a given accommodation (happy path)', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [{ featureId: feature.id, feature }],
            total: 1
        });

        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId
        });

        expect(result.data).toHaveProperty('features');
        expect(Array.isArray(result.data?.features)).toBe(true);
        expect(result.data?.features[0]).toEqual(feature);
    });

    it('should return empty array if no features found', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [],
            total: 0
        });

        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId
        });

        expect(result.data).toHaveProperty('features');
        expect(result.data?.features).toHaveLength(0);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        (model.findAll as Mock).mockResolvedValueOnce({ items: [{ featureId: feature.id }] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [feature] });

        const result = await service.getFeaturesForAccommodation(actorNoPerms, {
            accommodationId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return validation error for invalid input', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        const invalidAccommodationId = '';

        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId: invalidAccommodationId
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        (model.findAllWithRelations as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId
        });
        expectInternalError(result);
    });

    it('should allow minimal input (only required fields)', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [],
            total: 0
        });
        const minimalInput = { accommodationId };
        const result = await service.getFeaturesForAccommodation(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('features');
        expect(Array.isArray(result.data?.features)).toBe(true);
    });

    it('should return FORBIDDEN for actor with unrelated permissions', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        const unrelatedActor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [{ featureId: feature.id }] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [feature] });
        const result = await service.getFeaturesForAccommodation(unrelatedActor, {
            accommodationId
        });
        expectForbiddenError(result);
    });

    it('should reject null for required fields', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId: ''
        });
        expectValidationError(result);
    });

    it('should return features sorted by displayWeight DESC', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        const featureLow = FeatureFactoryBuilder.create({
            id: getMockId('feature', 'feat-low') as (typeof feature)['id'],
            displayWeight: 10
        });
        const featureMid = FeatureFactoryBuilder.create({
            id: getMockId('feature', 'feat-mid') as (typeof feature)['id'],
            displayWeight: 50
        });
        const featureHigh = FeatureFactoryBuilder.create({
            id: getMockId('feature', 'feat-high') as (typeof feature)['id'],
            displayWeight: 90
        });

        // Return in random order - service should sort them
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [
                { featureId: featureMid.id, feature: featureMid },
                { featureId: featureLow.id, feature: featureLow },
                { featureId: featureHigh.id, feature: featureHigh }
            ],
            total: 3
        });

        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId
        });

        const features = result.data?.features;
        expect(features).toHaveLength(3);
        expect(features?.[0]?.displayWeight).toBe(90);
        expect(features?.[1]?.displayWeight).toBe(50);
        expect(features?.[2]?.displayWeight).toBe(10);
    });

    it('should handle features with undefined displayWeight using default of 50', async () => {
        const model = createModelMock();
        const service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel
        );
        const featureNoWeight = FeatureFactoryBuilder.create({
            id: getMockId('feature', 'feat-no') as (typeof feature)['id']
        });
        (featureNoWeight as any).displayWeight = undefined;
        const featureHigh = FeatureFactoryBuilder.create({
            id: getMockId('feature', 'feat-high') as (typeof feature)['id'],
            displayWeight: 90
        });

        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [
                { featureId: featureNoWeight.id, feature: featureNoWeight },
                { featureId: featureHigh.id, feature: featureHigh }
            ],
            total: 2
        });

        const result = await service.getFeaturesForAccommodation(actorWithPerms, {
            accommodationId
        });

        expect(result.data?.features).toHaveLength(2);
        // High weight (90) should be first, undefined defaults to 50
        expect(result.data?.features?.[0]?.displayWeight).toBe(90);
    });
});
