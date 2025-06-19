import { REntityTagModel, TagModel } from '@repo/db';
import {
    type EntityTagType,
    EntityTypeEnum,
    type PermissionEnum,
    RoleEnum,
    type TagId,
    type TagType,
    type UserId
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { ServiceInput } from '../../../src/types';

/**
 * Helper to cast a string to TagId.
 * @param id - The string to cast
 * @returns The TagId
 */
const asTagId = (id: string): TagId => id as TagId;
/**
 * Helper to cast a string to UserId.
 * @param id - The string to cast
 * @returns The UserId
 */
const asUserId = (id: string): UserId => id as UserId;
/**
 * Helper to cast a string to AccommodationId (or other entity IDs).
 * @param id - The string to cast
 * @returns The branded entity ID
 */
const asEntityId = (id: string) => id as unknown as string & { __brand: 'AccommodationId' };

/**
 * MockTagModel extends TagModel and mocks all methods for testing.
 */
class MockTagModel extends TagModel {
    create = vi.fn();
    findById = vi.fn();
    findAll = vi.fn();
    findOne = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    count = vi.fn();
}
/**
 * MockREntityTagModel extends REntityTagModel and mocks all methods for testing.
 */
class MockREntityTagModel extends REntityTagModel {
    create = vi.fn();
    hardDelete = vi.fn();
    findAllWithTags = vi.fn();
    findAllWithEntities = vi.fn();
    findAll = vi.fn();
    findOne = vi.fn();
    findById = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    count = vi.fn();
    findWithRelations = vi.fn();
}

/**
 * TestableTagService exposes public model properties for mocking in tests.
 */
class TestableTagService extends TagService {
    public model: MockTagModel;
    public relationModel: MockREntityTagModel;
    constructor() {
        super();
        this.model = new MockTagModel();
        this.relationModel = new MockREntityTagModel();
    }
}

describe('TagService', () => {
    let service: TestableTagService;
    let mockTag: TagType;
    let mockRelation: EntityTagType;
    let actor: { id: string; role: RoleEnum; permissions: PermissionEnum[] };

    beforeEach(() => {
        service = new TestableTagService();
        vi.clearAllMocks();
        mockTag = {
            id: asTagId('tag-1'),
            name: 'Test Tag',
            color: 'blue',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: asUserId('user-1'),
            updatedById: asUserId('user-1'),
            lifecycleState: 'ACTIVE'
        } as TagType;
        mockRelation = {
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        actor = { id: 'admin-1', role: RoleEnum.ADMIN, permissions: [] };
    });

    /**
     * Should create a new tag and relation if tag data is provided.
     */
    it('addTagToEntity - creates new tag and relation if tag data is provided', async () => {
        service.model.create.mockResolvedValueOnce(mockTag);
        service.relationModel.create.mockResolvedValueOnce(mockRelation);
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION,
            tag: { name: 'Test Tag', color: 'blue' }
        };
        const result = await service.addTagToEntity(input);
        expect(result.data?.tag).toEqual(mockTag);
        expect(result.data?.relation).toEqual(mockRelation);
    });

    /**
     * Should use an existing tag if tagId is provided.
     */
    it('addTagToEntity - uses existing tag if tagId is provided', async () => {
        service.model.findById.mockResolvedValueOnce(mockTag);
        service.relationModel.create.mockResolvedValueOnce(mockRelation);
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.addTagToEntity(input);
        expect(result.data?.tag).toEqual(mockTag);
        expect(result.data?.relation).toEqual(mockRelation);
    });

    /**
     * Should return error if neither tagId nor tag data is provided.
     */
    it('addTagToEntity - returns error if neither tagId nor tag data is provided', async () => {
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    /**
     * Should return error if tagId does not exist.
     */
    it('addTagToEntity - returns error if tagId does not exist', async () => {
        service.model.findById.mockResolvedValueOnce(null);
        service.relationModel.create.mockResolvedValueOnce(mockRelation);
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId('non-existent'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    /**
     * Should return error if actor lacks permission.
     */
    it('addTagToEntity - returns error if actor lacks permission', async () => {
        const forbiddenActor = { id: 'user-2', role: RoleEnum.USER, permissions: [] };
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor: forbiddenActor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION,
            tag: { name: 'Test Tag', color: 'blue' }
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    /**
     * Should return INTERNAL_ERROR if model.create throws.
     */
    it('addTagToEntity - returns INTERNAL_ERROR if model.create throws', async () => {
        service.model.create.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION,
            tag: { name: 'Test Tag', color: 'blue' }
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    /**
     * Should return error if required tag fields are missing.
     */
    it('addTagToEntity - returns error if required tag fields are missing', async () => {
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION,
            tag: { color: 'blue' }
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    /**
     * Should call hardDelete and return null.
     */
    it('removeTagFromEntity - calls hardDelete and returns null', async () => {
        service.relationModel.hardDelete.mockResolvedValueOnce(1);
        const input: ServiceInput<EntityTagType> = {
            actor,
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.removeTagFromEntity(input);
        expect(service.relationModel.hardDelete).toHaveBeenCalledWith({
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        });
        expect(result.data).toBeNull();
    });

    /**
     * Should be idempotent if relation does not exist.
     */
    it('removeTagFromEntity - is idempotent if relation does not exist', async () => {
        service.relationModel.hardDelete.mockResolvedValueOnce(0);
        const input: ServiceInput<EntityTagType> = {
            actor,
            tagId: asTagId('tag-unknown'),
            entityId: asEntityId('entity-unknown'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.removeTagFromEntity(input);
        expect(result.data).toBeNull();
    });

    /**
     * Should return VALIDATION_ERROR if actor lacks permission to remove tag.
     */
    it('removeTagFromEntity - returns VALIDATION_ERROR if actor lacks permission', async () => {
        const forbiddenActor = { id: 'user-2', role: RoleEnum.USER, permissions: [] };
        service.model.findById.mockResolvedValueOnce(mockTag);
        const input: ServiceInput<EntityTagType> = {
            actor: forbiddenActor,
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.removeTagFromEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    /**
     * Should succeed if actor has permission to remove tag.
     */
    it('removeTagFromEntity - succeeds if actor has permission', async () => {
        const adminActor = { id: 'admin-1', role: RoleEnum.ADMIN, permissions: [] };
        service.model.findById.mockResolvedValueOnce(mockTag);
        service.relationModel.hardDelete.mockResolvedValueOnce(1);
        const input: ServiceInput<EntityTagType> = {
            actor: adminActor,
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.removeTagFromEntity(input);
        expect(result.data).toBeNull();
        expect(result.error).toBeUndefined();
    });

    /**
     * Should return INTERNAL_ERROR if model.hardDelete throws.
     */
    it('removeTagFromEntity - returns INTERNAL_ERROR if model.hardDelete throws', async () => {
        service.relationModel.hardDelete.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const input: ServiceInput<EntityTagType> = {
            actor,
            tagId: asTagId('tag-1'),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.removeTagFromEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    /**
     * Should return tags for an entity.
     */
    it('listTagsForEntity - returns tags for an entity', async () => {
        const relations = [
            { ...mockRelation, tag: mockTag },
            { ...mockRelation, tag: { ...mockTag, id: asTagId('tag-2'), name: 'Another Tag' } }
        ];
        service.relationModel.findAllWithTags.mockResolvedValueOnce(relations);
        const input: ServiceInput<{ entityId: string; entityType: string }> = {
            actor,
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.listTagsForEntity(input);
        expect(result.data).toBeDefined();
        expect(result.data?.[0]?.name).toBe('Test Tag');
        expect(result.data?.[1]?.name).toBe('Another Tag');
    });

    /**
     * Should return empty array if entity has no tags.
     */
    it('listTagsForEntity - returns empty array if entity has no tags', async () => {
        service.relationModel.findAllWithTags.mockResolvedValueOnce([]);
        const input: ServiceInput<{ entityId: string; entityType: string }> = {
            actor,
            entityId: asEntityId('entity-no-tags'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.listTagsForEntity(input);
        expect(result.data).toEqual([]);
    });

    /**
     * Should return INTERNAL_ERROR if model throws.
     */
    it('listTagsForEntity - returns INTERNAL_ERROR if model throws', async () => {
        service.relationModel.findAllWithTags.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const input: ServiceInput<{ entityId: string; entityType: string }> = {
            actor,
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result = await service.listTagsForEntity(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    /**
     * Should return relations for a tag.
     */
    it('listEntitiesForTag - returns relations for a tag', async () => {
        const relations = [
            { ...mockRelation, tag: mockTag },
            { ...mockRelation, tag: { ...mockTag, id: asTagId('tag-2'), name: 'Another Tag' } }
        ];
        service.relationModel.findAllWithEntities.mockResolvedValueOnce(relations);
        const input: ServiceInput<{ tagId: string; entityType?: string }> = {
            actor,
            tagId: asTagId('tag-1')
        };
        const result = await service.listEntitiesForTag(input);
        expect(result.data).toBeDefined();
        expect(result.data?.[0]?.tag.name).toBe('Test Tag');
        expect(result.data?.[1]?.tag.name).toBe('Another Tag');
    });

    /**
     * Should return empty array if tag has no entities.
     */
    it('listEntitiesForTag - returns empty array if tag has no entities', async () => {
        service.relationModel.findAllWithEntities.mockResolvedValueOnce([]);
        const input: ServiceInput<{ tagId: string; entityType?: string }> = {
            actor,
            tagId: asTagId('tag-no-entities')
        };
        const result = await service.listEntitiesForTag(input);
        expect(result.data).toEqual([]);
    });

    /**
     * Should return INTERNAL_ERROR if model throws.
     */
    it('listEntitiesForTag - returns INTERNAL_ERROR if model throws', async () => {
        service.relationModel.findAllWithEntities.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const input: ServiceInput<{ tagId: string; entityType?: string }> = {
            actor,
            tagId: asTagId('tag-1')
        };
        const result = await service.listEntitiesForTag(input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    /**
     * Should return error if actor is null or invalid.
     */
    it('addTagToEntity - returns error if actor is null', async () => {
        // Forcing missing actor property to simulate invalid input
        const input = {
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: EntityTypeEnum.ACCOMMODATION,
            tag: { name: 'Test Tag', color: 'blue' }
        } as unknown as ServiceInput<EntityTagType & { tag?: Partial<TagType> }>;
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
    });

    /**
     * Should return error if entityType is invalid.
     */
    it('addTagToEntity - returns error if entityType is invalid', async () => {
        // Forcing invalid entityType by casting to EntityTypeEnum
        const input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }> = {
            actor,
            tagId: asTagId(''),
            entityId: asEntityId('entity-1'),
            entityType: 'INVALID_TYPE' as unknown as EntityTypeEnum,
            tag: { name: 'Test Tag', color: 'blue' }
        };
        const result = await service.addTagToEntity(input);
        expect(result.error).toBeDefined();
    });
});
