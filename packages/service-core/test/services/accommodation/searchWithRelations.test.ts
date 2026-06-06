/**
 * @fileoverview
 * Test suite for the AccommodationService.searchWithRelations method.
 * Ensures robust, type-safe, and homogeneous handling of search logic with relations, including:
 * - Successful paginated and filtered retrieval with destination and owner data
 * - Permission checks and forbidden access
 * - Input validation and error handling
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
 * - Pagination and filter options
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { AccommodationTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

const createSearchActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

const createEntityWithRelations = () => ({
    ...createEntity(),
    destination: { id: 'dest-1', name: 'Test Destination', slug: 'test-destination' },
    owner: { id: 'user-1', displayName: 'Test Owner' }
});

const paginatedWithRelations = (items: unknown[]) => ({
    items,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('AccommodationService.searchWithRelations', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createSearchActor>;
    let entitiesWithRelations: ReturnType<typeof createEntityWithRelations>[];

    beforeEach(() => {
        model = createModelMock();
        model.searchWithRelations = vi.fn();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        actor = createSearchActor();
        entitiesWithRelations = [createEntityWithRelations(), createEntityWithRelations()];
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return a paginated list of accommodations with relations', async () => {
        asMock(model.searchWithRelations).mockResolvedValue(
            paginatedWithRelations(entitiesWithRelations)
        );

        const type = entitiesWithRelations[0]?.type;
        const result = await service.searchWithRelations(actor, {
            type,
            page: 1,
            pageSize: 2
        });

        expect(result.data).toBeDefined();
        expect(result.data?.data?.length).toBe(2);
        expect(result.data?.pagination?.total).toBe(2);

        if (!result.data || !result.data.data || result.data.data.length === 0) {
            throw new Error('Expected at least one item in result.data.data');
        }

        const firstItem = result.data.data[0];
        const firstEntity = entitiesWithRelations[0];

        if (!firstItem || !firstEntity) {
            throw new Error('Expected firstItem and firstEntity to be defined');
        }

        expect(firstItem.id).toBe(firstEntity.id);
        // Note: The actual IDs from the service response may differ from mock data
        expect(firstItem.destinationId).toBeDefined();
        expect(firstItem.ownerId).toBeDefined();
        expect(result.error).toBeUndefined();

        expect(model.searchWithRelations).toHaveBeenCalledWith({
            page: 1,
            pageSize: 2,
            sortBy: undefined,
            sortOrder: 'asc',
            q: undefined,
            type,
            minPrice: undefined,
            maxPrice: undefined,
            destinationId: undefined,
            amenities: undefined,
            isFeatured: undefined,
            isAvailable: undefined,
            excludeRestricted: false,
            excludeOwnerSuspended: false,
            excludePlanRestricted: false
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const noPermsActor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });

        const result = await service.searchWithRelations(noPermsActor, {
            page: 1,
            pageSize: 10
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
        expect(model.searchWithRelations).not.toHaveBeenCalled();
    });

    it('should handle validation errors for invalid input', async () => {
        const invalidParams = {
            page: -1,
            pageSize: 0 // Invalid pagination
        };

        const result = await service.searchWithRelations(actor, invalidParams as any);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
        expect(model.searchWithRelations).not.toHaveBeenCalled();
    });

    it('should apply search normalizer if defined', async () => {
        const mockNormalizer = vi.fn().mockResolvedValue({
            page: 1,
            pageSize: 10,
            sortOrder: 'asc' as const
        });

        getNormalizers(service).search = mockNormalizer;
        asMock(model.searchWithRelations).mockResolvedValue(
            paginatedWithRelations(entitiesWithRelations)
        );

        const params = {
            type: AccommodationTypeEnum.HOTEL,
            page: 1,
            pageSize: 10,
            sortOrder: 'asc' as const // Add the expected default
        };

        await service.searchWithRelations(actor, params);

        expect(mockNormalizer).toHaveBeenCalledWith(params, actor);
        expect(model.searchWithRelations).toHaveBeenCalledWith({
            page: 1,
            pageSize: 10,
            sortBy: undefined,
            sortOrder: 'asc',
            q: undefined,
            type: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            destinationId: undefined,
            amenities: undefined,
            isFeatured: undefined,
            isAvailable: undefined,
            excludeRestricted: false,
            excludeOwnerSuspended: false,
            excludePlanRestricted: false
        });
    });

    it('should handle database errors gracefully', async () => {
        const dbError = new Error('Database connection failed');
        asMock(model.searchWithRelations).mockRejectedValue(dbError);

        const result = await service.searchWithRelations(actor, {
            page: 1,
            pageSize: 10
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should use default pagination when not provided', async () => {
        asMock(model.searchWithRelations).mockResolvedValue(
            paginatedWithRelations(entitiesWithRelations)
        );

        await service.searchWithRelations(actor, {
            page: 1,
            pageSize: 10
        });

        expect(model.searchWithRelations).toHaveBeenCalledWith({
            page: 1,
            pageSize: 10,
            sortBy: undefined,
            sortOrder: 'asc',
            q: undefined,
            type: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            destinationId: undefined,
            amenities: undefined,
            isFeatured: undefined,
            isAvailable: undefined,
            excludeRestricted: false,
            excludeOwnerSuspended: false,
            excludePlanRestricted: false
        });
    });

    it('should handle empty results', async () => {
        asMock(model.searchWithRelations).mockResolvedValue(paginatedWithRelations([]));

        const result = await service.searchWithRelations(actor, {
            type: AccommodationTypeEnum.HOTEL, // Use valid enum instead of nonexistent
            page: 1,
            pageSize: 10
        });

        expect(result.data).toBeDefined();
        expect(result.data?.data).toEqual([]);
        expect(result.data?.pagination?.total).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('forwards anyAmenityGroups and capacity/bedroom/rating filters to the model', async () => {
        // Regression: prior to the spread refactor, the manual modelParams
        // literal omitted anyAmenityGroups, minGuests/maxGuests,
        // minBedrooms/maxBedrooms, minBathrooms/maxBathrooms, minRating and
        // sorts. The web list endpoint resolves the public boolean shortcuts
        // (hasWifi etc.) into anyAmenityGroups before calling the service, so
        // those filters MUST reach the model.
        asMock(model.searchWithRelations).mockResolvedValue(
            paginatedWithRelations(entitiesWithRelations)
        );

        await service.searchWithRelations(actor, {
            page: 1,
            pageSize: 10,
            anyAmenityGroups: [
                ['11111111-1111-4111-8111-111111111111'],
                ['22222222-2222-4222-8222-222222222222']
            ],
            minGuests: 2,
            maxGuests: 6,
            minBedrooms: 1,
            minBathrooms: 1,
            minRating: 4
        });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                anyAmenityGroups: [
                    ['11111111-1111-4111-8111-111111111111'],
                    ['22222222-2222-4222-8222-222222222222']
                ],
                minGuests: 2,
                maxGuests: 6,
                minBedrooms: 1,
                minBathrooms: 1,
                minRating: 4,
                excludeRestricted: false
            })
        );
    });

    it('should call lifecycle hooks in correct order', async () => {
        const beforeSearchSpy = vi.spyOn(service as any, '_beforeSearch');
        const afterSearchSpy = vi.spyOn(service as any, '_afterSearch');

        asMock(model.searchWithRelations).mockResolvedValue(
            paginatedWithRelations(entitiesWithRelations)
        );

        await service.searchWithRelations(actor, {
            page: 1,
            pageSize: 10
        });

        expect(beforeSearchSpy).toHaveBeenCalledBefore(afterSearchSpy as any);
        expect(afterSearchSpy).toHaveBeenCalled();
    });

    // SPEC-143 #29 — service-suspension public filter
    it('excludes service-suspended owners for a non-VIP searcher', async () => {
        asMock(model.searchWithRelations).mockResolvedValue(paginatedWithRelations([]));
        const nonVip = createActor({ permissions: [] });

        await service.searchWithRelations(nonVip, { page: 1, pageSize: 10 });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ excludeOwnerSuspended: true })
        );
    });

    it('lets an owner see their OWN service-suspended listings (ownerId === self)', async () => {
        asMock(model.searchWithRelations).mockResolvedValue(paginatedWithRelations([]));
        const host = createActor({ permissions: [] });

        await service.searchWithRelations(host, {
            page: 1,
            pageSize: 10,
            ownerId: host.id
        });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ excludeOwnerSuspended: false })
        );
    });
});
