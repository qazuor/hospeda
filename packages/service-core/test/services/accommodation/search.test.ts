/**
 * @fileoverview
 * Test suite for the AccommodationService.search method.
 * Ensures robust, type-safe, and homogeneous handling of search logic, including:
 * - Successful paginated and filtered retrieval
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
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
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

const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

// Helper for type-safe mocking
describe('AccommodationService.search', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createSearchActor>;
    let entities: ReturnType<typeof createEntity>[];

    beforeEach(() => {
        model = createModelMock();
        model.search = vi.fn();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        actor = createSearchActor();
        entities = [createEntity(), createEntity()];
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return a paginated list of accommodations matching filters', async () => {
        asMock(model.search).mockResolvedValue(paginated(entities, 1, 2));
        if (!entities[0]) {
            throw new Error('Expected at least one entity in entities');
        }
        const filters = { types: [entities[0].type] };
        const result = await service.search(actor, {
            filters,
            pagination: { page: 1, pageSize: 2 }
        });
        expect(result.data).toBeDefined();
        expect(result.data?.items?.length).toBe(2);
        if (!result.data || !result.data.items || result.data.items.length === 0 || !entities[0]) {
            throw new Error('Expected at least one item in result.data.items and entities');
        }
        const firstItem = result.data.items[0] as NonNullable<(typeof result.data.items)[0]>;
        const firstEntity = entities[0] as NonNullable<(typeof entities)[0]>;
        expect(firstItem.id).toBe(firstEntity.id);
        expect(result.error).toBeUndefined();
        expect(model.search).toHaveBeenCalledWith({
            filters: expect.any(Object),
            pagination: { page: 1, pageSize: 2 }
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const noPermsActor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });
        const result = await service.search(noPermsActor, {
            filters: {},
            pagination: { page: 1, pageSize: 2 }
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.search(actor, {
            filters: { minPrice: 'not-a-number' },
            pagination: { page: 1, pageSize: 2 }
        } as unknown as Record<string, unknown>);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.search).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 2 }
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _beforeSearch hook', async () => {
        asMock(model.search).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeSearch: () => void },
            '_beforeSearch'
        ).mockRejectedValue(new Error('beforeSearch error'));
        const result = await service.search(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 2 }
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterSearch hook', async () => {
        asMock(model.search).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('afterSearch error'));
        const result = await service.search(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 2 }
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the search normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts, pagination: { page: 99, pageSize: 10 } }));
        class ServiceWithNormalizer extends AccommodationService {
            protected override normalizers = {
                ...getNormalizers(service),
                search: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        asMock(model.search).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.search(actor, { filters: {}, pagination: { page: 1, pageSize: 10 } });
        expect(normalizer).toHaveBeenCalledWith(
            { filters: {}, pagination: { page: 1, pageSize: 10 } },
            actor
        );
        expect(model.search).toHaveBeenCalledWith({
            filters: {},
            pagination: { page: 99, pageSize: 10 }
        });
    });
});
