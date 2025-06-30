/**
 * @fileoverview
 * Test suite for the AccommodationService.list method.
 * Ensures robust, type-safe, and homogeneous handling of list logic, including:
 * - Successful paginated retrieval
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
 * - Pagination options
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createListActor = () => createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

// biome-ignore lint/suspicious/noExplicitAny: test-only access to protected property
const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('AccommodationService.list', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createListActor>;
    let entities: ReturnType<typeof createEntity>[];

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        actor = createListActor();
        entities = [createEntity(), createEntity()];
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return a paginated list of accommodations', async () => {
        (model.findAll as Mock).mockResolvedValue(paginated(entities, 1, 2));
        const result = await service.list(actor, { page: 1, pageSize: 2 });
        expect(result.data).toBeDefined();
        expect(result.data?.items?.length).toBe(2);
        if (!result.data || !result.data.items || result.data.items.length === 0 || !entities[0]) {
            throw new Error('Expected at least one item in result.data.items and entities');
        }
        const firstItem = result.data.items[0] as NonNullable<(typeof result.data.items)[0]>;
        const firstEntity = entities[0] as NonNullable<(typeof entities)[0]>;
        expect(firstItem.id).toBe(firstEntity.id);
        expect(result.error).toBeUndefined();
        expect(model.findAll).toHaveBeenCalledWith({}, { page: 1, pageSize: 2 });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const noPermsActor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });
        const result = await service.list(noPermsActor, { page: 1, pageSize: 2 });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (model.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, { page: 1, pageSize: 2 });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _beforeList hook', async () => {
        (model.findAll as Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeList: () => void },
            '_beforeList'
        ).mockRejectedValue(new Error('beforeList error'));
        const result = await service.list(actor, {});
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterList hook', async () => {
        (model.findAll as Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(service as unknown as { _afterList: () => void }, '_afterList').mockRejectedValue(
            new Error('afterList error')
        );
        const result = await service.list(actor, {});
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the list normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts, page: 99 }));
        class ServiceWithNormalizer extends AccommodationService {
            protected override normalizers = {
                ...getNormalizers(service),
                list: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        (model.findAll as Mock).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.list(actor, { page: 1, pageSize: 10 });
        expect(normalizer).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, actor);
        expect(model.findAll).toHaveBeenCalledWith({}, { page: 99, pageSize: 10 });
    });
});
