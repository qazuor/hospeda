import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

const createCountActor = () =>
    createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });

describe('DestinationService.count', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createCountActor>;

    beforeEach(() => {
        model = createModelMock();
        model.countByFilters = vi.fn();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        actor = createCountActor();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should return the count if actor has permission', async () => {
        (model.countByFilters as Mock).mockResolvedValue(42);
        const result = await service.count(actor, { filters: { country: 'AR' } });
        expect(result.data).toBe(42);
        expect(result.error).toBeUndefined();
        expect(model.countByFilters).toHaveBeenCalled();
    });

    it.skip('should return FORBIDDEN if actor lacks permission', async () => {
        // This test is skipped because any actor can count destinations according to business policy.
        // If the policy changes, uncomment and adjust the test.
        const noPermsActor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanCountDestinations').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied');
        });
        const result = await service.count(noPermsActor, { filters: { country: 'AR' } });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.count(actor, {
            filters: { country: 123 }
        } as unknown as Record<string, unknown>);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.countByFilters).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, { filters: { country: 'AR' } });
        expectInternalError(result);
    });

    it('should handle errors from the _beforeCount hook', async () => {
        asMock(model.countByFilters).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _beforeCount: () => void },
            '_beforeCount'
        ).mockRejectedValue(new Error('before error'));
        const result = await service.count(actor, { filters: { country: 'AR' } });
        expectInternalError(result);
    });

    it('should handle errors from the _afterCount hook', async () => {
        asMock(model.countByFilters).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _afterCount: () => void },
            '_afterCount'
        ).mockRejectedValue(new Error('after error'));
        const result = await service.count(actor, { filters: { country: 'AR' } });
        expectInternalError(result);
    });
});
