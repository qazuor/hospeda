import type { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode, TagColorEnum } from '@repo/types';
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

// biome-ignore lint/suspicious/noExplicitAny: test-only access to protected property
const getNormalizers = (svc: unknown) => (svc as any).normalizers;

describe('DestinationService.search and count', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let admin: ReturnType<typeof createActor>;
    let guest: ReturnType<typeof createActor>;
    let entities: ReturnType<typeof DestinationFactoryBuilder.prototype.build>[];

    beforeEach(() => {
        model = createModelMock();
        model.search = vi.fn();
        model.countByFilters = vi.fn();
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
        (model.search as import('vitest').Mock).mockResolvedValue(paginated(entities, 1, 2));
        const params = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, { filters: params });

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
    });

    it('should return empty result if no destinations match', async () => {
        // Arrange
        (model.search as import('vitest').Mock).mockResolvedValue(paginated([]));
        const params = { state: 'Nowhere' };

        // Act
        const result = await service.search(admin, { filters: params });

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const invalidParams = { state: 123 }; // state should be string

        // Act
        // @ts-expect-error: purposely invalid
        const result = await service.search(admin, { filters: invalidParams });

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        (model.search as import('vitest').Mock).mockRejectedValue(new Error('DB error'));
        const params = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, { filters: params });

        // Assert
        expectInternalError(result);
    });

    it('should return correct count for valid filters', async () => {
        (model.countByFilters as import('vitest').Mock).mockResolvedValue(5);
        const params = { country: 'AR' };
        const result = await service.count(admin, { filters: params });
        expectSuccess(result);
        expect(result.data).toBe(5);
    });

    it('should return 0 count if no destinations match', async () => {
        (model.countByFilters as import('vitest').Mock).mockResolvedValue(0);
        const params = { country: 'ZZ' };
        const result = await service.count(admin, { filters: params });
        expectSuccess(result);
        expect(result.data).toBe(0);
    });

    it('should return FORBIDDEN for count if actor lacks permission', async () => {
        // Arrange
        vi.spyOn(permissionHelpers, 'checkCanCountDestinations').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const params = { country: 'AR' };

        // Act
        const result = await service.count(guest, { filters: params });

        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for count with invalid input', async () => {
        // Arrange
        const invalidParams = { country: 123 };

        // Act
        // @ts-expect-error: purposely invalid
        const result = await service.count(admin, { filters: invalidParams });

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR for count if model throws', async () => {
        // Arrange
        (model.countByFilters as import('vitest').Mock).mockRejectedValue(new Error('DB error'));
        const params = { country: 'AR' };

        // Act
        const result = await service.count(admin, { filters: params });

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
        (model.search as import('vitest').Mock).mockResolvedValue(paginated(destinations, 1, 1));
        const filters = { tags: [tag] };

        // Act
        const result = await service.search(admin, { filters: filters });

        // Assert
        expectSuccess(result);
        expect(result.data?.items?.[0]?.name).toBe('Taggy');
    });

    it('should handle errors from the _beforeSearch hook', async () => {
        (model.search as import('vitest').Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _beforeSearch: () => void },
            '_beforeSearch'
        ).mockRejectedValue(new Error('beforeSearch error'));
        const params = { state: 'Entre Ríos' };
        const result = await service.search(admin, { filters: params });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle errors from the _afterSearch hook', async () => {
        (model.search as import('vitest').Mock).mockResolvedValue(paginated(entities));
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('afterSearch error'));
        const params = { state: 'Entre Ríos' };
        const result = await service.search(admin, { filters: params });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the search normalizer if provided', async () => {
        const normalizer = vi.fn((opts) => ({ ...opts, pagination: { page: 99, pageSize: 10 } }));
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
        (model.search as import('vitest').Mock).mockResolvedValue(paginated(entities, 99, 10));
        await serviceWithNorm.search(admin, { filters: {}, pagination: { page: 1, pageSize: 10 } });
        expect(normalizer).toHaveBeenCalledWith(
            { filters: {}, pagination: { page: 1, pageSize: 10 } },
            admin
        );
        expect(model.search).toHaveBeenCalledWith({
            filters: {},
            page: 99,
            pageSize: 10
        });
    });
});
