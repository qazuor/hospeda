import type { DestinationModel } from '@repo/db';
import { type DestinationType, PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

describe('DestinationService.softDelete', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new DestinationService({ logger: mockLogger }, model as DestinationModel);
        vi.clearAllMocks();
    });

    it('should soft delete a destination when permissions are valid', async () => {
        // Arrange
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.softDelete as Mock).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id);
        expect(model.softDelete).toHaveBeenCalledWith({ id });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        // Arrange
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
        const id = getMockId('destination') as DestinationType['id'];
        (model.findById as Mock).mockResolvedValue(null);

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.softDelete as Mock).mockRejectedValue(new Error('DB error'));

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
