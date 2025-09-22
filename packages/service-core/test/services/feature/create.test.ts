import type { FeatureModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
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

const input = {
    name: 'Test Feature',
    icon: '⭐',
    description: 'A test feature',
    isFeatured: false
};
const createdFeature = FeatureFactoryBuilder.create({ ...input });

describe('FeatureService.create', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        featureModelMock = createModelMock(['create', 'findOne']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should create a feature (success)', async () => {
        featureModelMock.findOne.mockResolvedValue(null); // uniqueness
        featureModelMock.create.mockResolvedValue(createdFeature);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject(input);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.create(actor, { ...input, name: '' });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });

    it('should generate a unique slug if name is duplicated', async () => {
        featureModelMock.findOne
            .mockResolvedValueOnce(null) // first slug is unique
            .mockResolvedValueOnce({ ...createdFeature, slug: 'test-feature' }) // second slug exists
            .mockResolvedValueOnce(null) // unique after suffix
            .mockResolvedValue(null); // all subsequent calls return null
        featureModelMock.create.mockResolvedValueOnce(createdFeature);
        featureModelMock.create.mockResolvedValueOnce({
            ...createdFeature,
            slug: 'test-feature-2'
        });
        // First creation
        const result1 = await service.create(actor, input);
        expectSuccess(result1);
        expect(result1.data?.slug).toBe('test-feature');
        // Second creation with same name
        const result2 = await service.create(actor, input);
        expectSuccess(result2);
        expect(result2.data?.slug).toMatch(/^test-feature(-\d+)?$/);
        expect(result2.data?.slug).not.toBe(result1.data?.slug);
    });

    it('should allow omitting optional fields', async () => {
        featureModelMock.findOne.mockResolvedValue(null);
        featureModelMock.create.mockResolvedValue({
            ...createdFeature,
            icon: undefined,
            description: undefined
        });
        const minimalInput = { name: 'Minimal Feature', isFeatured: false };
        const result = await service.create(actor, minimalInput);
        expectSuccess(result);
        expect(result.data?.icon).toBeUndefined();
        expect(result.data?.description).toBeUndefined();
    });

    it('should reject null for required fields', async () => {
        // @ts-expect-error
        const result = await service.create(actor, { ...input, name: null });
        expectValidationError(result);
    });
});
