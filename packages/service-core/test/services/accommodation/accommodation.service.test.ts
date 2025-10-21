import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceContext } from '../../../src/types';

// Mock AccommodationModel
class MockAccommodationModel {
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

// Mock DestinationService
vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(() => ({}))
}));

describe('AccommodationService - Relations Support', () => {
    let service: AccommodationService;
    let mockContext: ServiceContext;
    let mockModel: MockAccommodationModel;
    let mockActor: Actor;

    const mockPaginatedResult = {
        data: [
            { id: 1, name: 'Hotel Test', destinationId: 1, ownerId: 'user1' },
            { id: 2, name: 'Apartamento Test', destinationId: 2, ownerId: 'user2' }
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

        mockModel = new MockAccommodationModel();
        service = new AccommodationService(mockContext, mockModel as any);
    });

    describe('getDefaultListRelations method', () => {
        it('should return configured default relations for accommodations', () => {
            // Execute
            const relations = (service as any).getDefaultListRelations();

            // Verify
            expect(relations).toEqual({
                destination: true,
                owner: true
            });
        });
    });

    describe('list method with default relations', () => {
        it('should use accommodation-specific default relations when listing', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { destination: true, owner: true },
                {},
                { page: undefined, pageSize: undefined }
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should override default relations when custom relations provided', async () => {
            // Setup
            const customRelations = {
                images: true,
                reviews: true
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

        it('should handle pagination with relations correctly', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { page: 2, pageSize: 20 });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { destination: true, owner: true },
                {},
                { page: 2, pageSize: 20 }
            );
        });
    });
});
