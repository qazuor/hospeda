import type { AccommodationModel, FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import {
    AccommodationFactoryBuilder,
    getMockAccommodationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.getAccommodationsByFeature', () => {
    let service: FeatureService;
    const logger = createLoggerMock();
    const ctx = { logger };

    const featureId = FeatureFactoryBuilder.create().id;
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerms = createActor({ role: RoleEnum.GUEST, permissions: [] });
    const feature = FeatureFactoryBuilder.create({ id: featureId });
    const accommodation = new AccommodationFactoryBuilder()
        .with({ id: getMockAccommodationId('acc-1') })
        .build();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should return accommodations for a given feature (happy path)', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(feature);
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [{ accommodationId: accommodation.id }]
        });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [accommodation] });

        const result = await service.getAccommodationsByFeature(actorWithPerms, {
            featureId
        });

        expect(result.data).toHaveProperty('accommodations');
        expect(Array.isArray(result.data?.accommodations)).toBe(true);
        expect(result.data?.accommodations[0]).toEqual(accommodation);
    });

    it('should return empty array if no accommodations found', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(feature);
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });

        const result = await service.getAccommodationsByFeature(actorWithPerms, {
            featureId
        });

        expect(result.data).toHaveProperty('accommodations');
        expect(result.data?.accommodations).toHaveLength(0);
    });

    it('should return NOT_FOUND if feature does not exist', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(null);

        const result = await service.getAccommodationsByFeature(actorWithPerms, {
            featureId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(feature);
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [{ accommodationId: accommodation.id }]
        });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [accommodation] });

        const result = await service.getAccommodationsByFeature(actorNoPerms, {
            featureId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return validation error for invalid input', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        const invalidFeatureId = '';

        const result = await service.getAccommodationsByFeature(actorWithPerms, {
            featureId: invalidFeatureId
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.getAccommodationsByFeature(actorWithPerms, { featureId });
        expectInternalError(result);
    });

    it('should allow minimal input (only required fields)', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(feature);
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });
        const minimalInput = { featureId };
        const result = await service.getAccommodationsByFeature(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('accommodations');
        expect(Array.isArray(result.data?.accommodations)).toBe(true);
    });

    it('should return FORBIDDEN for actor with unrelated permissions', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        const unrelatedActor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
        (model.findOne as Mock).mockResolvedValueOnce(feature);
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [{ accommodationId: accommodation.id }]
        });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [accommodation] });
        const result = await service.getAccommodationsByFeature(unrelatedActor, { featureId });
        expectForbiddenError(result);
    });

    it('should reject null for required fields', async () => {
        const model = createModelMock();
        service = new FeatureService(
            ctx,
            model as unknown as FeatureModel,
            model as unknown as RAccommodationFeatureModel,
            model as unknown as AccommodationModel
        );
        const result = await service.getAccommodationsByFeature(actorWithPerms, { featureId: '' });
        expectValidationError(result);
    });
});
