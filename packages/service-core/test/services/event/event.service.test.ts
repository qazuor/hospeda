import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { Actor, ServiceContext } from '../../../src/types';

// Mock EventModel
class MockEventModel {
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
}

describe('EventService - Relations Support', () => {
    let service: EventService;
    let mockContext: ServiceContext;
    let mockModel: MockEventModel;
    let mockActor: Actor;

    const mockPaginatedResult = {
        data: [
            { id: 1, name: 'Evento Test 1', organizerId: 1, locationId: 1 },
            { id: 2, name: 'Evento Test 2', organizerId: 2, locationId: 2 }
        ],
        pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1
        }
    };

    beforeEach(() => {
        // Create mocks
        mockContext = {} as ServiceContext;

        mockActor = {
            id: 'test-user',
            type: 'user',
            role: RoleEnum.USER,
            permissions: []
        } as Actor;

        mockModel = new MockEventModel();
        service = new EventService({ ...mockContext, model: mockModel as any });
    });

    describe('getDefaultListRelations method', () => {
        it('should return configured default relations for events', () => {
            // Execute
            const relations = (service as any).getDefaultListRelations();

            // Verify
            expect(relations).toEqual({
                organizer: true,
                location: true
            });
        });
    });

    describe('list method with default relations', () => {
        it('should use event-specific default relations when listing', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { organizer: true, location: true },
                {},
                { page: undefined, pageSize: undefined }
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should override default relations when custom relations provided', async () => {
            // Setup
            const customRelations = {
                category: true,
                participants: true
            };
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { relations: customRelations });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                customRelations,
                {},
                { page: undefined, pageSize: undefined }
            );
        });
    });
});
