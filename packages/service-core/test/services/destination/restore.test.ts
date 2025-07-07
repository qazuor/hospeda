import type { DestinationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

describe('DestinationService.restore', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    beforeEach(() => {
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        vi.clearAllMocks();
    });

    it('should restore a destination when permissions are valid', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_RESTORE] });
        const id = getMockId('destination');
        const existing = { ...createDestination(), id, deletedAt: new Date() };
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
        const id = getMockId('destination');
        const existing = { ...createDestination(), id, deletedAt: new Date() };
        asMock(model.findById).mockResolvedValue(existing);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_RESTORE] });
        const id = getMockId('destination');
        asMock(model.findById).mockResolvedValue(null);
        // Act
        const result = await service.restore(actor, id);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return count 0 if destination is not deleted', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_RESTORE] });
        const id = getMockId('destination');
        const existing = { ...createDestination(), id, deletedAt: null };
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
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_RESTORE] });
        const id = getMockId('destination');
        const existing = { ...createDestination(), id, deletedAt: new Date() };
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
