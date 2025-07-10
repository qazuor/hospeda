import type { FeatureModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.getById', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const feature = FeatureFactoryBuilder.create({ name: 'Test Feature' });

    beforeEach(() => {
        featureModelMock = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [] });
    });

    it('should return a feature by id (success)', async () => {
        featureModelMock.findOne.mockResolvedValue(feature);
        const result = await service.getById(actor, feature.id);
        expectSuccess(result);
        expect(result.data).toEqual(feature);
    });

    it('should return NOT_FOUND error if feature does not exist', async () => {
        featureModelMock.findOne.mockResolvedValue(null);
        const result = await service.getById(actor, feature.id);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, feature.id);
        expectInternalError(result);
    });
});
