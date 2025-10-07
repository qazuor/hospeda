import type { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode, TagColorEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const paginated = (items: unknown[], page = 1, pageSize = 10) => ({
    items,
    page,
    pageSize,
    total: items.length
});

const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('DestinationService.search and count', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let admin: ReturnType<typeof createActor>;
    let guest: ReturnType<typeof createActor>;
    let entities: ReturnType<typeof DestinationFactoryBuilder.prototype.build>[];

    beforeEach(() => {
        model = createModelMock();
        model.findAll = vi.fn();
        model.count = vi.fn();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        admin = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
        guest = createActor({ permissions: [] });
        entities = [
            new DestinationFactoryBuilder().build(),
            new DestinationFactoryBuilder().build()
        ];
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return paginated destinations for valid filters', async () => {
        // Arrange
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated(entities, 1, 2));
        const params = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, {
            ...params,
            page: 1,
            pageSize: 10
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
    });

    it('should return empty result if no destinations match', async () => {
        // Arrange
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated([]));
        const params = { state: 'Nowhere' };

        // Act
        const result = await service.search(admin, {
            ...params,
            page: 1,
            pageSize: 10
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const invalidParams = { state: 123 as any }; // state should be string

        // Act
        const result = await service.search(admin, {
            ...invalidParams,
            page: 1,
            pageSize: 10
        });

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        (model.findAll as import('vitest').Mock).mockRejectedValue(new Error('DB error'));
        const params = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, {
            ...params,
            page: 1,
            pageSize: 10
        });

        // Assert
        expectInternalError(result);
    });

    it('should return correct count for valid filters', async () => {
        (model.count as import('vitest').Mock).mockResolvedValue(5);
        const params = { country: 'AR' };
        const result = await service.count(admin, {
            ...params,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        expect(result.data?.count).toBe(5);
    });

    it('should return 0 count if no destinations match', async () => {
        (model.count as import('vitest').Mock).mockResolvedValue(0);
        const params = { country: 'ZZ' };
        const result = await service.count(admin, { ...params, page: 1, pageSize: 10 });
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });

    it('should return FORBIDDEN for count if actor lacks permission', async () => {
        // Arrange
        vi.spyOn(permissionHelpers, 'checkCanCountDestinations').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const params = { country: 'AR' };

        // Act
        const result = await service.count(guest, { ...params, page: 1, pageSize: 10 });

        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for count with invalid input', async () => {
        // Arrange
        const invalidParams = { country: 123 as any };

        // Act
        const result = await service.count(admin, {
            ...invalidParams,
            page: 1,
            pageSize: 10
        });

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR for count if model throws', async () => {
        // Arrange
        (model.count as import('vitest').Mock).mockRejectedValue(new Error('DB error'));
        const params = { country: 'AR' };

        // Act
        const result = await service.count(admin, { ...params, page: 1, pageSize: 10 });

        // Assert
        expectInternalError(result);
    });

    it('should handle edge case: tags filter', async () => {
        // Arrange
        const tag = TagFactoryBuilder.create({
            name: 'beach',
            slug: 'beach',
            color: TagColorEnum.BLUE,
            icon: 'star',
            notes: 'Test tag',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const destinations = [
            new DestinationFactoryBuilder().with({ name: 'Taggy', tags: [tag] }).build()
        ];
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated(destinations, 1, 1));
        const filters = { tags: [tag.id] }; // Use tag ID instead of full object

        // Act
        const result = await service.search(admin, { ...filters, page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.items?.[0]?.name).toBe('Taggy');
    });

    it('should handle errors from the _beforeSearch hook', async () => {
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeSearch: () => void },
            '_beforeSearch'
        ).mockRejectedValue(new Error('beforeSearch error'));
        const params = { state: 'Entre Ríos' };
        const result = await service.search(admin, { ...params, page: 1, pageSize: 10 });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterSearch hook', async () => {
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('afterSearch error'));
        const params = { state: 'Entre Ríos' };
        const result = await service.search(admin, { ...params, page: 1, pageSize: 10 });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the search normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts, page: 99, pageSize: 10 }));
        class ServiceWithNormalizer extends DestinationService {
            protected override normalizers = {
                ...getNormalizers(service),
                search: normalizer
            };
        }
        const serviceWithNorm = new ServiceWithNormalizer(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        (model.findAll as import('vitest').Mock).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.search(admin, { page: 1, pageSize: 10 });
        expect(normalizer).toHaveBeenCalledWith({ page: 1, pageSize: 10, sortOrder: 'asc' }, admin);
        expect(model.findAll).toHaveBeenCalledWith({}, { page: 99, pageSize: 10 });
    });
});
