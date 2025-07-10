import type { FeatureModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.softDelete', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const feature = FeatureFactoryBuilder.create({ name: 'Test Feature' });

    beforeEach(() => {
        featureModelMock = createModelMock(['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should soft delete a feature (success)', async () => {
        featureModelMock.findById.mockResolvedValue(feature);
        featureModelMock.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(actor, feature.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        featureModelMock.findById.mockResolvedValue(feature);
        const result = await service.softDelete(actor, feature.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if feature does not exist', async () => {
        featureModelMock.findById.mockResolvedValue(null);
        const result = await service.softDelete(actor, feature.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findById.mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actor, feature.id);
        expectInternalError(result);
    });

    it('should not soft delete a feature that is already deleted', async () => {
        const alreadyDeletedFeature = FeatureFactoryBuilder.create({ deletedAt: new Date() });
        featureModelMock.findById.mockResolvedValue(alreadyDeletedFeature);
        featureModelMock.softDelete.mockResolvedValue(0);
        const result = await service.softDelete(actor, alreadyDeletedFeature.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
