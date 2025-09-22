import type { FeatureModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.count', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const countParams = { name: 'Test Feature' };

    beforeEach(() => {
        featureModelMock = createModelMock(['count']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should return the count of features (success)', async () => {
        featureModelMock.count.mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        featureModelMock.count.mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.count.mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
