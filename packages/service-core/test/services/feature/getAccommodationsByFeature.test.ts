import type { AccommodationModel, FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import {
    AccommodationFactoryBuilder,
    getMockAccommodationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
import { expectInternalError, expectValidationError } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('FeatureService.getAccommodationsByFeature', () => {
    let service: FeatureService;
    const logger = createLoggerMock();
    const ctx = { logger };

    const featureId = FeatureFactoryBuilder.create().id;
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerms = createActor({ roles: [RoleEnum.GUEST], permissions: [] });
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
        // HOS-288: the read is now two steps — junction ids first, then the
        // accommodations through AccommodationModel (both are the same shared
        // `model` mock here, so `findAll` is called twice).
        (model.findAll as Mock)
            .mockResolvedValueOnce({
                items: [{ featureId, accommodationId: accommodation.id }],
                total: 1
            })
            .mockResolvedValueOnce({ items: [accommodation], total: 1 });

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
        // HOS-288: no junction rows → short-circuit, no accommodation query.
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [],
            total: 0
        });

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

    /**
     * H-38. This test used to assert the opposite, and asserting it is what kept
     * the bug alive: the route is declared with `createPublicListRoute`, no
     * `requiredPermissions` and `cacheTTL: 300`, yet the service demanded
     * `ACCOMMODATION_FEATURES_EDIT` — a CATALOG EDITING permission — so
     * `/public/features/<id>/accommodations` answered 403 to every visitor in
     * production and the endpoint was simply dead.
     *
     * Removing the check exposes nothing new: the query below is already
     * restricted to `visibility: PUBLIC` + `lifecycleState: ACTIVE` with the
     * model's soft-delete default, which is the same set anyone can already see
     * through search. The service's own JSDoc says as much — the prefix sits in
     * `PUBLIC_CACHE_ENDPOINTS`, the cache key carries no Authorization and the
     * cache runs BEFORE auth, so the gate was decorative and the RESPONSE is
     * what has to be anonymous-safe.
     */
    it('serves a guest, because the route is public (H-38)', async () => {
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

        expect(result.error).toBeUndefined();
        expect(result.data?.accommodations).toBeDefined();
    });

    it('still restricts the result to PUBLIC + ACTIVE accommodations', async () => {
        // The load-bearing half of the change above: the gate goes away, the
        // predicates that make the payload anonymous-safe do not.
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

        await service.getAccommodationsByFeature(actorNoPerms, { featureId });

        expect(model.findAll).toHaveBeenLastCalledWith(
            expect.objectContaining({
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            }),
            expect.anything()
        );
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
        // HOS-288: junction query first (empty → short-circuit).
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [],
            total: 0
        });
        const minimalInput = { featureId };
        const result = await service.getAccommodationsByFeature(actorWithPerms, minimalInput);
        expect(result.data).toHaveProperty('accommodations');
        expect(Array.isArray(result.data?.accommodations)).toBe(true);
    });

    it('serves an actor holding unrelated permissions (H-38)', async () => {
        // Same inversion as above: on a public read, which permissions the
        // caller happens to hold is not the question being asked.
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
        expect(result.error).toBeUndefined();
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
