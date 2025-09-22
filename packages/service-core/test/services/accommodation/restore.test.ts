import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createNewAccommodationInput } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

describe('AccommodationService.restore', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    });

    it('should restore an accommodation when permissions are valid', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id, deletedAt: new Date() };
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.restore).mockResolvedValue(1);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id);
        expect(model.restore).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id, deletedAt: new Date() };
        asMock(model.findById).mockResolvedValue(existing);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'not-found-id';
        asMock(model.findById).mockResolvedValue(null);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return count 0 if accommodation is not deleted', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id, deletedAt: null };
        asMock(model.findById).mockResolvedValue(existing);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(0);
        expect(result.error).toBeUndefined();
        expect(model.restore).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id, deletedAt: new Date() };
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.restore).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
