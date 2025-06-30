/**
 * @fileoverview
 * Test suite for the AccommodationService.getById method.
 * Ensures robust, type-safe, and homogeneous handling of getById logic, including:
 * - Successful entity retrieval
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
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

const createViewActor = () => createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

describe('AccommodationService.getById', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createViewActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        entity = createEntity();
        actor = createViewActor();
        vi.clearAllMocks();
    });

    it('should return an accommodation by id', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getById(actor, entity.id);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(entity.id);
        expect(result.error).toBeUndefined();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _beforeGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const hookError = new Error('Error in beforeGetByField hook');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _afterGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const hookError = new Error('Error in afterGetByField hook');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getById(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
