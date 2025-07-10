import type { AccommodationModel, FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
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

describe('FeatureService.addFeatureToAccommodation', () => {
    let service: FeatureService;
    let featureModel: ReturnType<typeof createModelMock>;
    let relatedModel: ReturnType<typeof createModelMock>;
    let accommodationModel: ReturnType<typeof createModelMock>;
    const logger = createLoggerMock();
    const ctx = { logger };

    const validInput = {
        accommodationId: getMockAccommodationId('acc-1'),
        featureId: FeatureFactoryBuilder.create().id,
        hostReWriteName: 'Custom Name',
        comments: 'Test comment'
    };
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerms = createActor({ permissions: [] });
    const feature = FeatureFactoryBuilder.create({ id: validInput.featureId });
    const accommodation = new AccommodationFactoryBuilder()
        .with({ id: validInput.accommodationId })
        .build();

    beforeEach(() => {
        featureModel = createModelMock(['findOne']);
        relatedModel = createModelMock(['findOne', 'create']);
        accommodationModel = createModelMock(['findOne']);
        service = new FeatureService(
            ctx,
            featureModel as unknown as FeatureModel,
            relatedModel as unknown as RAccommodationFeatureModel,
            accommodationModel as unknown as AccommodationModel
        );
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should add a feature to an accommodation (happy path)', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature); // Feature exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation); // Accommodation exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null); // No existing relation
        (relatedModel.create as Mock).mockResolvedValueOnce({ ...validInput });

        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);

        expect(result.data).toHaveProperty('relation');
        expect(relatedModel.create as Mock).toHaveBeenCalledWith({
            accommodationId: validInput.accommodationId,
            featureId: validInput.featureId,
            hostReWriteName: validInput.hostReWriteName,
            comments: validInput.comments
        });
    });

    it('should throw NOT_FOUND if feature does not exist', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(null); // Feature does not exist

        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should throw NOT_FOUND if accommodation does not exist', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature); // Feature exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(null); // Accommodation does not exist

        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should throw ALREADY_EXISTS if relation already exists', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature); // Feature exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation); // Accommodation exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce({ ...validInput }); // Relation exists

        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('should throw FORBIDDEN if actor lacks permission', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature); // Feature exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation); // Accommodation exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null); // No existing relation

        const result = await service.addFeatureToAccommodation(actorNoPerms, validInput);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should throw validation error for invalid input', async () => {
        const invalidInput = { ...validInput, accommodationId: '' };

        const result = await service.addFeatureToAccommodation(
            actorWithPerms,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            invalidInput as any
        );
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if feature model throws', async () => {
        (featureModel.findOne as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if accommodation model throws', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature);
        (accommodationModel.findOne as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if related model throws', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature);
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation);
        (relatedModel.findOne as Mock).mockRejectedValueOnce(new Error('DB error'));
        const result = await service.addFeatureToAccommodation(actorWithPerms, validInput);
        expectInternalError(result);
    });

    it('should allow omitting optional fields', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature);
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);
        (relatedModel.create as Mock).mockResolvedValueOnce({
            ...validInput,
            hostReWriteName: undefined,
            comments: undefined
        });
        const minimalInput = {
            accommodationId: validInput.accommodationId,
            featureId: validInput.featureId
        };
        const result = await service.addFeatureToAccommodation(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('relation');
        expect(result.data?.relation.hostReWriteName).toBeUndefined();
        expect(result.data?.relation.comments).toBeUndefined();
    });

    it('should reject null for required fields', async () => {
        const result = await service.addFeatureToAccommodation(actorWithPerms, {
            ...validInput,
            accommodationId: ''
        });
        expectValidationError(result);
    });

    it('should throw ALREADY_EXISTS if called twice with same input', async () => {
        (featureModel.findOne as Mock).mockResolvedValue(feature);
        (accommodationModel.findOne as Mock).mockResolvedValue(accommodation);
        (relatedModel.findOne as Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ ...validInput });
        (relatedModel.create as Mock).mockResolvedValueOnce({ ...validInput });
        // First call
        const result1 = await service.addFeatureToAccommodation(actorWithPerms, validInput);
        expect(result1.data).toHaveProperty('relation');
        // Second call
        const result2 = await service.addFeatureToAccommodation(actorWithPerms, validInput);
        expect(result2.error).toBeDefined();
        expect(result2.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('should return FORBIDDEN for actor with unrelated permissions', async () => {
        const unrelatedActor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature);
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);
        const result = await service.addFeatureToAccommodation(unrelatedActor, validInput);
        expectForbiddenError(result);
    });

    it('should allow minimal input (only required fields)', async () => {
        (featureModel.findOne as Mock).mockResolvedValueOnce(feature);
        (accommodationModel.findOne as Mock).mockResolvedValueOnce(accommodation);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);
        (relatedModel.create as Mock).mockResolvedValueOnce({
            accommodationId: validInput.accommodationId,
            featureId: validInput.featureId
        });
        const minimalInput = {
            accommodationId: validInput.accommodationId,
            featureId: validInput.featureId
        };
        const result = await service.addFeatureToAccommodation(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('relation');
        expect(result.data?.relation.accommodationId).toBe(validInput.accommodationId);
        expect(result.data?.relation.featureId).toBe(validInput.featureId);
    });
});
