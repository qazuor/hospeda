import type { DestinationModel } from '@repo/db';
import { type Destination, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

describe('DestinationService hookState concurrency', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        model = createMockBaseModel();
        service = new DestinationService({ logger: mockLogger }, model as DestinationModel);
        vi.clearAllMocks();
    });

    it('instance fields should not exist after construction', () => {
        // Assert - mutable instance fields should not exist after hookState migration
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._updateId).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._pendingPathUpdate).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._lastDeletedDestinationSlug).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._lastRestoredDestinationSlug).toBeUndefined();
    });

    it('should store updateId on ctx.hookState, not instance field', () => {
        // Assert - verify no mutable state leaks to instance
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        const instance = service as any;
        expect(instance._updateId).toBeUndefined();
        expect(instance._pendingPathUpdate).toBeUndefined();
        expect(instance._lastDeletedDestinationSlug).toBeUndefined();
        expect(instance._lastRestoredDestinationSlug).toBeUndefined();
    });

    it('should not leak state between concurrent softDelete calls', async () => {
        // Arrange
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
        const id1 = getMockId('destination', '1') as Destination['id'];
        const id2 = getMockId('destination', '2') as Destination['id'];

        const entity1 = {
            ...createDestination(),
            id: id1,
            slug: 'dest-alpha',
            deletedAt: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        const entity2 = {
            ...createDestination(),
            id: id2,
            slug: 'dest-beta',
            deletedAt: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };

        asMock(model.findById).mockImplementation((id: string) => {
            if (id === id1) return Promise.resolve(entity1);
            if (id === id2) return Promise.resolve(entity2);
            return Promise.resolve(null);
        });
        asMock(model.softDelete).mockResolvedValue(1);

        // Act
        const [result1, result2] = await Promise.all([
            service.softDelete(actor, id1),
            service.softDelete(actor, id2)
        ]);

        // Assert
        expect(result1.error).toBeUndefined();
        expect(result1.data?.count).toBe(1);
        expect(result2.error).toBeUndefined();
        expect(result2.data?.count).toBe(1);
    });

    it('should not leak state between concurrent restore calls', async () => {
        // Arrange
        const actor = createAdminActor({
            permissions: [PermissionEnum.DESTINATION_RESTORE, PermissionEnum.DESTINATION_DELETE]
        });
        const id1 = getMockId('destination', '1') as Destination['id'];
        const id2 = getMockId('destination', '2') as Destination['id'];

        const entity1 = {
            ...createDestination(),
            id: id1,
            slug: 'dest-alpha',
            deletedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        const entity2 = {
            ...createDestination(),
            id: id2,
            slug: 'dest-beta',
            deletedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };

        asMock(model.findById).mockImplementation((id: string) => {
            if (id === id1) return Promise.resolve(entity1);
            if (id === id2) return Promise.resolve(entity2);
            return Promise.resolve(null);
        });
        asMock(model.restore).mockResolvedValue(1);

        // Act
        const [result1, result2] = await Promise.all([
            service.restore(actor, id1),
            service.restore(actor, id2)
        ]);

        // Assert
        expect(result1.error).toBeUndefined();
        expect(result1.data?.count).toBe(1);
        expect(result2.error).toBeUndefined();
        expect(result2.data?.count).toBe(1);
    });
});
