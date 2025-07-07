import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

const createCountActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });

describe('AccommodationService.count', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createCountActor>;

    beforeEach(() => {
        model = createModelMock();
        model.countByFilters = vi.fn();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        actor = createCountActor();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return the count if actor has permission', async () => {
        (model.countByFilters as Mock).mockResolvedValue({ count: 42 });
        const result = await service.count(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 10 }
        });
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(42);
        expect(result.error).toBeUndefined();
        expect(model.countByFilters).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });
        const result = await service.count(createActor({ permissions: [] }), {
            filters: {},
            pagination: { page: 1, pageSize: 10 }
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.count(actor, {
            filters: { priceMin: 'not-a-number' },
            pagination: { page: 1, pageSize: 10 }
        } as unknown as Record<string, unknown>);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.countByFilters).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 10 }
        });
        expectInternalError(result);
    });

    it('should handle errors from the _beforeCount hook', async () => {
        asMock(model.countByFilters).mockResolvedValue({ count: 1 });
        vi.spyOn(
            service as unknown as { _beforeCount: () => void },
            '_beforeCount'
        ).mockRejectedValue(new Error('before error'));
        const result = await service.count(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 10 }
        });
        expectInternalError(result);
    });

    it('should handle errors from the _afterCount hook', async () => {
        asMock(model.countByFilters).mockResolvedValue({ count: 1 });
        vi.spyOn(
            service as unknown as { _afterCount: () => void },
            '_afterCount'
        ).mockRejectedValue(new Error('after error'));
        const result = await service.count(actor, {
            filters: {},
            pagination: { page: 1, pageSize: 10 }
        });
        expectInternalError(result);
    });
});
