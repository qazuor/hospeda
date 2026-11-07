import type { FeatureModel } from '@repo/db';
import { FeatureCategoryEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.search', () => {
    let service: FeatureService;
    let featureModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const feature = FeatureFactoryBuilder.create({});
    const paginated = { items: [feature], total: 1 };
    const searchParams = { slug: 'test-feature', page: 1, pageSize: 10 };

    beforeEach(() => {
        featureModelMock = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new FeatureService(
            { logger: loggerMock },
            featureModelMock as unknown as FeatureModel
        );
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should return a paginated list of features (success)', async () => {
        featureModelMock.findAll.mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should allow searching features without any permission (public endpoint)', async () => {
        actor = createActor({ permissions: [] });
        featureModelMock.findAll.mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
    });

    it('should filter by category when given (HOS-2058)', async () => {
        featureModelMock.findAll.mockResolvedValue(paginated);

        const result = await service.search(actor, {
            category: FeatureCategoryEnum.VIEW,
            page: 1,
            pageSize: 10
        });

        expectSuccess(result);
        expect(featureModelMock.findAll.mock.calls[0]?.[0]).toEqual({
            category: 'VIEW',
            deletedAt: null
        });
    });

    it('should not filter by category when absent', async () => {
        featureModelMock.findAll.mockResolvedValue(paginated);

        await service.search(actor, searchParams);

        expect(featureModelMock.findAll.mock.calls[0]?.[0]).not.toHaveProperty('category');
    });

    it('should reject an unknown category', async () => {
        const result = await service.search(actor, {
            category: 'beach',
            page: 1,
            pageSize: 10
        } as never);

        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(featureModelMock.findAll).not.toHaveBeenCalled();
    });

    it('should forward the requested page and pageSize to the model (regression)', async () => {
        // Arrange — before the fix the model was called with no pagination, so its
        // 20-row default capped every list: GET /public/features?pageSize=100
        // returned 20 items while reporting totalPages=1.
        featureModelMock.findAll.mockResolvedValue(paginated);

        // Act
        await service.search(actor, {
            applicableVertical: 'accommodation',
            page: 2,
            pageSize: 100
        });

        // Assert
        expect(featureModelMock.findAll.mock.calls[0]?.[1]).toEqual({ page: 2, pageSize: 100 });
    });

    it('should exclude soft-deleted (retired) features (regression)', async () => {
        // Arrange — FeatureModel.findAll applies no soft-delete default, so before the
        // fix GET /public/features also returned the features retired by data
        // migration 0147, and the public filters rendered them as raw-slug chips.
        featureModelMock.findAll.mockResolvedValue(paginated);

        // Act
        await service.search(actor, {
            applicableVertical: 'accommodation',
            page: 1,
            pageSize: 100
        });

        // Assert
        expect(featureModelMock.findAll.mock.calls[0]?.[0]).toEqual({ deletedAt: null });
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        featureModelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, searchParams);
        expectInternalError(result);
    });
});
