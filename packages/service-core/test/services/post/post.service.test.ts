import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { Actor, ServiceContext } from '../../../src/types';

// Mock PostModel
class MockPostModel {
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

describe('PostService - Relations Support', () => {
    let service: PostService;
    let mockContext: ServiceContext;
    let mockModel: MockPostModel;
    let mockActor: Actor;

    const mockPaginatedResult = {
        data: [
            { id: 1, title: 'Post Test 1', authorId: 'user1' },
            { id: 2, title: 'Post Test 2', authorId: 'user2' }
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

        mockModel = new MockPostModel();
        service = new PostService(mockContext, mockModel as any);
    });

    describe('getDefaultListRelations method', () => {
        it('should return configured default relations for posts', () => {
            // Execute
            const relations = (service as any).getDefaultListRelations();

            // Verify
            expect(relations).toEqual({
                author: true,
                relatedAccommodation: true,
                relatedDestination: true,
                relatedEvent: true,
                sponsorship: { sponsor: true }
            });
        });
    });

    describe('list method with default relations', () => {
        it('should use post-specific default relations when listing', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                {
                    author: true,
                    relatedAccommodation: true,
                    relatedDestination: true,
                    relatedEvent: true,
                    sponsorship: { sponsor: true }
                },
                {},
                { page: undefined, pageSize: undefined }
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should override default relations when custom relations provided', async () => {
            // Setup
            const customRelations = {
                tags: true,
                comments: true
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
