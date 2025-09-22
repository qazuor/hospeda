import type { FeatureModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const feature = FeatureFactoryBuilder.create({ name: 'Test Feature' });
const updateInput = { name: 'Updated Feature' };

describe('FeatureService.update', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        featureModelMock = createModelMock(['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should update a feature (success)', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockResolvedValue({ ...feature, ...updateInput });
        const result = await service.update(actor, feature.id, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(updateInput);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        featureModelMock.findById.mockResolvedValue(feature);
        const result = await service.update(actor, feature.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.update(actor, feature.id, { ...updateInput, name: '' });
        expectValidationError(result);
    });

    it('should return NOT_FOUND if feature does not exist', async () => {
        featureModelMock.findById.mockResolvedValue(null);
        const result = await service.update(actor, 'nonexistent-id', updateInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, feature.id, updateInput);
        expectInternalError(result);
    });

    it('should allow partial update (only description)', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockResolvedValue({
            ...feature,
            description: 'New description with enough characters'
        });
        const result = await service.update(actor, feature.id, {
            description: 'New description with enough characters'
        });
        expectSuccess(result);
        expect(result.data?.description).toBe('New description with enough characters');
        expect(result.data?.name).toBe(feature.name);
    });

    it('should reject null for required fields', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        // @ts-expect-error
        const result = await service.update(actor, feature.id, { name: null });
        expectValidationError(result);
    });

    it('should allow omitting optional fields in update', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockResolvedValue({ ...feature });
        const result = await service.update(actor, feature.id, {});
        expectSuccess(result);
        expect(result.data?.name).toBe(feature.name);
    });

    it('should update isFeatured only', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.update.mockResolvedValue({ ...feature, isFeatured: true });
        const result = await service.update(actor, feature.id, { isFeatured: true });
        expectSuccess(result);
        expect(result.data?.isFeatured).toBe(true);
    });

    it('should generate a unique slug if name is duplicated', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.findOne
            .mockResolvedValueOnce(null) // first slug is unique
            .mockResolvedValueOnce({ ...updateInput, slug: 'test-feature' }) // second slug exists
            .mockResolvedValueOnce(null) // unique after suffix
            .mockResolvedValue(null); // all subsequent calls return null
        featureModelMock.update.mockResolvedValueOnce({
            ...feature,
            ...updateInput,
            slug: 'test-feature'
        });
        featureModelMock.update.mockResolvedValueOnce({
            ...feature,
            ...updateInput,
            slug: 'test-feature-2'
        });
        // First update
        const result1 = await service.update(actor, feature.id, updateInput);
        expectSuccess(result1);
        expect(result1.data?.slug).toBe('test-feature');
        // Second update with same name
        const result2 = await service.update(actor, feature.id, updateInput);
        expectSuccess(result2);
        expect(result2.data?.slug).toMatch(/^test-feature(-\d+)?$/);
        expect(result2.data?.slug).not.toBe(result1.data?.slug);
    });
});
