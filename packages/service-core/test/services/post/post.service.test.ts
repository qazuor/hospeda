import { EntityTypeEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { Actor, ServiceConfig } from '../../../src/types';

// Mock PostModel
class MockPostModel {
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    // BaseModel always exposes getTable(); default to an empty table (no deletedAt
    // column) so list() does not inject the SPEC-230 soft-delete predicate here.
    getTable = vi.fn().mockReturnValue({});
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

// Mock REntityTagModel (r_entity_tag) — used to resolve the `tags` filter (HOS-109)
class MockREntityTagModel {
    findEntityIdsByTags = vi.fn();
}

describe('PostService - Relations Support', () => {
    let service: PostService;
    let mockContext: ServiceConfig;
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
        mockContext = {} as ServiceConfig;

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
                sponsorship: { sponsor: true },
                postTags: { postTag: true }
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
                    sponsorship: { sponsor: true },
                    postTags: { postTag: true }
                },
                {},
                { page: undefined, pageSize: undefined },
                undefined,
                undefined
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
                { page: undefined, pageSize: undefined },
                undefined,
                undefined
            );
        });
    });
});

describe('PostService - tags filter via r_entity_tag (HOS-109 regression)', () => {
    let service: PostService;
    let mockContext: ServiceConfig;
    let mockModel: MockPostModel;
    let mockRelatedModel: MockREntityTagModel;
    let mockActor: Actor;

    beforeEach(() => {
        mockContext = {} as ServiceConfig;

        mockActor = {
            id: 'test-user',
            type: 'user',
            role: RoleEnum.USER,
            permissions: []
        } as Actor;

        mockModel = new MockPostModel();
        mockRelatedModel = new MockREntityTagModel();
        service = new PostService(mockContext, mockModel as any, null, mockRelatedModel as any);
    });

    describe('_executeSearch', () => {
        it('should resolve post IDs from the tag layer and constrain by id, not a raw tags key', async () => {
            // Arrange
            const tagId = '11111111-1111-1111-1111-111111111111';
            mockRelatedModel.findEntityIdsByTags.mockResolvedValue(['post-1', 'post-2']);
            mockModel.findAllWithRelations.mockResolvedValue({
                items: [{ id: 'post-1' }],
                total: 1
            });

            // Act
            const result = await (service as any)._executeSearch({ tags: [tagId] }, mockActor, {});

            // Assert
            expect(mockRelatedModel.findEntityIdsByTags).toHaveBeenCalledWith(
                [tagId],
                EntityTypeEnum.POST
            );
            expect(mockModel.findAllWithRelations).toHaveBeenCalledTimes(1);
            const call = mockModel.findAllWithRelations.mock.calls[0];
            const whereArg = call?.[1] as Record<string, unknown>;
            const additionalConditionsArg = call?.[3] as unknown[];
            expect(whereArg).not.toHaveProperty('tags');
            expect(additionalConditionsArg).toHaveLength(1);
            expect(result).toEqual({ items: [{ id: 'post-1' }], total: 1 });
        });

        it('should return an empty result set when no post matches the tags, without throwing', async () => {
            // Arrange
            const tagId = '22222222-2222-2222-2222-222222222222';
            mockRelatedModel.findEntityIdsByTags.mockResolvedValue([]);

            // Act
            const result = await (service as any)._executeSearch({ tags: [tagId] }, mockActor, {});

            // Assert
            expect(result).toEqual({ items: [], total: 0 });
            expect(mockModel.findAllWithRelations).not.toHaveBeenCalled();
        });

        it('should not call the tag model and should keep existing filters when tags is absent', async () => {
            // Arrange
            mockModel.findAllWithRelations.mockResolvedValue({ items: [], total: 0 });

            // Act
            await (service as any)._executeSearch(
                { category: 'blog', isNews: false, isFeatured: true },
                mockActor,
                {}
            );

            // Assert
            expect(mockRelatedModel.findEntityIdsByTags).not.toHaveBeenCalled();
            const call = mockModel.findAllWithRelations.mock.calls[0];
            const whereArg = call?.[1] as Record<string, unknown>;
            expect(whereArg).toEqual({ category: 'blog', isNews: false, isFeatured: true });
            expect(call?.[3]).toBeUndefined();
        });
    });

    describe('_executeCount', () => {
        it('should resolve post IDs from the tag layer and constrain the count by id', async () => {
            // Arrange
            const tagId = '33333333-3333-3333-3333-333333333333';
            mockRelatedModel.findEntityIdsByTags.mockResolvedValue(['post-1']);
            mockModel.count.mockResolvedValue(1);

            // Act
            const result = await (service as any)._executeCount({ tags: [tagId] }, mockActor, {});

            // Assert
            expect(mockRelatedModel.findEntityIdsByTags).toHaveBeenCalledWith(
                [tagId],
                EntityTypeEnum.POST
            );
            expect(mockModel.count).toHaveBeenCalledTimes(1);
            const call = mockModel.count.mock.calls[0];
            const whereArg = call?.[0] as Record<string, unknown>;
            const options = call?.[1] as { additionalConditions: unknown[] };
            expect(whereArg).not.toHaveProperty('tags');
            expect(options.additionalConditions).toHaveLength(1);
            expect(result).toEqual({ count: 1 });
        });

        it('should return a zero count when no post matches the tags, without throwing', async () => {
            // Arrange
            const tagId = '44444444-4444-4444-4444-444444444444';
            mockRelatedModel.findEntityIdsByTags.mockResolvedValue([]);

            // Act
            const result = await (service as any)._executeCount({ tags: [tagId] }, mockActor, {});

            // Assert
            expect(result).toEqual({ count: 0 });
            expect(mockModel.count).not.toHaveBeenCalled();
        });

        it('should keep existing filters passing through when tags is absent', async () => {
            // Arrange
            mockModel.count.mockResolvedValue(5);

            // Act
            await (service as any)._executeCount({ category: 'news' }, mockActor, {});

            // Assert
            expect(mockRelatedModel.findEntityIdsByTags).not.toHaveBeenCalled();
            const call = mockModel.count.mock.calls[0];
            const whereArg = call?.[0] as Record<string, unknown>;
            const options = call?.[1] as { additionalConditions: unknown[] };
            expect(whereArg).toEqual({ category: 'news' });
            expect(options.additionalConditions).toEqual([]);
        });
    });
});
