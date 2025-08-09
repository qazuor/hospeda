import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createListActor = () =>
    createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
const createEntity = () => createDestination();

const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('DestinationService.list', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createListActor>;
    let entities: ReturnType<typeof createEntity>[];

    beforeEach(() => {
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        actor = createListActor();
        entities = [createEntity(), createEntity()];
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return a paginated list of destinations', async () => {
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

    it.skip('should return FORBIDDEN if actor lacks permission', async () => {
        // This test is skipped because any actor can list destinations according to business policy.
        // If the policy changes, uncomment and adjust the test.
        const noPermsActor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanListDestinations').mockImplementation(() => {
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
        class ServiceWithNormalizer extends DestinationService {
            protected override normalizers = {
                ...getNormalizers(service),
                list: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        (model.findAll as Mock).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.list(actor, { page: 1, pageSize: 10 });
        expect(normalizer).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, actor);
        expect(model.findAll).toHaveBeenCalledWith({}, { page: 99, pageSize: 10 });
    });
});
