import { DestinationModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode,
    TagColorEnum
} from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMockTag } from '../../../../services/src/test/factories/tagFactory';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createAdminActor, createGuestActor } from '../../factories/actorFactory';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('DestinationService.search and count', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;
    let admin: Actor;
    let guest: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['search', 'countByFilters']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
        admin = createAdminActor();
        guest = createGuestActor();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return paginated destinations for valid filters', async () => {
        // Arrange
        const destinations = [
            new DestinationFactoryBuilder().with({ name: 'A' }).build(),
            new DestinationFactoryBuilder().with({ name: 'B' }).build()
        ];
        asMock(modelMock.search).mockResolvedValue({ items: destinations, total: 2 });
        const filters = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, filters);

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
    });

    it('should return empty result if no destinations match', async () => {
        // Arrange
        asMock(modelMock.search).mockResolvedValue({ items: [], total: 0 });
        const filters = { state: 'Nowhere' };

        // Act
        const result = await service.search(admin, filters);

        // Assert
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        vi.spyOn(permissionHelpers, 'checkCanSearchDestinations').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const filters = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(guest, filters);

        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const invalidFilters = { state: 123 }; // state should be string

        // Act
        // @ts-expect-error: purposely invalid
        const result = await service.search(admin, invalidFilters);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(modelMock.search).mockRejectedValue(new Error('DB error'));
        const filters = { state: 'Entre Ríos' };

        // Act
        const result = await service.search(admin, filters);

        // Assert
        expectInternalError(result);
    });

    it('should return correct count for valid filters', async () => {
        // Arrange
        asMock(modelMock.countByFilters).mockResolvedValue({ count: 5 });
        const filters = { country: 'AR' };

        // Act
        const result = await service.count(admin, filters);

        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(5);
    });

    it('should return 0 count if no destinations match', async () => {
        // Arrange
        asMock(modelMock.countByFilters).mockResolvedValue({ count: 0 });
        const filters = { country: 'ZZ' };

        // Act
        const result = await service.count(admin, filters);

        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });

    it('should return FORBIDDEN for count if actor lacks permission', async () => {
        // Arrange
        vi.spyOn(permissionHelpers, 'checkCanCountDestinations').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });
        const filters = { country: 'AR' };

        // Act
        const result = await service.count(guest, filters);

        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for count with invalid input', async () => {
        // Arrange
        const invalidFilters = { country: 123 };

        // Act
        // @ts-expect-error: purposely invalid
        const result = await service.count(admin, invalidFilters);

        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR for count if model throws', async () => {
        // Arrange
        asMock(modelMock.countByFilters).mockRejectedValue(new Error('DB error'));
        const filters = { country: 'AR' };

        // Act
        const result = await service.count(admin, filters);

        // Assert
        expectInternalError(result);
    });

    it('should handle edge case: tags filter', async () => {
        // Arrange
        const tag = {
            id: getMockTag().id,
            name: 'beach',
            slug: 'beach',
            color: TagColorEnum.BLUE,
            icon: 'star',
            notes: 'Test tag',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockTag().createdById,
            updatedById: getMockTag().updatedById,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            seo: {
                title: 'SEO Title for tag with beach - valid',
                description:
                    'SEO description for tag with beach - valid description and even more characters to pass validation',
                keywords: ['beach']
            }
        };
        const destinations = [
            new DestinationFactoryBuilder().with({ name: 'Taggy', tags: [tag] }).build()
        ];
        asMock(modelMock.search).mockResolvedValue({ items: destinations, total: 1 });
        const filters = { tags: [tag] };

        // Act
        const result = await service.search(admin, filters);

        // Assert
        expectSuccess(result);
        expect(result.data?.items?.[0]?.name).toBe('Taggy');
    });
});
