/**
 * @fileoverview
 * Test suite for the AccommodationService.getByDestination method.
 * Ensures robust, type-safe, and homogeneous handling of accommodation retrieval by destination,
 * validation, permission, and error propagation logic.
 *
 * SPEC-167 T-026 regression: getByDestination must exclude ownerSuspended=true and
 * planRestricted=true accommodations for public actors (bug: previously used findAll
 * which has no visibility filters). VIP actors (vip_promotions_access entitlement or
 * ACCOMMODATION_VIEW_ALL permission) bypass both filters.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import {
    AccommodationFactoryBuilder,
    getMockDestinationId
} from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.getByDestination method.
 *
 * This suite verifies:
 * - Correct accommodation retrieval by destination via searchWithRelations (not raw findAll)
 * - Public visibility predicates: ownerSuspended=true and planRestricted=true are excluded
 * - VIP / ACCOMMODATION_VIEW_ALL actors bypass both visibility filters
 * - Validation and error codes for forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.getByDestination', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let destinationId: ReturnType<typeof getMockDestinationId>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['searchWithRelations', 'findAll']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn(),
            searchWithRelations: vi.fn(),
            findAll: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        service = new AccommodationService(
            { logger: createLoggerMock() },
            modelMock,
            // mediaProvider, userModel, publishDeps, rAmenityModel, rFeatureModel,
            // amenityModel, featureCatalogModel are all unused in these tests.
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // SPEC-204: inject stub so attachComposedMediaList does not hit a real DB.
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        actor = new ActorFactoryBuilder().host().build();
        destinationId = getMockDestinationId();
    });

    // =========================================================================
    // SPEC-167 T-026 REGRESSION: visibility predicate
    // =========================================================================

    /**
     * Bug regression: getByDestination previously called model.findAll() which has no
     * ownerSuspended or planRestricted filters. It must now call searchWithRelations() so
     * the public visibility predicate is enforced at the DB query level.
     *
     * This test will FAIL before the fix (findAll is called instead of searchWithRelations).
     */
    it('SPEC-167 T-026: uses searchWithRelations (not findAll) to enforce visibility filters', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        const items = [
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build(),
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build()
        ];
        modelMock.searchWithRelations.mockResolvedValue({ items, total: items.length });

        await service.getByDestination(actor, { page: 1, pageSize: 10, destinationId });

        expect(modelMock.searchWithRelations).toHaveBeenCalled();
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    /**
     * Bug regression: a suspended-owner accommodation must NOT appear in destination results
     * for a public actor.
     *
     * Before the fix, findAll returned it because it lacks the ownerSuspended filter.
     * After the fix, searchWithRelations is called with excludeOwnerSuspended=true.
     */
    it('SPEC-167 T-026: excludes ownerSuspended accommodations for public actor', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        await service.getByDestination(actor, { page: 1, pageSize: 10, destinationId });

        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ excludeOwnerSuspended: true }),
            undefined
        );
    });

    /**
     * Bug regression: a plan-restricted accommodation must NOT appear in destination results
     * for a public actor.
     *
     * Before the fix, findAll returned it because it lacks the planRestricted filter.
     * After the fix, searchWithRelations is called with excludePlanRestricted=true.
     */
    it('SPEC-167 T-026: excludes planRestricted accommodations for public actor', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        await service.getByDestination(actor, { page: 1, pageSize: 10, destinationId });

        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ excludePlanRestricted: true }),
            undefined
        );
    });

    /**
     * VIP actors (vip_promotions_access entitlement) bypass both visibility filters.
     */
    it('SPEC-167 T-026: VIP actor bypasses ownerSuspended and planRestricted filters', async () => {
        const vipActor = new ActorFactoryBuilder()
            .host()
            .with({
                entitlements: new Set(['vip_promotions_access'])
            })
            .build();
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        await service.getByDestination(vipActor, { page: 1, pageSize: 10, destinationId });

        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeOwnerSuspended: false,
                excludePlanRestricted: false
            }),
            undefined
        );
    });

    /**
     * Actors with ACCOMMODATION_VIEW_ALL also bypass both visibility filters.
     */
    it('SPEC-167 T-026: ACCOMMODATION_VIEW_ALL actor bypasses ownerSuspended and planRestricted filters', async () => {
        const adminActor = new ActorFactoryBuilder().admin().build();
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });

        await service.getByDestination(adminActor, { page: 1, pageSize: 10, destinationId });

        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeOwnerSuspended: false,
                excludePlanRestricted: false
            }),
            undefined
        );
    });

    // =========================================================================
    // EXISTING TESTS (updated to match searchWithRelations instead of findAll)
    // =========================================================================

    it('should return accommodations for a destination', async () => {
        const accommodations = [
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build(),
            new AccommodationFactoryBuilder().public().withOverrides({ destinationId }).build()
        ];
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({
            items: accommodations,
            total: accommodations.length
        });
        const result = await service.getByDestination(actor, {
            page: 1,
            pageSize: 10,
            destinationId
        });
        expectSuccess(result);
        expect(result.data?.accommodations).toHaveLength(accommodations.length);
        expect(modelMock.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destinationId, page: 1, pageSize: 10 }),
            undefined
        );
        expect(permissionHelpers.checkCanList).toHaveBeenCalledWith(actor);
    });

    it('should return FORBIDDEN if actor cannot list', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const result = await service.getByDestination(actor, {
            page: 1,
            pageSize: 10,
            destinationId
        });
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanList).toHaveBeenCalledWith(actor);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockRejectedValue(new Error('DB error'));
        const result = await service.getByDestination(actor, {
            page: 1,
            pageSize: 10,
            destinationId
        });
        expectInternalError(result);
        expect(modelMock.searchWithRelations).toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getByDestination(actor, {
            page: 1,
            pageSize: 10,
            destinationId: 'invalid-id'
        } as never);
        expectValidationError(result);
    });

    it('should return empty array if destination does not exist', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockReturnValue();
        modelMock.searchWithRelations.mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByDestination(actor, {
            page: 1,
            pageSize: 10,
            destinationId: '00000000-0000-0000-0000-000000000000' as never
        });
        expectSuccess(result);
        expect(result.data).toEqual({
            accommodations: []
        });
    });
});
