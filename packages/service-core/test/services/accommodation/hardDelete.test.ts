/**
 * @fileoverview
 * Test suite for the AccommodationService.hardDelete method.
 * Ensures robust, type-safe, and homogeneous handling of hard delete logic, including:
 * - Successful entity hard deletion
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
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

// Helper to create a valid actor with hard delete permission
const createHardDeleteActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_HARD_DELETE] });

// Helper to create a valid accommodation entity
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

// Test suite

describe('AccommodationService.hardDelete', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createHardDeleteActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        // Mock destinationService.updateAccommodationsCount para evitar acceso real a DB
        // @ts-expect-error: override for test
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        entity = createEntity();
        actor = createHardDeleteActor();
        vi.clearAllMocks();
        (model.findById as Mock).mockResolvedValue(entity);
    });

    it('should hard delete an accommodation and return count', async () => {
        (model.hardDelete as Mock).mockResolvedValue(1);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(entity.id);
        expect(model.hardDelete).toHaveBeenCalledWith({ id: entity.id });
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const noPermsActor = createActor({ permissions: [] });
        const result = await service.hardDelete(noPermsActor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _beforeHardDelete lifecycle hook', async () => {
        const hookError = new Error('Error in beforeHardDelete hook');
        vi.spyOn(
            service as unknown as { _beforeHardDelete: () => void },
            '_beforeHardDelete'
        ).mockRejectedValue(hookError);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if database fails', async () => {
        (model.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _afterHardDelete hook', async () => {
        const hookError = new Error('Error in afterHardDelete hook');
        vi.spyOn(
            service as unknown as { _afterHardDelete: () => void },
            '_afterHardDelete'
        ).mockRejectedValue(hookError);
        const result = await service.hardDelete(actor, entity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
