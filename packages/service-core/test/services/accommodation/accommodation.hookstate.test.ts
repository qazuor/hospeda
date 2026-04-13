import type { AccommodationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

describe('AccommodationService hookState concurrency', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // Mock destinationService to avoid real DB access in lifecycle hooks
        // @ts-expect-error: override for test
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    });

    it('should not leak state between concurrent softDelete calls', async () => {
        // Arrange
        const actor = createAdminActor();
        const entity1 = createMockAccommodation({
            id: '1' as string,
            slug: 'hotel-a',
            destinationId: 'dest-1',
            deletedAt: undefined
        });
        const entity2 = createMockAccommodation({
            id: '2' as string,
            slug: 'hotel-b',
            destinationId: 'dest-2',
            deletedAt: undefined
        });

        asMock(model.findById).mockImplementation((id: string) => {
            if (id === '1') return Promise.resolve(entity1);
            if (id === '2') return Promise.resolve(entity2);
            return Promise.resolve(null);
        });
        asMock(model.softDelete).mockResolvedValue(1);

        // Act
        const [result1, result2] = await Promise.all([
            service.softDelete(actor, '1'),
            service.softDelete(actor, '2')
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
            permissions: [
                PermissionEnum.ACCOMMODATION_RESTORE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY
            ]
        });
        const entity1 = createMockAccommodation({
            id: '1' as string,
            slug: 'hotel-a',
            destinationId: 'dest-1',
            deletedAt: new Date()
        });
        const entity2 = createMockAccommodation({
            id: '2' as string,
            slug: 'hotel-b',
            destinationId: 'dest-2',
            deletedAt: new Date()
        });

        asMock(model.findById).mockImplementation((id: string) => {
            if (id === '1') return Promise.resolve(entity1);
            if (id === '2') return Promise.resolve(entity2);
            return Promise.resolve(null);
        });
        asMock(model.restore).mockResolvedValue(1);

        // Act
        const [result1, result2] = await Promise.all([
            service.restore(actor, '1'),
            service.restore(actor, '2')
        ]);

        // Assert
        expect(result1.error).toBeUndefined();
        expect(result1.data?.count).toBe(1);
        expect(result2.error).toBeUndefined();
        expect(result2.data?.count).toBe(1);
    });

    it('instance fields _lastDeletedEntity and _lastRestoredAccommodation should not exist', () => {
        // Assert - these mutable instance fields should not exist after hookState migration
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._lastDeletedEntity).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: testing private fields
        expect((service as any)._lastRestoredAccommodation).toBeUndefined();
    });
});
